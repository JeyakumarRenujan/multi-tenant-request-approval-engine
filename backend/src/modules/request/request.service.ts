import { Prisma, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedUser } from '../../types/express';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/AppError';
import {
  CreateRequestInput,
  UpdateRequestInput,
  AssignRequestInput,
  TransitionRequestInput,
  RequestQueryInput,
} from './request.schema';
import { assertTransitionAllowed } from './request.stateMachine';

export class RequestService {
  /**
   * Helper to derive the strict visibility where clause based on tenant role.
   *
   * Rules:
   * - CLIENT_USER: only requests of their own clientId.
   * - DEVELOPER: only requests assigned to them AND status != DRAFT.
   *   Architecture Decision: Developers must never see DRAFT requests, even if assigned.
   *   A DRAFT request is a private work-in-progress of the author that has not yet been submitted into
   *   the official review/approval workflow. Hiding drafts prevents premature developer action and
   *   protects incomplete or changing client requirements.
   * - MANAGER and ORG_ADMIN: all requests in their organization.
   * - PLATFORM_ADMIN: cannot access requests (403 Forbidden).
   */
  private getVisibilityWhere(user: AuthenticatedUser): Prisma.RequestWhereInput {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot access tenant requests');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const where: Prisma.RequestWhereInput = {
      organizationId,
    };

    if (user.role === Role.CLIENT_USER) {
      if (!user.clientId) {
        throw new NotFoundError('Client entity not found');
      }
      where.clientId = user.clientId;
    } else if (user.role === Role.DEVELOPER) {
      where.assigneeId = user.id;
      // Architecture Decision: Developers must never see DRAFT requests, even if assigned.
      where.status = { not: RequestStatus.DRAFT };
    }
    // MANAGER and ORG_ADMIN see all requests within the organization

    return where;
  }

  async createRequest(user: AuthenticatedUser, input: CreateRequestInput) {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot create requests');
    }

    const organizationId = user.organizationId!;

    // Resolve and validate clientId
    let targetClientId: string;
    if (user.role === Role.CLIENT_USER) {
      // For CLIENT_USER, clientId is strictly derived from the authenticated user
      if (!user.clientId) {
        throw new NotFoundError('Client entity not found');
      }
      targetClientId = user.clientId;
    } else {
      // For internal staff (ORG_ADMIN, MANAGER), clientId must be provided in body
      if (!input.clientId) {
        throw new BadRequestError('clientId is required when creating a request');
      }

      // Verify client exists and belongs to this organization (Rule #3: 404 for cross-tenant)
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          organizationId,
        },
      });

      if (!client) {
        throw new NotFoundError('Client not found');
      }

      targetClientId = client.id;
    }

    const parsedDueDate = input.dueDate ? new Date(input.dueDate) : null;

    // Create request with initial DRAFT status and version 1
    const request = await prisma.request.create({
      data: {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        priority: input.priority,
        dueDate: parsedDueDate,
        status: RequestStatus.DRAFT,
        ownerId: user.id,
        organizationId,
        clientId: targetClientId,
        version: 1,
      },
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Record initial activity log
    await prisma.activityLog.create({
      data: {
        organizationId,
        requestId: request.id,
        actorId: user.id,
        event: 'CREATED',
        newStatus: RequestStatus.DRAFT,
        metadata: {
          title: request.title,
          category: request.category,
          priority: request.priority,
        },
      },
    });

    return request;
  }

  async getRequests(user: AuthenticatedUser, query: RequestQueryInput) {
    // 1. Base visibility filter (tenant isolation & role-based visibility)
    const baseWhere = this.getVisibilityWhere(user);

    // 2. Build explicit AND array to guarantee all search, filters, and role restrictions
    //    are strictly conjoined with tenant scope using AND.
    const andConditions: Prisma.RequestWhereInput[] = [
      baseWhere,
    ];

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.priority) {
      andConditions.push({ priority: query.priority });
    }

    if (query.category) {
      andConditions.push({ category: query.category });
    }

    if (query.assigneeId && user.role !== Role.DEVELOPER) {
      andConditions.push({ assigneeId: query.assigneeId });
    }

    if (query.search) {
      andConditions.push({
        title: {
          contains: query.search.trim(),
          mode: 'insensitive',
        },
      });
    }

    // Overdue filter: dueDate < now AND status NOT IN (COMPLETED, REJECTED)
    if (query.overdue === true) {
      andConditions.push({
        dueDate: {
          lt: new Date(),
        },
        status: {
          notIn: [RequestStatus.COMPLETED, RequestStatus.REJECTED],
        },
      });
    } else if (query.overdue === false) {
      andConditions.push({
        OR: [
          { dueDate: null },
          { dueDate: { gte: new Date() } },
          { status: { in: [RequestStatus.COMPLETED, RequestStatus.REJECTED] } },
        ],
      });
    }

    const where: Prisma.RequestWhereInput = {
      AND: andConditions,
    };

    // 3. Pagination & Sorting
    const page = Number(query.page) || 1;
    const pageSize = Math.min(Number(query.pageSize) || 10, 100);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, data] = await Promise.all([
      prisma.request.count({ where }),
      prisma.request.findMany({
        where,
        skip,
        take,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        include: {
          client: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getRequestById(user: AuthenticatedUser, requestId: string) {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot access tenant requests');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    // Enforce Rule #3: Cross-tenant access returns 404
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('Request not found');
    }

    // Visibility Check for CLIENT_USER: only their client's requests
    if (user.role === Role.CLIENT_USER && request.clientId !== user.clientId) {
      throw new NotFoundError('Request not found');
    }

    // Visibility Check for DEVELOPER: only assigned requests that are NOT in DRAFT status
    // Architecture Decision: Developers must never see DRAFT requests, even if assigned
    if (user.role === Role.DEVELOPER) {
      if (request.assigneeId !== user.id || request.status === RequestStatus.DRAFT) {
        throw new NotFoundError('Request not found');
      }
    }

    return request;
  }

  async updateRequest(user: AuthenticatedUser, requestId: string, input: UpdateRequestInput) {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot edit tenant requests');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    // Enforce Rule #3: 404 for missing or cross-tenant requests
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('Request not found');
    }

    // Client users cannot touch requests outside their client
    if (user.role === Role.CLIENT_USER && request.clientId !== user.clientId) {
      throw new NotFoundError('Request not found');
    }

    // Only editable by creator
    if (request.ownerId !== user.id) {
      throw new ForbiddenError('Only the request creator can edit this draft request');
    }

    // Only editable while DRAFT
    if (request.status !== RequestStatus.DRAFT) {
      throw new BadRequestError('Only draft requests can be edited');
    }

    const dataToUpdate: any = {};
    const changedFields: string[] = [];

    if (input.title !== undefined) {
      dataToUpdate.title = input.title.trim();
      changedFields.push('title');
    }
    if (input.description !== undefined) {
      dataToUpdate.description = input.description.trim();
      changedFields.push('description');
    }
    if (input.category !== undefined) {
      dataToUpdate.category = input.category;
      changedFields.push('category');
    }
    if (input.priority !== undefined) {
      dataToUpdate.priority = input.priority;
      changedFields.push('priority');
    }
    if (input.dueDate !== undefined) {
      dataToUpdate.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      changedFields.push('dueDate');
    }

    // Optimistic locking: check expectedVersion if supplied
    if (input.expectedVersion !== undefined && request.version !== input.expectedVersion) {
      throw new ConflictError('Concurrent modification detected or version mismatch', {
        expectedVersion: input.expectedVersion,
        currentVersion: request.version,
      });
    }

    const versionToMatch = input.expectedVersion !== undefined ? input.expectedVersion : request.version;

    // Execute update and audit log creation atomically inside a single transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.request.updateMany({
        where: {
          id: requestId,
          organizationId,
          version: versionToMatch,
          status: RequestStatus.DRAFT,
          ownerId: user.id,
        },
        data: {
          ...dataToUpdate,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Concurrent modification detected or version mismatch', {
          expectedVersion: versionToMatch,
          currentVersion: request.version,
        });
      }

      // Record ActivityLog row with event UPDATED and changed fields inside transaction
      if (changedFields.length > 0) {
        await tx.activityLog.create({
          data: {
            organizationId,
            requestId: request.id,
            actorId: user.id,
            event: 'UPDATED',
            previousStatus: request.status,
            newStatus: request.status,
            metadata: {
              changedFields,
            },
          },
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          client: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return updated;
  }

  async assignRequest(
    user: AuthenticatedUser,
    requestId: string,
    assigneeId: string,
    expectedVersion?: number
  ) {
    // Only MANAGER is authorized to assign requests
    if (user.role !== Role.MANAGER) {
      throw new ForbiddenError('Only managers can assign requests');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    // Enforce Rule #3: Cross-tenant request returns 404
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('Request not found');
    }

    // Assignment is only allowed when status is SUBMITTED, UNDER_REVIEW, APPROVED or IN_PROGRESS. Otherwise return 409.
    const allowedAssignmentStatuses: RequestStatus[] = [
      RequestStatus.SUBMITTED,
      RequestStatus.UNDER_REVIEW,
      RequestStatus.APPROVED,
      RequestStatus.IN_PROGRESS,
    ];

    if (!allowedAssignmentStatuses.includes(request.status)) {
      throw new ConflictError(
        `Assignment is only allowed when status is SUBMITTED, UNDER_REVIEW, APPROVED, or IN_PROGRESS (current status: ${request.status})`,
        {
          currentStatus: request.status,
          allowedStatuses: allowedAssignmentStatuses,
        }
      );
    }

    // Verify assignee: must be an active DEVELOPER in the SAME organization
    // If assignee belongs to another organization, returns 404 to avoid ID enumeration
    const developer = await prisma.user.findFirst({
      where: {
        id: assigneeId,
        organizationId,
      },
    });

    if (!developer) {
      throw new NotFoundError('Developer not found in this organization');
    }

    if (developer.role !== Role.DEVELOPER) {
      throw new BadRequestError('Assignee must have the DEVELOPER role');
    }

    if (!developer.isActive) {
      throw new BadRequestError('Assignee is deactivated');
    }

    // Optimistic locking: check expectedVersion if supplied
    if (expectedVersion !== undefined && request.version !== expectedVersion) {
      throw new ConflictError('Concurrent modification detected or version mismatch', {
        expectedVersion,
        currentVersion: request.version,
      });
    }

    const versionToMatch = expectedVersion !== undefined ? expectedVersion : request.version;

    // Execute assignment update and ASSIGNED ActivityLog insert atomically inside a single transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.request.updateMany({
        where: {
          id: requestId,
          organizationId,
          version: versionToMatch,
          status: { in: allowedAssignmentStatuses },
        },
        data: {
          assigneeId: developer.id,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Concurrent modification detected or version mismatch', {
          expectedVersion: versionToMatch,
          currentVersion: request.version,
        });
      }

      // Log the assignment event in ActivityLog atomically in the same transaction
      await tx.activityLog.create({
        data: {
          organizationId,
          requestId: request.id,
          actorId: user.id,
          event: 'ASSIGNED',
          previousStatus: request.status,
          newStatus: request.status,
          metadata: {
            assigneeId: developer.id,
            assigneeName: developer.name,
            version: versionToMatch + 1,
          },
        },
      });

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          client: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return updated;
  }

  async transitionRequest(
    user: AuthenticatedUser,
    requestId: string,
    input: TransitionRequestInput
  ) {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot access tenant requests');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    // Enforce Rule #3: Cross-tenant access returns 404 to prevent ID enumeration
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('Request not found');
    }

    // Role-based visibility check: user must have visibility into this request
    // CLIENT_USER: only requests belonging to their clientId
    if (user.role === Role.CLIENT_USER && request.clientId !== user.clientId) {
      throw new NotFoundError('Request not found');
    }

    // DEVELOPER: only assigned requests that are not in DRAFT
    if (user.role === Role.DEVELOPER) {
      if (request.assigneeId !== user.id || request.status === RequestStatus.DRAFT) {
        throw new NotFoundError('Request not found');
      }
    }

    // Optimistic locking: if current version does not match expectedVersion, return 409 CONFLICT
    if (request.version !== input.expectedVersion) {
      throw new ConflictError('Concurrent modification detected or version mismatch', {
        expectedVersion: input.expectedVersion,
        currentVersion: request.version,
      });
    }

    // State machine authorization and transition validation
    assertTransitionAllowed(
      request.status,
      input.toStatus,
      user,
      request,
      input.reason ?? undefined
    );

    const trimmedReason = input.reason?.trim() || null;

    // Concurrency control: inside ONE prisma.$transaction, run updateMany WHERE id, organizationId,
    // version = expectedVersion AND status = current status. If count is 0, return 409 CONFLICT.
    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.RequestUpdateManyMutationInput = {
        status: input.toStatus,
        version: { increment: 1 },
      };

      if (input.toStatus === RequestStatus.REJECTED && trimmedReason) {
        updateData.rejectionReason = trimmedReason;
      }

      const updateResult = await tx.request.updateMany({
        where: {
          id: requestId,
          organizationId,
          version: input.expectedVersion,
          status: request.status,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Concurrent modification detected or version mismatch', {
          expectedVersion: input.expectedVersion,
          currentVersion: request.version,
        });
      }

      // Record ActivityLog row with event STATUS_CHANGED inside the same transaction
      await tx.activityLog.create({
        data: {
          organizationId,
          requestId: request.id,
          actorId: user.id,
          event: 'STATUS_CHANGED',
          previousStatus: request.status,
          newStatus: input.toStatus,
          metadata: {
            reason: trimmedReason,
            version: input.expectedVersion + 1,
          },
        },
      });

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          client: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return updated;
  }

  async getRequestHistory(user: AuthenticatedUser, requestId: string) {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot access request history');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    // Enforce Rule #3: Cross-tenant access returns 404 to avoid ID enumeration
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('Request not found');
    }

    // Role-based visibility check:
    // CLIENT_USER: only requests belonging to their clientId
    if (user.role === Role.CLIENT_USER && request.clientId !== user.clientId) {
      throw new NotFoundError('Request not found');
    }

    // DEVELOPER: only assigned requests that are not in DRAFT
    if (user.role === Role.DEVELOPER) {
      if (request.assigneeId !== user.id || request.status === RequestStatus.DRAFT) {
        throw new NotFoundError('Request not found');
      }
    }

    // Fetch ActivityLog rows ordered chronologically (createdAt asc)
    const history = await prisma.activityLog.findMany({
      where: {
        requestId,
        organizationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return history;
  }
}

export const requestService = new RequestService();
