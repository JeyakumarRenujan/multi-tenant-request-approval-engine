import { Role, RequestCategory, RequestPriority } from '@prisma/client';
import { getTenantScope, assertTenantAccess, validateClientBelongsToOrg } from '../utils/tenantScope';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';
import { AuthenticatedUser } from '../types/express';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';

describe('Tenant Scoping & Isolation (Rules #1, #2, #3)', () => {
  const org1User: AuthenticatedUser = {
    id: 'u-1',
    email: 'admin@org1.com',
    name: 'Org 1 Admin',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
    clientId: null,
    isActive: true,
  };

  const clientUser: AuthenticatedUser = {
    id: 'u-2',
    email: 'client@org1.com',
    name: 'Client User',
    role: Role.CLIENT_USER,
    organizationId: 'org-1',
    clientId: 'client-10',
    isActive: true,
  };

  const platformAdmin: AuthenticatedUser = {
    id: 'u-super',
    email: 'root@platform.com',
    name: 'Root Admin',
    role: Role.PLATFORM_ADMIN,
    organizationId: null,
    clientId: null,
    isActive: true,
  };

  describe('getTenantScope', () => {
    it('scopes ORG_ADMIN strictly to their organizationId', () => {
      const scope = getTenantScope(org1User);
      expect(scope).toEqual({ organizationId: 'org-1' });
    });

    it('scopes CLIENT_USER strictly to both organizationId and clientId', () => {
      const scope = getTenantScope(clientUser);
      expect(scope).toEqual({ organizationId: 'org-1', clientId: 'client-10' });
    });

    it('allows PLATFORM_ADMIN global scope when no organization is bound', () => {
      const scope = getTenantScope(platformAdmin);
      expect(scope).toEqual({});
    });

    it('throws UnauthorizedError if user is not passed', () => {
      expect(() => getTenantScope(undefined)).toThrow(UnauthorizedError);
    });
  });

  describe('assertTenantAccess (Rule #3: Anti-enumeration 404)', () => {
    const org1Record = {
      id: 'req-1',
      organizationId: 'org-1',
      clientId: 'client-10',
      title: 'Valid Request',
    };

    const org2Record = {
      id: 'req-99',
      organizationId: 'org-2',
      clientId: 'client-99',
      title: 'Foreign Tenant Request',
    };

    it('allows access to records within the same tenant', () => {
      const result = assertTenantAccess(org1Record, org1User, 'Request');
      expect(result).toBe(org1Record);
    });

    it('throws 404 NotFoundError (NOT 403) when accessing cross-tenant record', () => {
      expect(() => {
        assertTenantAccess(org2Record, org1User, 'Request');
      }).toThrow(NotFoundError);

      try {
        assertTenantAccess(org2Record, org1User, 'Request');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('throws 404 NotFoundError if client user accesses a different client within the same org', () => {
      const otherClientRecord = {
        id: 'req-3',
        organizationId: 'org-1',
        clientId: 'client-20', // different client
      };

      expect(() => {
        assertTenantAccess(otherClientRecord, clientUser, 'Request');
      }).toThrow(NotFoundError);
    });

    it('throws 404 NotFoundError if record is null/undefined', () => {
      expect(() => {
        assertTenantAccess(null, org1User, 'Request');
      }).toThrow(NotFoundError);
    });

    it('allows PLATFORM_ADMIN to access cross-tenant records', () => {
      const result = assertTenantAccess(org2Record, platformAdmin, 'Request');
      expect(result).toBe(org2Record);
    });
  });

  describe('Database & Service Level Constraints (Hardening Check)', () => {
    let orgAId: string;
    let orgBId: string;
    let clientAId: string;
    let clientBId: string;
    let userAId: string;

    beforeAll(async () => {
      const orgA = await prisma.organization.create({ data: { name: 'Org A' } });
      const orgB = await prisma.organization.create({ data: { name: 'Org B' } });
      orgAId = orgA.id;
      orgBId = orgB.id;

      const clientA = await prisma.client.create({
        data: { name: 'Client A Corp', organizationId: orgAId },
      });
      const clientB = await prisma.client.create({
        data: { name: 'Client B Corp', organizationId: orgBId },
      });
      clientAId = clientA.id;
      clientBId = clientB.id;

      const pwdHash = await hashPassword('password123');
      const userA = await prisma.user.create({
        data: {
          email: `usera.${Date.now()}@orga.com`,
          passwordHash: pwdHash,
          name: 'User A',
          role: Role.ORG_ADMIN,
          organizationId: orgAId,
        },
      });
      userAId = userA.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: userAId } });
      await prisma.client.deleteMany({ where: { id: { in: [clientAId, clientBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await prisma.$disconnect();
    });

    it('validateClientBelongsToOrg returns client when client belongs to org', async () => {
      const result = await validateClientBelongsToOrg(prisma, clientAId, orgAId);
      expect(result.id).toBe(clientAId);
      expect(result.organizationId).toBe(orgAId);
    });

    it('validateClientBelongsToOrg throws 404 NotFoundError when client belongs to another org (Rule #3)', async () => {
      await expect(validateClientBelongsToOrg(prisma, clientBId, orgAId)).rejects.toThrow(NotFoundError);
    });

    it('database composite foreign key prevents inserting a Request with mismatched client and org', async () => {
      // Trying to create a request for Org A, but pointing to Client B (from Org B)
      await expect(
        prisma.request.create({
          data: {
            title: 'Illegal Cross-Tenant Request',
            description: 'Should fail at DB level',
            category: RequestCategory.GENERAL,
            priority: RequestPriority.MEDIUM,
            organizationId: orgAId,
            clientId: clientBId, // From Org B!
            ownerId: userAId,
          },
        })
      ).rejects.toThrow();
    });

    it('database CHECK constraint prevents creating a non-PLATFORM_ADMIN user without an organizationId', async () => {
      const pwdHash = await hashPassword('password123');
      await expect(
        prisma.user.create({
          data: {
            email: `illegal.${Date.now()}@no-org.com`,
            passwordHash: pwdHash,
            name: 'No Org Admin',
            role: Role.ORG_ADMIN,
            organizationId: null, // Illegal for ORG_ADMIN
          },
        })
      ).rejects.toThrow();
    });
  });
});
