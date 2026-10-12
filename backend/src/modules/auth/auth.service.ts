import { prisma } from '../../config/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/token';
import {
  BadRequestError,
  UnauthorizedError,
} from '../../errors/AppError';

export class AuthService {
  /**
   * Authenticates user credentials and issues access & refresh tokens.
   */
  async login(email?: string, password?: string) {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Use generic error message to prevent user enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 1. Short-lived Access Token (15 min)
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
    });

    // 2. Long-lived Refresh Token (7 days)
    const { token: rawRefreshToken, expiresAt } = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    // Store only the hashed refresh token in DB
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        clientId: user.clientId,
      },
    };
  }

  /**
   * Rotates refresh tokens and issues a new access token.
   * If a revoked or invalid token is supplied, access is denied.
   */
  async refresh(rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse detection: if a revoked token is presented, reject immediately
    if (existingToken.revokedAt) {
      throw new UnauthorizedError('Refresh token has already been revoked');
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = existingToken.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account is deactivated or deleted');
    }

    // Rotate: Revoke old token and issue a fresh one
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
    });

    const { token: newRawRefreshToken, expiresAt } = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Revokes the specified refresh token upon logout.
   */
  async logout(rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      // Logout is idempotent: even if no token provided, return success
      return { message: 'Logged out successfully' };
    }

    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { message: 'Logged out successfully' };
  }
}

export const authService = new AuthService();

