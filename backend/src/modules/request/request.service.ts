import { Prisma, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedUser } from '../../types/express';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/AppError';
import {
  CreateRequestInput,
  UpdateRequestInput,
  RequestQueryInput,
} from './request.schema';

export class RequestService {
  /**
   * Helper to derive the strict visibility where clause based on tenant role.
   *
   * Rules:
   * - CLIENT_USER: only requests of their own clientId.
   * - DEVELOPER: only requests assigned to them.
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
    // 1. Base visibility filter
    const baseWhere = this.getVisibilityWhere(user);

    // 2. Build combined where clause
    const where: Prisma.RequestWhereInput = {
      ...baseWhere,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.assigneeId) {
      // If user is a DEVELOPER, their visibility is already restricted to their own assigneeId
      if (user.role !== Role.DEVELOPER) {
        where.assigneeId = query.assigneeId;
      }
    }

    if (query.search) {
      where.title = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    // Overdue filter: dueDate < now AND status NOT IN (COMPLETED, REJECTED)
    if (query.overdue === true) {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        notIn: [RequestStatus.COMPLETED, RequestStatus.REJECTED],
      };
    } else if (query.overdue === false) {
      where.OR = [
        { dueDate: null },
        { dueDate: { gte: new Date() } },
        { status: { in: [RequestStatus.COMPLETED, RequestStatus.REJECTED] } },
      ];
    }

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

    // Visibility Check for DEVELOPER: only assigned requests
    if (user.role === Role.DEVELOPER && request.assigneeId !== user.id) {
      throw new NotFoundError('Request not found');
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

    const dataToUpdate: any = {
      version: { increment: 1 },
    };

    if (input.title !== undefined) dataToUpdate.title = input.title.trim();
    if (input.description !== undefined) dataToUpdate.description = input.description.trim();
    if (input.category !== undefined) dataToUpdate.category = input.category;
    if (input.priority !== undefined) dataToUpdate.priority = input.priority;
    if (input.dueDate !== undefined) {
      dataToUpdate.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: dataToUpdate,
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;
  }

  async assignRequest(user: AuthenticatedUser, requestId: string, assigneeId: string) {
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

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        assigneeId: developer.id,
        version: { increment: 1 },
      },
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Log the assignment event in ActivityLog
    await prisma.activityLog.create({
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
        },
      },
    });

    return updated;
  }
}

export const requestService = new RequestService();
