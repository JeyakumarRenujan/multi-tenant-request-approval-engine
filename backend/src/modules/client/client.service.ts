import { prisma } from '../../config/prisma';
import { AuthenticatedUser } from '../../types/express';
import { NotFoundError } from '../../errors/AppError';

export class ClientService {
  async createClient(user: AuthenticatedUser, name: string) {
    const organizationId = user.organizationId!;

    return prisma.client.create({
      data: {
        name: name.trim(),
        organizationId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
      },
    });
  }

  async getClients(user: AuthenticatedUser) {
    const organizationId = user.organizationId!;

    return prisma.client.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            requests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientById(user: AuthenticatedUser, clientId: string) {
    const organizationId = user.organizationId!;

    // Enforce Rule #3: Cross-tenant access returns 404
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    return client;
  }

  async updateClient(user: AuthenticatedUser, clientId: string, name: string) {
    // Verify client exists and belongs to user's organization (throws 404 if cross-tenant)
    await this.getClientById(user, clientId);

    return prisma.client.update({
      where: { id: clientId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
      },
    });
  }
}

export const clientService = new ClientService();
