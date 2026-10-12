import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { generateAccessToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { Role, RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';
import { config } from '../config/env';

describe('Day 4 Part A: Dashboard Metrics, isOverdue Read-Time Logic, Swagger & Security', () => {
  let orgAId: string;
  let orgBId: string;
  let clientA1Id: string;
  let clientA2Id: string;
  let clientB1Id: string;

  let platformAdminToken: string;
  let orgAAdminToken: string;
  let orgAManagerToken: string;
  let orgADevToken: string;
  let orgAClientUser1Token: string;
  let orgAClientUser2Token: string;
  let orgBManagerToken: string;

  let platformAdminId: string;
  let orgAAdminId: string;
  let orgAManagerId: string;
  let orgADevId: string;
  let orgAClientUser1Id: string;
  let orgAClientUser2Id: string;
  let orgBManagerId: string;

  let overdueSubmittedReqId: string;
  let completedPastDueReqId: string;

  beforeAll(async () => {
    const dummyHash = await hashPassword('Password123!');
    const timestamp = Date.now();

    // 1. Create Organizations
    const orgA = await prisma.organization.create({ data: { name: `Day 4 Org A ${timestamp}` } });
    const orgB = await prisma.organization.create({ data: { name: `Day 4 Org B ${timestamp}` } });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // 2. Create Clients
    const cA1 = await prisma.client.create({ data: { name: 'Client A1', organizationId: orgAId } });
    const cA2 = await prisma.client.create({ data: { name: 'Client A2', organizationId: orgAId } });
    const cB1 = await prisma.client.create({ data: { name: 'Client B1', organizationId: orgBId } });
    clientA1Id = cA1.id;
    clientA2Id = cA2.id;
    clientB1Id = cB1.id;

    // 3. Create Users
    // Platform Admin
    const uPlat = await prisma.user.create({
      data: {
        email: `plat.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Platform Admin',
        role: Role.PLATFORM_ADMIN,
        organizationId: null,
      },
    });
    platformAdminId = uPlat.id;
    platformAdminToken = generateAccessToken({
      userId: uPlat.id,
      email: uPlat.email,
      role: Role.PLATFORM_ADMIN,
      organizationId: null,
    });

    // Org A Admin
    const uAAdmin = await prisma.user.create({
      data: {
        email: `admin.a.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org A Admin',
        role: Role.ORG_ADMIN,
        organizationId: orgAId,
      },
    });
    orgAAdminId = uAAdmin.id;
    orgAAdminToken = generateAccessToken({
      userId: uAAdmin.id,
      email: uAAdmin.email,
      role: Role.ORG_ADMIN,
      organizationId: orgAId,
    });

    // Org A Manager
    const uAMgr = await prisma.user.create({
      data: {
        email: `mgr.a.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org A Manager',
        role: Role.MANAGER,
        organizationId: orgAId,
      },
    });
    orgAManagerId = uAMgr.id;
    orgAManagerToken = generateAccessToken({
      userId: uAMgr.id,
      email: uAMgr.email,
      role: Role.MANAGER,
      organizationId: orgAId,
    });

    // Org A Developer
    const uADev = await prisma.user.create({
      data: {
        email: `dev.a.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org A Developer',
        role: Role.DEVELOPER,
        organizationId: orgAId,
      },
    });
    orgADevId = uADev.id;
    orgADevToken = generateAccessToken({
      userId: uADev.id,
      email: uADev.email,
      role: Role.DEVELOPER,
      organizationId: orgAId,
    });

    // Org A Client User 1 (Client A1)
    const uAC1 = await prisma.user.create({
      data: {
        email: `c1.a.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org A Client User 1',
        role: Role.CLIENT_USER,
        organizationId: orgAId,
        clientId: clientA1Id,
      },
    });
    orgAClientUser1Id = uAC1.id;
    orgAClientUser1Token = generateAccessToken({
      userId: uAC1.id,
      email: uAC1.email,
      role: Role.CLIENT_USER,
      organizationId: orgAId,
      clientId: clientA1Id,
    });

    // Org A Client User 2 (Client A2)
    const uAC2 = await prisma.user.create({
      data: {
        email: `c2.a.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org A Client User 2',
        role: Role.CLIENT_USER,
        organizationId: orgAId,
        clientId: clientA2Id,
      },
    });
    orgAClientUser2Id = uAC2.id;
    orgAClientUser2Token = generateAccessToken({
      userId: uAC2.id,
      email: uAC2.email,
      role: Role.CLIENT_USER,
      organizationId: orgAId,
      clientId: clientA2Id,
    });

    // Org B Manager
    const uBMgr = await prisma.user.create({
      data: {
        email: `mgr.b.${timestamp}@day4.com`,
        passwordHash: dummyHash,
        name: 'Org B Manager',
        role: Role.MANAGER,
        organizationId: orgBId,
      },
    });
    orgBManagerId = uBMgr.id;
    orgBManagerToken = generateAccessToken({
      userId: uBMgr.id,
      email: uBMgr.email,
      role: Role.MANAGER,
      organizationId: orgBId,
    });

    // 4. Create requests with distinct statuses, priorities, and dueDates
    const pastDueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const futureDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days in future

    // Request 1: Org A, Client A1, DRAFT, HIGH, future
    await prisma.request.create({
      data: {
        title: 'Req 1 Draft Future',
        description: 'Draft request with future dueDate',
        category: RequestCategory.FEATURE_REQUEST,
        priority: RequestPriority.HIGH,
        status: RequestStatus.DRAFT,
        dueDate: futureDueDate,
        organizationId: orgAId,
        clientId: clientA1Id,
        ownerId: orgAClientUser1Id,
        version: 1,
      },
    });

    // Request 2: Org A, Client A1, SUBMITTED, MEDIUM, past (OVERDUE!)
    const r2 = await prisma.request.create({
      data: {
        title: 'Req 2 Submitted Past',
        description: 'Submitted request with past dueDate',
        category: RequestCategory.BUG_FIX,
        priority: RequestPriority.MEDIUM,
        status: RequestStatus.SUBMITTED,
        dueDate: pastDueDate,
        organizationId: orgAId,
        clientId: clientA1Id,
        ownerId: orgAClientUser1Id,
        version: 2,
      },
    });
    overdueSubmittedReqId = r2.id;

    // Request 3: Org A, Client A1, IN_PROGRESS, URGENT, past, assigned to Dev A (OVERDUE!)
    await prisma.request.create({
      data: {
        title: 'Req 3 InProgress Past',
        description: 'In progress request with past dueDate',
        category: RequestCategory.ACCESS_REQUEST,
        priority: RequestPriority.URGENT,
        status: RequestStatus.IN_PROGRESS,
        dueDate: pastDueDate,
        organizationId: orgAId,
        clientId: clientA1Id,
        ownerId: orgAClientUser1Id,
        assigneeId: orgADevId,
        version: 5,
      },
    });

    // Request 4: Org A, Client A1, COMPLETED, LOW, past, assigned to Dev A (NOT OVERDUE because COMPLETED)
    const r4 = await prisma.request.create({
      data: {
        title: 'Req 4 Completed Past',
        description: 'Completed request with past dueDate',
        category: RequestCategory.SUPPORT,
        priority: RequestPriority.LOW,
        status: RequestStatus.COMPLETED,
        dueDate: pastDueDate,
        organizationId: orgAId,
        clientId: clientA1Id,
        ownerId: orgAClientUser1Id,
        assigneeId: orgADevId,
        version: 7,
      },
    });
    completedPastDueReqId = r4.id;

    // Request 5: Org A, Client A2, UNDER_REVIEW, HIGH, future
    await prisma.request.create({
      data: {
        title: 'Req 5 Client A2 Under Review',
        description: 'Client A2 request with future dueDate',
        category: RequestCategory.FEATURE_REQUEST,
        priority: RequestPriority.HIGH,
        status: RequestStatus.UNDER_REVIEW,
        dueDate: futureDueDate,
        organizationId: orgAId,
        clientId: clientA2Id,
        ownerId: orgAClientUser2Id,
        version: 2,
      },
    });

    // Request 6: Org B, Client B1, APPROVED, URGENT, future
    await prisma.request.create({
      data: {
        title: 'Req 6 Org B Approved',
        description: 'Org B request',
        category: RequestCategory.GENERAL,
        priority: RequestPriority.URGENT,
        status: RequestStatus.APPROVED,
        dueDate: futureDueDate,
        organizationId: orgBId,
        clientId: clientB1Id,
        ownerId: orgBManagerId,
        version: 3,
      },
    });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.request.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: platformAdminId },
    });
    await prisma.client.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
  });

  describe('1. Dashboard Metrics Endpoint (GET /dashboard)', () => {
    it('PLATFORM_ADMIN receives 403 Forbidden', async () => {
      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('MANAGER sees entire organization counts across all clients', async () => {
      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      const { byStatus, byPriority, overdue, total } = res.body;

      // 5 requests total in Org A (Req 1, 2, 3, 4, 5)
      expect(total).toBe(5);

      // byStatus includes all enums with zeros included
      expect(byStatus.DRAFT).toBe(1);
      expect(byStatus.SUBMITTED).toBe(1);
      expect(byStatus.UNDER_REVIEW).toBe(1);
      expect(byStatus.IN_PROGRESS).toBe(1);
      expect(byStatus.COMPLETED).toBe(1);
      expect(byStatus.APPROVED).toBe(0);
      expect(byStatus.REJECTED).toBe(0);
      expect(byStatus.PENDING).toBe(0);
      expect(byStatus.CANCELLED).toBe(0);

      // byPriority includes all enums with zeros included
      expect(byPriority.HIGH).toBe(2); // Req 1, Req 5
      expect(byPriority.MEDIUM).toBe(1); // Req 2
      expect(byPriority.URGENT).toBe(1); // Req 3
      expect(byPriority.LOW).toBe(1); // Req 4

      // overdue: Req 2 (SUBMITTED, past) + Req 3 (IN_PROGRESS, past). Req 4 is COMPLETED, so NOT overdue.
      expect(overdue).toBe(2);
    });

    it('CLIENT_USER only counts own client requests', async () => {
      // Client User 1 is tied to Client A1 (Req 1, 2, 3, 4). Cannot see Client A2 (Req 5).
      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(200);
      const { byStatus, byPriority, overdue, total } = res.body;

      expect(total).toBe(4);
      expect(byStatus.UNDER_REVIEW).toBe(0); // Req 5 is in Client A2
      expect(byStatus.DRAFT).toBe(1);
      expect(byStatus.SUBMITTED).toBe(1);
      expect(byStatus.IN_PROGRESS).toBe(1);
      expect(byStatus.COMPLETED).toBe(1);

      expect(byPriority.HIGH).toBe(1); // Req 1 (Req 5 is in Client A2)
      expect(overdue).toBe(2); // Req 2 and Req 3
    });

    it('DEVELOPER only counts assigned requests that are not in DRAFT', async () => {
      // Dev A is assigned to Req 3 (IN_PROGRESS) and Req 4 (COMPLETED).
      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${orgADevToken}`);

      expect(res.status).toBe(200);
      const { byStatus, byPriority, overdue, total } = res.body;

      expect(total).toBe(2);
      expect(byStatus.IN_PROGRESS).toBe(1);
      expect(byStatus.COMPLETED).toBe(1);
      expect(byStatus.DRAFT).toBe(0);
      expect(byStatus.SUBMITTED).toBe(0);

      expect(byPriority.URGENT).toBe(1); // Req 3
      expect(byPriority.LOW).toBe(1); // Req 4
      expect(overdue).toBe(1); // Req 3 is past due date; Req 4 is COMPLETED
    });

    it('Org B never sees Org A counts (strict tenant boundary)', async () => {
      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${orgBManagerToken}`);

      expect(res.status).toBe(200);
      const { byStatus, byPriority, overdue, total } = res.body;

      // Only Req 6 exists in Org B
      expect(total).toBe(1);
      expect(byStatus.APPROVED).toBe(1);
      expect(byStatus.DRAFT).toBe(0);
      expect(byStatus.SUBMITTED).toBe(0);
      expect(byPriority.URGENT).toBe(1);
      expect(byPriority.HIGH).toBe(0);
      expect(overdue).toBe(0);
    });
  });

  describe('2. Read-Time Computed isOverdue Field', () => {
    it('flags an overdue request with isOverdue=true on detail and list queries', async () => {
      // Detail response
      const detailRes = await request(app)
        .get(`/requests/${overdueSubmittedReqId}`)
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.request.id).toBe(overdueSubmittedReqId);
      expect(detailRes.body.request.isOverdue).toBe(true);

      // List response
      const listRes = await request(app)
        .get('/requests?search=Req 2 Submitted Past')
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].id).toBe(overdueSubmittedReqId);
      expect(listRes.body.data[0].isOverdue).toBe(true);
    });

    it('a COMPLETED request with a past due date has isOverdue=false', async () => {
      // Detail response
      const detailRes = await request(app)
        .get(`/requests/${completedPastDueReqId}`)
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.request.id).toBe(completedPastDueReqId);
      expect(detailRes.body.request.status).toBe(RequestStatus.COMPLETED);
      expect(detailRes.body.request.isOverdue).toBe(false);

      // List response
      const listRes = await request(app)
        .get('/requests?search=Req 4 Completed Past')
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].isOverdue).toBe(false);
    });
  });

  describe('3. Swagger Documentation & Security Headers', () => {
    it('serves Swagger documentation at /api-docs', async () => {
      const res = await request(app).get('/api-docs/');
      expect([200, 301, 302]).toContain(res.status);
    });

    it('enforces helmet security headers on responses', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('handles CORS policy restricted to FRONTEND_URL', async () => {
      const allowedOrigin = config.frontendUrl;

      const res = await request(app)
        .get('/health')
        .set('Origin', allowedOrigin);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });
  });
});
