import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';
import { Role } from '@prisma/client';

describe('Auth Endpoints Integration Tests', () => {
  let testOrgId: string;
  let testUserId: string;
  const testEmail = `test.user.${Date.now()}@example.com`;
  const rawPassword = 'SecurePassword123!';

  beforeAll(async () => {
    // Setup test organization and user
    const org = await prisma.organization.create({
      data: {
        name: 'Test Auth Org',
      },
    });
    testOrgId = org.id;

    const passwordHash = await hashPassword(rawPassword);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: 'Test Auth User',
        role: Role.ORG_ADMIN,
        organizationId: testOrgId,
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
    await prisma.$disconnect();
  });

  describe('POST /auth/login', () => {
    it('returns access token, refresh token, and user profile on valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: rawPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toMatchObject({
        id: testUserId,
        email: testEmail,
        role: Role.ORG_ADMIN,
        organizationId: testOrgId,
      });
    });

    it('returns 401 when password is wrong', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when email or password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testEmail });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /auth/refresh', () => {
    let initialRefreshToken: string;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: rawPassword });
      initialRefreshToken = loginRes.body.refreshToken;
    });

    it('rotates refresh token and returns new access & refresh tokens', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(initialRefreshToken);
    });

    it('rejects reuse of already rotated (revoked) refresh token with 401', async () => {
      // First rotation
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      // Second attempt using the now-revoked initial token
      const replayRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes refresh token and renders it unusable', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: rawPassword });
      const refreshToken = loginRes.body.refreshToken;

      const logoutRes = await request(app)
        .post('/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // Attempting to use the logged-out refresh token should now fail
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns { id, name, email, role, organizationId, clientId } for the authenticated user and never includes passwordHash', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: rawPassword });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.accessToken;

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Verify profile properties are present
      expect(res.body.id).toBe(testUserId);
      expect(res.body.name).toBe('Test Auth User');
      expect(res.body.email).toBe(testEmail);
      expect(res.body.role).toBe(Role.ORG_ADMIN);
      expect(res.body.organizationId).toBe(testOrgId);
      expect(res.body.clientId).toBeNull();

      expect(res.body.user.id).toBe(testUserId);
      expect(res.body.user.name).toBe('Test Auth User');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe(Role.ORG_ADMIN);
      expect(res.body.user.organizationId).toBe(testOrgId);
      expect(res.body.user.clientId).toBeNull();

      // Security requirement: never includes passwordHash
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 401 when token is missing', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authentication & Inactive Account Enforcement (Requirement #4)', () => {
    it('blocks a user with isActive=false even if they present a still-valid access token', async () => {
      // 1. Authenticate to obtain a valid access token while user is active
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: rawPassword });

      expect(loginRes.status).toBe(200);
      const validAccessToken = loginRes.body.accessToken;

      // 2. Verify that the access token works on a protected route while active
      const activeRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.user.id).toBe(testUserId);

      // 3. Deactivate the user in the database (simulating immediate admin deactivation)
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: false },
      });

      // 4. Attempt to access the protected route with the still-valid token
      const inactiveRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      // Must be rejected with 401 UNAUTHORIZED
      expect(inactiveRes.status).toBe(401);
      expect(inactiveRes.body.error.code).toBe('UNAUTHORIZED');
      expect(inactiveRes.body.error.message).toMatch(/inactive/i);

      // 5. Restore user to active state for clean test teardown
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: true },
      });
    });
  });
});
