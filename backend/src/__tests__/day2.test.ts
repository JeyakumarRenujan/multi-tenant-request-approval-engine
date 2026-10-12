import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { generateAccessToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { Role, RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';

describe('Day 2: Multi-Tenant CRUD, Role Permissions & Validation Tests', () => {
  // IDs & Tokens
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
  let orgBDevToken: string;

  let orgAAdminId: string;
  let orgAManagerId: string;
  let orgADevId: string;
  let orgAClientUser1Id: string;
  let orgAClientUser2Id: string;
  let orgBManagerId: string;
  let orgBDevId: string;

  beforeAll(async () => {
    const dummyHash = await hashPassword('Password123!');

    // 1. Create Organizations
    const orgA = await prisma.organization.create({ data: { name: 'Day 2 Org A' } });
    const orgB = await prisma.organization.create({ data: { name: 'Day 2 Org B' } });
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
        email: `plat.${Date.now()}@platform.com`,
        passwordHash: dummyHash,
        name: 'Platform Admin',
        role: Role.PLATFORM_ADMIN,
        organizationId: null,
      },
    });
    platformAdminToken = generateAccessToken({
      userId: uPlat.id,
      email: uPlat.email,
      role: Role.PLATFORM_ADMIN,
      organizationId: null,
    });

    // Org A Admin
    const uAAdmin = await prisma.user.create({
      data: {
        email: `admin.a.${Date.now()}@orga.com`,
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
        email: `mgr.a.${Date.now()}@orga.com`,
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
        email: `dev.a.${Date.now()}@orga.com`,
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
        email: `c1.a.${Date.now()}@client1.com`,
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
        email: `c2.a.${Date.now()}@client2.com`,
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
        email: `mgr.b.${Date.now()}@orgb.com`,
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

    // Org B Developer
    const uBDev = await prisma.user.create({
      data: {
        email: `dev.b.${Date.now()}@orgb.com`,
        passwordHash: dummyHash,
        name: 'Org B Developer',
        role: Role.DEVELOPER,
        organizationId: orgBId,
      },
    });
    orgBDevId = uBDev.id;
    orgBDevToken = generateAccessToken({
      userId: uBDev.id,
      email: uBDev.email,
      role: Role.DEVELOPER,
      organizationId: orgBId,
    });
  });

  afterAll(async () => {
    // Teardown test data in correct order respecting onDelete: Restrict
    await prisma.activityLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.request.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            orgAAdminId,
            orgAManagerId,
            orgADevId,
            orgAClientUser1Id,
            orgAClientUser2Id,
            orgBManagerId,
            orgBDevId,
          ],
        },
      },
    });
    await prisma.client.deleteMany({
      where: { id: { in: [clientA1Id, clientA2Id, clientB1Id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.$disconnect();
  });

  describe('1. Zod Validation (Requirement #1)', () => {
    it('returns 400 with structured error details when request body is invalid', async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Hi', // too short (<3)
          description: 'No', // too short (<5)
          category: 'INVALID_CATEGORY',
          priority: 'INVALID_PRIORITY',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Validation error');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(4);
    });

    it('returns 400 when invalid UUID is provided in path params', async () => {
      const res = await request(app)
        .get('/clients/not-a-uuid')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.details[0].field).toBe('id');
    });
  });

  describe('2. Platform Admin Restrictions & Organizations (Requirement #2)', () => {
    it('PLATFORM_ADMIN can create and list organizations', async () => {
      const createRes = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: 'Platform Created Org' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.organization.name).toBe('Platform Created Org');

      const listRes = await request(app)
        .get('/organizations')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.organizations)).toBe(true);
    });

    it('PLATFORM_ADMIN receives 403 Forbidden on requests route', async () => {
      const res = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('PLATFORM_ADMIN receives 403 Forbidden on clients route', async () => {
      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Users and Clients - ORG_ADMIN Management (Requirement #3)', () => {
    it('client user cannot list clients (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('developer cannot list or create clients (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${orgADevToken}`)
        .send({ name: 'Illegal Client' });

      expect(res.status).toBe(403);
    });

    it('ORG_ADMIN cannot create PLATFORM_ADMIN users (400 / 403)', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          email: 'illegal.admin@platform.com',
          password: 'Password123!',
          name: 'Fake Platform Admin',
          role: 'PLATFORM_ADMIN',
        });

      expect([400, 403]).toContain(res.status);
    });

    it('ORG_ADMIN creating CLIENT_USER must link to a client in the same organization', async () => {
      // Trying to link to Client B1 (belonging to Org B) -> 404
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          email: `cross.client.${Date.now()}@test.com`,
          password: 'Password123!',
          name: 'Cross Client User',
          role: Role.CLIENT_USER,
          clientId: clientB1Id,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. Cross-Tenant Isolation & Anti-Enumeration 404 (Requirement #4 & Rules)', () => {
    let orgARequestId: string;

    beforeAll(async () => {
      // Create request in Org A by Client User 1
      const reqRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Org A Secret Project',
          description: 'Top secret specification',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
        });

      expect(reqRes.status).toBe(201);
      orgARequestId = reqRes.body.request.id;
    });

    it('Org B user cannot read Org A request by guessed ID (returns 404, NOT 403)', async () => {
      const res = await request(app)
        .get(`/requests/${orgARequestId}`)
        .set('Authorization', `Bearer ${orgBManagerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Org B user cannot update Org A request by guessed ID (returns 404, NOT 403)', async () => {
      const res = await request(app)
        .patch(`/requests/${orgARequestId}`)
        .set('Authorization', `Bearer ${orgBManagerToken}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Org B manager cannot assign an Org A developer (returns 404)', async () => {
      // Org B creates their own request first
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgBManagerToken}`)
        .send({
          title: 'Org B Valid Request',
          description: 'Valid description',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.MEDIUM,
          clientId: clientB1Id,
        });

      const orgBRequestId = createRes.body.request.id;

      // Org B manager attempts to assign Org A developer to Org B request
      const assignRes = await request(app)
        .patch(`/requests/${orgBRequestId}/assign`)
        .set('Authorization', `Bearer ${orgBManagerToken}`)
        .send({ assigneeId: orgADevId });

      expect(assignRes.status).toBe(404);
      expect(assignRes.body.error.code).toBe('NOT_FOUND');
      expect(assignRes.body.error.message).toMatch(/Developer not found/i);
    });
  });

  describe('5. Visibility Rules (Requirement #5)', () => {
    let reqClient1Id: string;
    let reqClient2Id: string;

    beforeAll(async () => {
      // Request for Client A1
      const res1 = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Client A1 Portal Request',
          description: 'Detailed description for client A1',
          category: RequestCategory.SUPPORT,
          priority: RequestPriority.LOW,
        });
      reqClient1Id = res1.body.request.id;

      // Request for Client A2
      const res2 = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser2Token}`)
        .send({
          title: 'Client A2 Portal Request',
          description: 'Detailed description for client A2',
          category: RequestCategory.BUG_FIX,
          priority: RequestPriority.URGENT,
        });
      reqClient2Id = res2.body.request.id;
    });

    it('client user cannot see another client requests in list query', async () => {
      const res = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(200);
      const requestIds = res.body.data.map((r: any) => r.id);
      expect(requestIds).toContain(reqClient1Id);
      expect(requestIds).not.toContain(reqClient2Id);
    });

    it('client user cannot get another client request by ID (returns 404)', async () => {
      const res = await request(app)
        .get(`/requests/${reqClient2Id}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('developer cannot assign requests (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/requests/${reqClient1Id}/assign`)
        .set('Authorization', `Bearer ${orgADevToken}`)
        .send({ assigneeId: orgADevId });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('developer only sees requests assigned to them', async () => {
      // Initially, reqClient1Id is unassigned -> developer should not see it
      const unassignedList = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${orgADevToken}`);

      const unassignedIds = unassignedList.body.data.map((r: any) => r.id);
      expect(unassignedIds).not.toContain(reqClient1Id);

      // Manager assigns reqClient1Id to Developer
      await request(app)
        .patch(`/requests/${reqClient1Id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId });

      // Now developer can see reqClient1Id
      const assignedList = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${orgADevToken}`);

      const assignedIds = assignedList.body.data.map((r: any) => r.id);
      expect(assignedIds).toContain(reqClient1Id);
    });

    it('draft request can only be edited by the creator', async () => {
      // Manager attempts to edit draft created by Client User 1 -> 403
      const mgrEditRes = await request(app)
        .patch(`/requests/${reqClient1Id}`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ title: 'Manager Modified Title' });

      expect(mgrEditRes.status).toBe(403);
      expect(mgrEditRes.body.error.code).toBe('FORBIDDEN');

      // Creator edits draft -> 200
      const creatorEditRes = await request(app)
        .patch(`/requests/${reqClient1Id}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({ title: 'Creator Updated Title' });

      expect(creatorEditRes.status).toBe(200);
      expect(creatorEditRes.body.request.title).toBe('Creator Updated Title');
    });
  });

  describe('6. Overdue Filter (Requirement #4 & #7)', () => {
    let overdueReqId: string;
    let futureReqId: string;
    let completedPastReqId: string;

    beforeAll(async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      // 1. Overdue: past due date + PENDING status
      const r1 = await prisma.request.create({
        data: {
          title: 'Overdue Pending Request',
          description: 'Past due date and pending',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.HIGH,
          dueDate: pastDate,
          status: RequestStatus.PENDING,
          ownerId: orgAAdminId,
          organizationId: orgAId,
          clientId: clientA1Id,
        },
      });
      overdueReqId = r1.id;

      // 2. Not overdue: future due date
      const r2 = await prisma.request.create({
        data: {
          title: 'Future Pending Request',
          description: 'Future due date and pending',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.LOW,
          dueDate: futureDate,
          status: RequestStatus.PENDING,
          ownerId: orgAAdminId,
          organizationId: orgAId,
          clientId: clientA1Id,
        },
      });
      futureReqId = r2.id;

      // 3. Not overdue: past due date but COMPLETED
      const r3 = await prisma.request.create({
        data: {
          title: 'Completed Past Request',
          description: 'Past due date but completed',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.MEDIUM,
          dueDate: pastDate,
          status: RequestStatus.COMPLETED,
          ownerId: orgAAdminId,
          organizationId: orgAId,
          clientId: clientA1Id,
        },
      });
      completedPastReqId = r3.id;
    });

    it('overdue=true filter returns only the overdue requests', async () => {
      const res = await request(app)
        .get('/requests?overdue=true')
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((r: any) => r.id);

      expect(returnedIds).toContain(overdueReqId);
      expect(returnedIds).not.toContain(futureReqId);
      expect(returnedIds).not.toContain(completedPastReqId);
    });
  });
});
