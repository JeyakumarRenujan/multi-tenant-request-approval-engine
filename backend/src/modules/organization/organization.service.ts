import { prisma } from '../../config/prisma';

export class OrganizationService {
  async createOrganization(name: string) {
    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
      },
    });
    return org;
  }

  async getOrganizations() {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
  }
}

export const organizationService = new OrganizationService();
