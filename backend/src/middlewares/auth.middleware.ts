import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/token';
import { prisma } from '../config/prisma';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';

/**
 * Authentication middleware.
 * Verifies Bearer JWT, fetches fresh user state from the database, and attaches req.user.
 *
 * Enforces Rule #1: Role and tenant context are strictly loaded from DB/verified JWT.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token required');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid or corrupted access token');
    }

    // Always fetch fresh user state from the DB to verify current status and active state
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        clientId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account is inactive or no longer exists');
    }

    // Ensure non-PLATFORM_ADMIN users strictly have an organizationId
    if (user.role !== Role.PLATFORM_ADMIN && !user.organizationId) {
      throw new UnauthorizedError('Tenant user must belong to an organization');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Ensures the authenticated user possesses one of the authorized roles.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have sufficient permissions to perform this action'));
    }

    next();
  };
}

