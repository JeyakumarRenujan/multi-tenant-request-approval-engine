import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types/express';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';

export interface TenantScopeFilter {
  organizationId?: string;
  clientId?: string;
}

/**
 * Derives the tenant query filter strictly from the verified authenticated user context.
 *
 * Rule #1: Never trust organizationId or role from req.body or req.params.
 * Rule #2: Every tenant-owned query must be scoped by organizationId.
 *          Client users (CLIENT_USER) are additionally scoped by clientId.
 */
export function getTenantScope(user?: AuthenticatedUser): TenantScopeFilter {
  if (!user) {
    throw new UnauthorizedError('User authentication required for tenant operations');
  }

  // Platform Admins can optionally view across all tenants or an assigned one
  if (user.role === Role.PLATFORM_ADMIN) {
    return user.organizationId ? { organizationId: user.organizationId } : {};
  }

  // Tenant members (ORG_ADMIN, MANAGER, DEVELOPER, CLIENT_USER) MUST have an organizationId
  if (!user.organizationId) {
    throw new NotFoundError('Organization not found');
  }

  const scope: TenantScopeFilter = {
    organizationId: user.organizationId,
  };

  // CLIENT_USER is strictly bound to their assigned client company
  if (user.role === Role.CLIENT_USER) {
    if (!user.clientId) {
      throw new NotFoundError('Client entity not found');
    }
    scope.clientId = user.clientId;
  }

  return scope;
}

/**
 * Asserts that a retrieved record belongs to the user's tenant.
 *
 * Rule #3: Cross-tenant access returns 404 Not Found (NEVER 403 Forbidden)
 * so attackers cannot infer the existence of records belonging to other tenants.
 */
export function assertTenantAccess<T extends { organizationId?: string | null; clientId?: string | null }>(
  record: T | null | undefined,
  user: AuthenticatedUser,
  resourceName = 'Resource'
): T {
  if (!record) {
    throw new NotFoundError(`${resourceName} not found`);
  }

  // Platform Admin bypasses tenant isolation unless explicitly restricted
  if (user.role === Role.PLATFORM_ADMIN) {
    return record;
  }

  // Check organization boundary: if record doesn't match user's org, return 404 (Not Found)
  if (record.organizationId !== user.organizationId) {
    throw new NotFoundError(`${resourceName} not found`);
  }

  // Check client boundary for CLIENT_USER: if client doesn't match, return 404 (Not Found)
  if (user.role === Role.CLIENT_USER && record.clientId && record.clientId !== user.clientId) {
    throw new NotFoundError(`${resourceName} not found`);
  }

  return record;
}

/**
 * Validates that a Client belongs to the given Organization.
 * Enforces Rule #3: Returns 404 NotFoundError if the client does not exist
 * or belongs to a different organization, preventing cross-tenant leakage.
 */
export async function validateClientBelongsToOrg(
  prismaClient: any,
  clientId: string,
  organizationId: string
) {
  const client = await prismaClient.client.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  return client;
}

