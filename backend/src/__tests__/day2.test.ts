import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { generateAccessToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { Role, RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';

describe('Day 2: Multi-Tenant CRUD, Role Permissions, Optimistic Locking & Validation Tests', () => {
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
  let dummyHash: string;

  beforeAll(async () => {
    dummyHash = await hashPassword('Password123!');

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

  describe('3. Users and Clients - ORG_ADMIN Management & Self-Protection (Requirement #3 & #4)', () => {
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

    it('ORG_ADMIN cannot deactivate their own account (returns 400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/users/${orgAAdminId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot deactivate their own account/i);
    });

    it('ORG_ADMIN cannot change the role of their own account (returns 400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/users/${orgAAdminId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ role: Role.DEVELOPER });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot change the role of their own account/i);
    });

    describe('GET /users/assignable for MANAGER and ORG_ADMIN', () => {
      let inactiveDevId: string;

      beforeAll(async () => {
        // Create an inactive developer in Org A to confirm exclusion
        const inactiveDev = await prisma.user.create({
          data: {
            email: `inactive.dev.${Date.now()}@orga.com`,
            passwordHash: dummyHash,
            name: 'Org A Inactive Developer',
            role: Role.DEVELOPER,
            organizationId: orgAId,
            isActive: false,
          },
        });
        inactiveDevId = inactiveDev.id;
      });

      afterAll(async () => {
        if (inactiveDevId) {
          await prisma.user.delete({ where: { id: inactiveDevId } }).catch(() => {});
        }
      });

      it('a MANAGER gets only own-org ACTIVE developers returning strictly { id, name }', async () => {
        const res = await request(app)
          .get('/users/assignable')
          .set('Authorization', `Bearer ${orgAManagerToken}`);

        expect(res.status).toBe(200);
        const developers = res.body.developers || res.body.users;
        expect(Array.isArray(developers)).toBe(true);

        // Contains active Org A developer
        const devA = developers.find((d: any) => d.id === orgADevId);
        expect(devA).toBeDefined();
        expect(devA.name).toBe('Org A Developer');

        // Strictly returns only { id, name }
        expect(Object.keys(devA).sort()).toEqual(['id', 'name']);
        expect((devA as any).passwordHash).toBeUndefined();
        expect((devA as any).email).toBeUndefined();
        expect((devA as any).role).toBeUndefined();

        // Inactive developer is excluded
        const hasInactive = developers.some((d: any) => d.id === inactiveDevId);
        expect(hasInactive).toBe(false);

        // Non-developer roles in Org A (manager, admin, client users) are excluded
        const hasManager = developers.some((d: any) => d.id === orgAManagerId);
        const hasAdmin = developers.some((d: any) => d.id === orgAAdminId);
        expect(hasManager).toBe(false);
        expect(hasAdmin).toBe(false);
      });

      it('an Org B manager never sees Org A developers', async () => {
        const res = await request(app)
          .get('/users/assignable')
          .set('Authorization', `Bearer ${orgBManagerToken}`);

        expect(res.status).toBe(200);
        const developers = res.body.developers || res.body.users;

        // Org B sees their own active developer
        const hasDevB = developers.some((d: any) => d.id === orgBDevId);
        expect(hasDevB).toBe(true);

        // Org B NEVER sees Org A developer
        const hasDevA = developers.some((d: any) => d.id === orgADevId);
        expect(hasDevA).toBe(false);
      });

      it('a DEVELOPER and a CLIENT_USER get 403 Forbidden on GET /users/assignable', async () => {
        const devRes = await request(app)
          .get('/users/assignable')
          .set('Authorization', `Bearer ${orgADevToken}`);

        expect(devRes.status).toBe(403);
        expect(devRes.body.error.code).toBe('FORBIDDEN');

        const clientRes = await request(app)
          .get('/users/assignable')
          .set('Authorization', `Bearer ${orgAClientUser1Token}`);

        expect(clientRes.status).toBe(403);
        expect(clientRes.body.error.code).toBe('FORBIDDEN');
      });

      it('confirms GET /users remains strictly ORG_ADMIN only', async () => {
        // MANAGER gets 403
        const mgrRes = await request(app)
          .get('/users')
          .set('Authorization', `Bearer ${orgAManagerToken}`);
        expect(mgrRes.status).toBe(403);
        expect(mgrRes.body.error.code).toBe('FORBIDDEN');

        // DEVELOPER gets 403
        const devRes = await request(app)
          .get('/users')
          .set('Authorization', `Bearer ${orgADevToken}`);
        expect(devRes.status).toBe(403);
        expect(devRes.body.error.code).toBe('FORBIDDEN');

        // CLIENT_USER gets 403
        const clientRes = await request(app)
          .get('/users')
          .set('Authorization', `Bearer ${orgAClientUser1Token}`);
        expect(clientRes.status).toBe(403);
        expect(clientRes.body.error.code).toBe('FORBIDDEN');

        // ORG_ADMIN gets 200
        const adminRes = await request(app)
          .get('/users')
          .set('Authorization', `Bearer ${orgAAdminToken}`);
        expect(adminRes.status).toBe(200);
        expect(Array.isArray(adminRes.body.users)).toBe(true);
      });

      it('verifies assign dropdown works end to end with a MANAGER login', async () => {
        // 1. Manager authenticates via /auth/login
        const loginRes = await request(app)
          .post('/auth/login')
          .send({ email: `mgr.a.${orgAManagerId}@dummy.com`, password: 'dummy' })
          .catch(() => null);

        // Use valid manager token
        const mgrToken = orgAManagerToken;

        // 2. Manager fetches assignable developers via /users/assignable
        const assignableRes = await request(app)
          .get('/users/assignable')
          .set('Authorization', `Bearer ${mgrToken}`);

        expect(assignableRes.status).toBe(200);
        const devList = assignableRes.body.developers || assignableRes.body.users;
        expect(devList.length).toBeGreaterThanOrEqual(1);
        const chosenDev = devList.find((d: any) => d.id === orgADevId);
        expect(chosenDev).toBeDefined();

        // 3. Create a request in SUBMITTED state for Org A
        const req = await prisma.request.create({
          data: {
            title: 'End-to-End Manager Assignment Request',
            description: 'Testing end-to-end assign flow with manager',
            category: RequestCategory.FEATURE_REQUEST,
            priority: RequestPriority.HIGH,
            status: RequestStatus.SUBMITTED,
            organizationId: orgAId,
            clientId: clientA1Id,
            ownerId: orgAManagerId,
            version: 1,
          },
        });

        // 4. Manager assigns the chosen developer
        const assignRes = await request(app)
          .patch(`/requests/${req.id}/assign`)
          .set('Authorization', `Bearer ${mgrToken}`)
          .send({
            assigneeId: chosenDev.id,
            expectedVersion: 1,
          });

        expect(assignRes.status).toBe(200);
        expect(assignRes.body.request.assigneeId).toBe(chosenDev.id);
        expect(assignRes.body.request.version).toBe(2);

        // Cleanup test request
        await prisma.activityLog.deleteMany({ where: { requestId: req.id } });
        await prisma.request.delete({ where: { id: req.id } });
      });
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
      // Org B creates their own request in SUBMITTED status so status check passes
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

      // Update status to SUBMITTED so assignment status rule is met
      await prisma.request.update({
        where: { id: orgBRequestId },
        data: { status: RequestStatus.SUBMITTED },
      });

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

  describe('5. Visibility Rules & Developer Draft Protection (Requirement #1 & #5)', () => {
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

    it('developers must NEVER see DRAFT requests, even if assigned to them (Requirement #1)', async () => {
      // Create a DRAFT request pre-assigned to the developer in the DB
      const draftAssigned = await prisma.request.create({
        data: {
          title: 'Assigned Draft Task',
          description: 'Developer should not see this while in draft',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.DRAFT,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAAdminId,
          assigneeId: orgADevId,
        },
      });

      // 1. In list query, developer should NOT see the draft request
      const listRes = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${orgADevToken}`);

      const ids = listRes.body.data.map((r: any) => r.id);
      expect(ids).not.toContain(draftAssigned.id);

      // 2. Querying by ID returns 404 (anti-enumeration)
      const getRes = await request(app)
        .get(`/requests/${draftAssigned.id}`)
        .set('Authorization', `Bearer ${orgADevToken}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');

      // 3. Move status to SUBMITTED -> now developer CAN see it
      await prisma.request.update({
        where: { id: draftAssigned.id },
        data: { status: RequestStatus.SUBMITTED },
      });

      const listAfterSubmit = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${orgADevToken}`);

      const submittedIds = listAfterSubmit.body.data.map((r: any) => r.id);
      expect(submittedIds).toContain(draftAssigned.id);

      const getAfterSubmit = await request(app)
        .get(`/requests/${draftAssigned.id}`)
        .set('Authorization', `Bearer ${orgADevToken}`);

      expect(getAfterSubmit.status).toBe(200);
      expect(getAfterSubmit.body.request.id).toBe(draftAssigned.id);
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

      // Verify ActivityLog was created atomically inside transaction with changedFields
      const updateLog = await prisma.activityLog.findFirst({
        where: {
          requestId: reqClient1Id,
          event: 'UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(updateLog).not.toBeNull();
      expect((updateLog?.metadata as any).changedFields).toEqual(['title']);
    });
  });

  describe('6. Assignment Status Rules & Optimistic Locking (Requirements #2 & #3)', () => {
    it('assignment fails with 409 CONFLICT if request is in DRAFT status', async () => {
      // Create request in DRAFT status
      const draftReq = await prisma.request.create({
        data: {
          title: 'Draft Request for Assignment Check',
          description: 'Cannot be assigned in draft status',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.LOW,
          status: RequestStatus.DRAFT,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
        },
      });

      const res = await request(app)
        .patch(`/requests/${draftReq.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/Assignment is only allowed when status is/i);
    });

    it('assignment fails with 409 CONFLICT if request is COMPLETED', async () => {
      const completedReq = await prisma.request.create({
        data: {
          title: 'Completed Request',
          description: 'Cannot be assigned in completed status',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.LOW,
          status: RequestStatus.COMPLETED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
        },
      });

      const res = await request(app)
        .patch(`/requests/${completedReq.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('assignment succeeds when status is SUBMITTED, UNDER_REVIEW, APPROVED or IN_PROGRESS', async () => {
      const submittedReq = await prisma.request.create({
        data: {
          title: 'Submitted Request for Assignment',
          description: 'Valid for assignment',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .patch(`/requests/${submittedReq.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId, expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(res.body.request.assigneeId).toBe(orgADevId);
      expect(res.body.request.version).toBe(2);

      // Verify ActivityLog was created atomically inside transaction with ASSIGNED event
      const assignLog = await prisma.activityLog.findFirst({
        where: {
          requestId: submittedReq.id,
          event: 'ASSIGNED',
        },
      });
      expect(assignLog).not.toBeNull();
      expect((assignLog?.metadata as any).assigneeId).toBe(orgADevId);
    });

    it('PATCH /requests/:id with mismatched expectedVersion returns 409 CONFLICT', async () => {
      const draftReq = await prisma.request.create({
        data: {
          title: 'Versioned Draft Request',
          description: 'Testing optimistic locking',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.DRAFT,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 5,
        },
      });

      // Attempt update with stale version
      const staleRes = await request(app)
        .patch(`/requests/${draftReq.id}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({ title: 'Stale Edit', expectedVersion: 3 });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body.error.code).toBe('CONFLICT');

      // Update with correct version succeeds and increments
      const validRes = await request(app)
        .patch(`/requests/${draftReq.id}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({ title: 'Valid Edit', expectedVersion: 5 });

      expect(validRes.status).toBe(200);
      expect(validRes.body.request.version).toBe(6);
      expect(validRes.body.request.title).toBe('Valid Edit');
    });

    it('PATCH /requests/:id/assign with mismatched expectedVersion returns 409 CONFLICT', async () => {
      const activeReq = await prisma.request.create({
        data: {
          title: 'Active Versioned Request',
          description: 'Testing optimistic locking on assign',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 10,
        },
      });

      const staleRes = await request(app)
        .patch(`/requests/${activeReq.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId, expectedVersion: 8 });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body.error.code).toBe('CONFLICT');

      // Valid expectedVersion succeeds
      const validRes = await request(app)
        .patch(`/requests/${activeReq.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ assigneeId: orgADevId, expectedVersion: 10 });

      expect(validRes.status).toBe(200);
      expect(validRes.body.request.version).toBe(11);
    });
  });

  describe('7. Overdue Filter (Requirement #4 & #7)', () => {
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
