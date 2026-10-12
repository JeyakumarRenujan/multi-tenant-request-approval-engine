import { Role } from '@prisma/client';
import { getTenantScope, assertTenantAccess } from '../utils/tenantScope';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';
import { AuthenticatedUser } from '../types/express';

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
});

