import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import { config } from '../config/env';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: Role;
  organizationId?: string | null;
  clientId?: string | null;
}

/**
 * Generates a short-lived (15 minutes) signed JWT access token.
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies a JWT access token and extracts the payload.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

/**
 * Generates an opaque, cryptographically random refresh token string and calculates its expiration date (7 days).
 */
export function generateRefreshToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshExpiresDays);

  return { token, expiresAt };
}

/**
 * Computes a SHA-256 hash of a token string for safe storage in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

