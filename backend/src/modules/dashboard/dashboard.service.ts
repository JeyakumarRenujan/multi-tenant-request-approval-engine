import { Prisma, RequestPriority, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthenticatedUser } from '../../types/express';
import { ForbiddenError } from '../../errors/AppError';
import { getRequestVisibilityWhere } from '../request/request.service';

export interface DashboardMetrics {
  byStatus: Record<RequestStatus, number>;
  byPriority: Record<RequestPriority, number>;
  overdue: number;
  total: number;
}

export class DashboardService {
  /**
   * Retrieves tenant-scoped metrics and counts.
   *
   * Visibility Rules:
   * Reuses the exact same visibility where clause from the requests service (getRequestVisibilityWhere)
   * to guarantee that dashboard metrics and request views never drift.
   * - CLIENT_USER: scoped strictly to their own client's requests
   * - DEVELOPER: scoped strictly to requests assigned to them and not in DRAFT
   * - MANAGER and ORG_ADMIN: scoped to their whole organization
   * - PLATFORM_ADMIN: 403 Forbidden
   *
   * Performance:
   * Uses database-level groupBy and count queries to aggregate directly inside PostgreSQL,
   * avoiding loading all rows into Node.js application memory.
   */
  async getDashboardMetrics(user: AuthenticatedUser): Promise<DashboardMetrics> {
    if (user.role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenError('Platform administrators cannot access tenant dashboard');
    }

    const baseWhere = getRequestVisibilityWhere(user);
    const now = new Date();

    const [statusGroups, priorityGroups, overdueCount, totalCount] = await Promise.all([
      prisma.request.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.request.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.request.count({
        where: {
          AND: [
            baseWhere,
            {
              dueDate: { lt: now },
              status: { notIn: [RequestStatus.COMPLETED, RequestStatus.REJECTED] },
            },
          ],
        },
      }),
      prisma.request.count({
        where: baseWhere,
      }),
    ]);

    // Build byStatus map with all RequestStatus enum keys initialized to 0
    const byStatus = Object.values(RequestStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<RequestStatus, number>);

    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    // Build byPriority map with all RequestPriority enum keys initialized to 0
    const byPriority = Object.values(RequestPriority).reduce((acc, priority) => {
      acc[priority] = 0;
      return acc;
    }, {} as Record<RequestPriority, number>);

    for (const group of priorityGroups) {
      byPriority[group.priority] = group._count._all;
    }

    return {
      byStatus,
      byPriority,
      overdue: overdueCount,
      total: totalCount,
    };
  }
}

export const dashboardService = new DashboardService();
