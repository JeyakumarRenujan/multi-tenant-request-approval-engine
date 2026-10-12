import { Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedUser } from '../../types/express';
import { hashPassword } from '../../utils/password';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/AppError';
import { CreateUserInput, UpdateUserInput } from './user.schema';

export class UserService {
  async createUser(adminUser: AuthenticatedUser, input: CreateUserInput) {
    const organizationId = adminUser.organizationId!;

    // ORG_ADMIN cannot create PLATFORM_ADMIN users
    if ((input.role as any) === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Cannot create PLATFORM_ADMIN users');
    }

    // A CLIENT_USER must be linked to a client in the same organization
    let assignedClientId: string | null = null;
    if (input.role === Role.CLIENT_USER) {
      if (!input.clientId) {
        throw new BadRequestError('clientId is required for CLIENT_USER accounts');
      }

      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          organizationId,
        },
      });

      if (!client) {
        // Enforce Rule #3: 404 Not Found for missing or cross-tenant client
        throw new NotFoundError('Client not found');
      }

      assignedClientId = client.id;
    } else if (input.clientId) {
      // Internal staff roles must not have a clientId
      throw new BadRequestError('clientId is only applicable for CLIENT_USER accounts');
    }

    // Check duplicate email
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: input.name.trim(),
        role: input.role,
        organizationId,
        clientId: assignedClientId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        clientId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getUsers(adminUser: AuthenticatedUser) {
    const organizationId = adminUser.organizationId!;

    return prisma.user.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        clientId: true,
        isActive: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(adminUser: AuthenticatedUser, userId: string, input: UpdateUserInput) {
    const organizationId = adminUser.organizationId!;

    // Find target user strictly scoped to the same organization (Rule #3: 404 for cross-tenant)
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // ORG_ADMIN cannot deactivate or change the role of their own account
    if (adminUser.id === userId) {
      if (input.isActive !== undefined && input.isActive === false) {
        throw new BadRequestError('Administrators cannot deactivate their own account');
      }
      if (input.role !== undefined && input.role !== adminUser.role) {
        throw new BadRequestError('Administrators cannot change the role of their own account');
      }
    }

    // Cannot promote anyone to PLATFORM_ADMIN
    if ((input.role as any) === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Cannot promote user to PLATFORM_ADMIN');
    }

    const dataToUpdate: any = {};

    if (input.isActive !== undefined) {
      dataToUpdate.isActive = input.isActive;
    }

    // Determine target role
    const effectiveRole = input.role !== undefined ? input.role : targetUser.role;

    if (effectiveRole === Role.CLIENT_USER) {
      // Must have a valid clientId
      const clientIdToCheck = input.clientId !== undefined ? input.clientId : targetUser.clientId;
      if (!clientIdToCheck) {
        throw new BadRequestError('clientId is required for CLIENT_USER accounts');
      }

      const client = await prisma.client.findFirst({
        where: {
          id: clientIdToCheck,
          organizationId,
        },
      });

      if (!client) {
        throw new NotFoundError('Client not found');
      }

      dataToUpdate.clientId = client.id;
      if (input.role !== undefined) {
        dataToUpdate.role = input.role;
      }
    } else {
      if (input.role !== undefined) {
        dataToUpdate.role = input.role;
        dataToUpdate.clientId = null; // Clear clientId if changing from client user to internal staff
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        clientId: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}

export const userService = new UserService();
