import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { generateAccessToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { Role, RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';

describe('Day 3: Approval Workflow, State Machine, Concurrency & Audit History Tests', () => {
  let orgAId: string;
  let orgBId: string;
  let clientA1Id: string;
  let clientA2Id: string;
  let clientB1Id: string;

  let platformAdminToken: string;
  let orgAAdminToken: string;
  let orgAManagerToken: string;
  let orgADev1Token: string;
  let orgADev2Token: string;
  let orgAClientUser1Token: string;
  let orgAClientUser2Token: string;
  let orgBManagerToken: string;
  let orgBDevToken: string;

  let platformAdminId: string;
  let orgAAdminId: string;
  let orgAManagerId: string;
  let orgADev1Id: string;
  let orgADev2Id: string;
  let orgAClientUser1Id: string;
  let orgAClientUser2Id: string;
  let orgBManagerId: string;
  let orgBDevId: string;

  beforeAll(async () => {
    const dummyHash = await hashPassword('Password123!');
    const timestamp = Date.now();

    // 1. Create Organizations
    const orgA = await prisma.organization.create({ data: { name: `Day 3 Org A ${timestamp}` } });
    const orgB = await prisma.organization.create({ data: { name: `Day 3 Org B ${timestamp}` } });
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
        email: `plat.${timestamp}@day3.com`,
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
        email: `admin.a.${timestamp}@day3.com`,
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
        email: `mgr.a.${timestamp}@day3.com`,
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

    // Org A Developer 1
    const uADev1 = await prisma.user.create({
      data: {
        email: `dev1.a.${timestamp}@day3.com`,
        passwordHash: dummyHash,
        name: 'Org A Dev 1',
        role: Role.DEVELOPER,
        organizationId: orgAId,
      },
    });
    orgADev1Id = uADev1.id;
    orgADev1Token = generateAccessToken({
      userId: uADev1.id,
      email: uADev1.email,
      role: Role.DEVELOPER,
      organizationId: orgAId,
    });

    // Org A Developer 2
    const uADev2 = await prisma.user.create({
      data: {
        email: `dev2.a.${timestamp}@day3.com`,
        passwordHash: dummyHash,
        name: 'Org A Dev 2',
        role: Role.DEVELOPER,
        organizationId: orgAId,
      },
    });
    orgADev2Id = uADev2.id;
    orgADev2Token = generateAccessToken({
      userId: uADev2.id,
      email: uADev2.email,
      role: Role.DEVELOPER,
      organizationId: orgAId,
    });

    // Org A Client User 1 (linked to Client A1)
    const uAC1 = await prisma.user.create({
      data: {
        email: `client1.a.${timestamp}@day3.com`,
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

    // Org A Client User 2 (linked to Client A2)
    const uAC2 = await prisma.user.create({
      data: {
        email: `client2.a.${timestamp}@day3.com`,
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
        email: `mgr.b.${timestamp}@day3.com`,
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
        email: `dev.b.${timestamp}@day3.com`,
        passwordHash: dummyHash,
        name: 'Org B Dev',
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
    // Teardown test data cleanly respecting onDelete: Restrict
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

  describe('1. Full Happy Path Workflow', () => {
    it('client creates -> submits -> manager reviews -> approves -> assigns developer -> developer starts in_progress -> developer completes', async () => {
      // Step 1: Client User 1 creates request (starts as DRAFT, version 1)
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Happy Path Feature Request',
          description: 'A complete feature request from creation to completion',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
        });

      expect(createRes.status).toBe(201);
      const reqId = createRes.body.request.id;
      expect(createRes.body.request.status).toBe(RequestStatus.DRAFT);
      expect(createRes.body.request.version).toBe(1);

      // Step 2: Client User 1 submits the draft request (DRAFT -> SUBMITTED)
      const submitRes = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          toStatus: RequestStatus.SUBMITTED,
          expectedVersion: 1,
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.request.status).toBe(RequestStatus.SUBMITTED);
      expect(submitRes.body.request.version).toBe(2);

      // Step 3: Manager moves request to UNDER_REVIEW (SUBMITTED -> UNDER_REVIEW)
      const reviewRes = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.UNDER_REVIEW,
          expectedVersion: 2,
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.request.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(reviewRes.body.request.version).toBe(3);

      // Step 4: Manager approves request (UNDER_REVIEW -> APPROVED)
      const approveRes = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 3,
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.request.status).toBe(RequestStatus.APPROVED);
      expect(approveRes.body.request.version).toBe(4);

      // Step 5: Manager assigns developer 1 to the approved request
      const assignRes = await request(app)
        .patch(`/requests/${reqId}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          assigneeId: orgADev1Id,
          expectedVersion: 4,
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.request.assigneeId).toBe(orgADev1Id);
      expect(assignRes.body.request.version).toBe(5);

      // Step 6: Assigned Developer 1 moves request to IN_PROGRESS (APPROVED -> IN_PROGRESS)
      const inProgressRes = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgADev1Token}`)
        .send({
          toStatus: RequestStatus.IN_PROGRESS,
          expectedVersion: 5,
        });

      expect(inProgressRes.status).toBe(200);
      expect(inProgressRes.body.request.status).toBe(RequestStatus.IN_PROGRESS);
      expect(inProgressRes.body.request.version).toBe(6);

      // Step 7: Assigned Developer 1 moves request to COMPLETED (IN_PROGRESS -> COMPLETED)
      const completeRes = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgADev1Token}`)
        .send({
          toStatus: RequestStatus.COMPLETED,
          expectedVersion: 6,
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.request.status).toBe(RequestStatus.COMPLETED);
      expect(completeRes.body.request.version).toBe(7);

      // Verify final activity history has full audit trail
      const historyRes = await request(app)
        .get(`/requests/${reqId}/history`)
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(historyRes.status).toBe(200);
      const events = historyRes.body.history.map((h: any) => h.event);
      expect(events).toContain('CREATED');
      expect(events).toContain('STATUS_CHANGED');
      expect(events).toContain('ASSIGNED');
    });
  });

  describe('2. Invalid Transitions and Terminal States (409 INVALID_TRANSITION)', () => {
    it('returns 409 INVALID_TRANSITION when jumping directly from DRAFT to APPROVED', async () => {
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Invalid Jump Request',
          description: 'Testing illegal jump from draft to approved',
          category: RequestCategory.BUG_FIX,
          priority: RequestPriority.MEDIUM,
        });

      const reqId = createRes.body.request.id;

      const res = await request(app)
        .post(`/requests/${reqId}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('returns 409 INVALID_TRANSITION when transitioning out of COMPLETED terminal state', async () => {
      // Create request and fast-forward to COMPLETED in database
      const req = await prisma.request.create({
        data: {
          title: 'Terminal Completed Request',
          description: 'Terminal testing',
          category: RequestCategory.SUPPORT,
          priority: RequestPriority.LOW,
          status: RequestStatus.COMPLETED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          assigneeId: orgADev1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgADev1Token}`)
        .send({
          toStatus: RequestStatus.IN_PROGRESS,
          expectedVersion: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('returns 409 INVALID_TRANSITION when transitioning out of REJECTED terminal state', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Terminal Rejected Request',
          description: 'Terminal testing',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.LOW,
          status: RequestStatus.REJECTED,
          rejectionReason: 'Scope cannot be accommodated',
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('3. Role Authorization Enforcements (403 FORBIDDEN)', () => {
    let underReviewReqId: string;

    beforeEach(async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Under Review Request for Auth Test',
          description: 'Auth check for manager approval',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          assigneeId: orgADev1Id,
          version: 1,
        },
      });
      underReviewReqId = req.id;
    });

    it('developer trying to approve request returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/requests/${underReviewReqId}/transition`)
        .set('Authorization', `Bearer ${orgADev1Token}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('client user trying to approve request returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/requests/${underReviewReqId}/transition`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('client user trying to submit another client user draft request returns 403 FORBIDDEN', async () => {
      const draftReq = await prisma.request.create({
        data: {
          title: 'Client 1 Draft Request',
          description: 'Created by Client User 1',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.DRAFT,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      // Client User 2 belongs to Client A2, so accessing it returns 404 (visibility rule)
      const resA2 = await request(app)
        .post(`/requests/${draftReq.id}/transition`)
        .set('Authorization', `Bearer ${orgAClientUser2Token}`)
        .send({
          toStatus: RequestStatus.SUBMITTED,
          expectedVersion: 1,
        });

      expect(resA2.status).toBe(404);

      // Create another client user in same client A1 to test 403 creator check
      const dummyHash = await hashPassword('Password123!');
      const uAC1Peer = await prisma.user.create({
        data: {
          email: `peer.client1.${Date.now()}@day3.com`,
          passwordHash: dummyHash,
          name: 'Org A Client User 1 Peer',
          role: Role.CLIENT_USER,
          organizationId: orgAId,
          clientId: clientA1Id,
        },
      });
      const peerToken = generateAccessToken({
        userId: uAC1Peer.id,
        email: uAC1Peer.email,
        role: Role.CLIENT_USER,
        organizationId: orgAId,
        clientId: clientA1Id,
      });

      const resPeer = await request(app)
        .post(`/requests/${draftReq.id}/transition`)
        .set('Authorization', `Bearer ${peerToken}`)
        .send({
          toStatus: RequestStatus.SUBMITTED,
          expectedVersion: 1,
        });

      expect(resPeer.status).toBe(403);
      expect(resPeer.body.error.code).toBe('FORBIDDEN');
    });

    it('unassigned or differently assigned developer cannot move APPROVED request to IN_PROGRESS (returns 403 or 404)', async () => {
      // 1. Unassigned request: Developer cannot see DRAFT, but when APPROVED, if not assigned to them, returns 404 visibility
      const approvedReq = await prisma.request.create({
        data: {
          title: 'Approved Request Assigned to Dev 1',
          description: 'Assigned to Dev 1',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.APPROVED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          assigneeId: orgADev1Id,
          version: 1,
        },
      });

      // Dev 2 tries to transition Dev 1's request -> visibility check returns 404
      const resDev2 = await request(app)
        .post(`/requests/${approvedReq.id}/transition`)
        .set('Authorization', `Bearer ${orgADev2Token}`)
        .send({
          toStatus: RequestStatus.IN_PROGRESS,
          expectedVersion: 1,
        });

      expect(resDev2.status).toBe(404);

      // Manager tries to transition APPROVED to IN_PROGRESS -> state machine denies (only DEVELOPER assignee may start work) -> 403
      const resMgr = await request(app)
        .post(`/requests/${approvedReq.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.IN_PROGRESS,
          expectedVersion: 1,
        });

      expect(resMgr.status).toBe(403);
      expect(resMgr.body.error.code).toBe('FORBIDDEN');
    });

    it('org admin trying to approve request returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/requests/${underReviewReqId}/transition`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Cross-Tenant Anti-Enumeration (404 NOT_FOUND)', () => {
    it('manager from another organization gets 404 on transition attempt', async () => {
      const orgAReq = await prisma.request.create({
        data: {
          title: 'Org A Confidential Request',
          description: 'Secret to Org A',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${orgAReq.id}/transition`)
        .set('Authorization', `Bearer ${orgBManagerToken}`)
        .send({
          toStatus: RequestStatus.UNDER_REVIEW,
          expectedVersion: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('5. Validation Rules (400 BAD_REQUEST)', () => {
    it('returns 400 when missing expectedVersion', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Missing expectedVersion Request',
          description: 'Testing missing version validation',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.UNDER_REVIEW,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when rejecting without a reason', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Under Review Request for Rejection Test',
          description: 'Testing rejection reason requirement',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.REJECTED,
          expectedVersion: 1,
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('manager can successfully reject with a reason (stores rejectionReason and increments version)', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Request to be Rejected with Reason',
          description: 'Valid rejection test',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.REJECTED,
          expectedVersion: 1,
          reason: 'Budget constraint for Q4',
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe(RequestStatus.REJECTED);
      expect(res.body.request.rejectionReason).toBe('Budget constraint for Q4');
      expect(res.body.request.version).toBe(2);
    });
  });

  describe('6. Concurrency & Optimistic Locking (Prevent Double Approval)', () => {
    it('two parallel approvals with the same expectedVersion: exactly one returns 200, the other 409 CONFLICT; version increments exactly once', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Concurrent Approval Request',
          description: 'Testing race condition on approval',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.URGENT,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      // Fire two concurrent approvals using Promise.all with the identical expectedVersion
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/requests/${req.id}/transition`)
          .set('Authorization', `Bearer ${orgAManagerToken}`)
          .send({
            toStatus: RequestStatus.APPROVED,
            expectedVersion: 1,
          }),
        request(app)
          .post(`/requests/${req.id}/transition`)
          .set('Authorization', `Bearer ${orgAManagerToken}`)
          .send({
            toStatus: RequestStatus.APPROVED,
            expectedVersion: 1,
          }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Verify the 409 response has code CONFLICT
      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.error.code).toBe('CONFLICT');

      // Verify database record has version = 2 (incremented exactly once)
      const freshReq = await prisma.request.findUniqueOrThrow({
        where: { id: req.id },
      });
      expect(freshReq.status).toBe(RequestStatus.APPROVED);
      expect(freshReq.version).toBe(2);
    });
  });

  describe('7. ActivityLog Verification for Transitions, Updates, and Assignments', () => {
    it('creates ActivityLog row on each transition with previous and new status', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Audit Log Verification Request',
          description: 'Checking activity log generation',
          category: RequestCategory.BUG_FIX,
          priority: RequestPriority.HIGH,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.UNDER_REVIEW,
          expectedVersion: 1,
        });

      const logs = await prisma.activityLog.findMany({
        where: { requestId: req.id, event: 'STATUS_CHANGED' },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].previousStatus).toBe(RequestStatus.SUBMITTED);
      expect(logs[0].newStatus).toBe(RequestStatus.UNDER_REVIEW);
      expect(logs[0].actorId).toBe(orgAManagerId);
      expect((logs[0].metadata as any).version).toBe(2);
    });

    it('PATCH /requests/:id creates an ActivityLog row with event UPDATED and changedFields', async () => {
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Initial Draft for Edit Audit',
          description: 'Initial draft description',
          category: RequestCategory.GENERAL,
          priority: RequestPriority.LOW,
        });

      const reqId = createRes.body.request.id;

      const editRes = await request(app)
        .patch(`/requests/${reqId}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`)
        .send({
          title: 'Updated Draft Title for Audit',
          priority: RequestPriority.URGENT,
        });

      expect(editRes.status).toBe(200);

      const updateLogs = await prisma.activityLog.findMany({
        where: { requestId: reqId, event: 'UPDATED' },
      });

      expect(updateLogs.length).toBe(1);
      expect(updateLogs[0].event).toBe('UPDATED');
      expect((updateLogs[0].metadata as any).changedFields).toEqual(
        expect.arrayContaining(['title', 'priority'])
      );
    });

    it('PATCH /requests/:id/assign creates an ActivityLog row with event ASSIGNED', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Request for Assign Audit Test',
          description: 'Testing assignment audit log',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      const assignRes = await request(app)
        .patch(`/requests/${req.id}/assign`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          assigneeId: orgADev1Id,
        });

      expect(assignRes.status).toBe(200);

      const assignLogs = await prisma.activityLog.findMany({
        where: { requestId: req.id, event: 'ASSIGNED' },
      });

      expect(assignLogs.length).toBe(1);
      expect(assignLogs[0].event).toBe('ASSIGNED');
      expect(assignLogs[0].actorId).toBe(orgAManagerId);
      expect((assignLogs[0].metadata as any).assigneeId).toBe(orgADev1Id);
    });
  });

  describe('8. Request History Endpoint (GET /requests/:id/history)', () => {
    let testReqId: string;

    beforeEach(async () => {
      const req = await prisma.request.create({
        data: {
          title: 'History Test Request',
          description: 'Audit history viewing',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
          status: RequestStatus.SUBMITTED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });
      testReqId = req.id;

      // Add a couple of activity logs
      await prisma.activityLog.create({
        data: {
          organizationId: orgAId,
          requestId: testReqId,
          actorId: orgAClientUser1Id,
          event: 'CREATED',
          newStatus: RequestStatus.DRAFT,
          metadata: { note: 'Initial creation' },
        },
      });

      await prisma.activityLog.create({
        data: {
          organizationId: orgAId,
          requestId: testReqId,
          actorId: orgAClientUser1Id,
          event: 'STATUS_CHANGED',
          previousStatus: RequestStatus.DRAFT,
          newStatus: RequestStatus.SUBMITTED,
          metadata: { note: 'Submitted for review' },
        },
      });
    });

    it('returns activity logs in chronological order for authorized tenant user', async () => {
      const res = await request(app)
        .get(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.history.length).toBe(2);
      expect(res.body.history[0].event).toBe('CREATED');
      expect(res.body.history[1].event).toBe('STATUS_CHANGED');
      expect(res.body.history[0].actor).toBeDefined();
      expect(res.body.history[0].actor.name).toBe('Org A Client User 1');
    });

    it('client user can read history of their own client request', async () => {
      const res = await request(app)
        .get(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.history.length).toBe(2);
    });

    it('client user cannot read history of a different client request (returns 404)', async () => {
      const res = await request(app)
        .get(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAClientUser2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('cross-tenant manager (Org B) requesting Org A history returns 404', async () => {
      const res = await request(app)
        .get(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgBManagerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('history is strictly read-only: PUT, PATCH, and DELETE routes return 404/405', async () => {
      const putRes = await request(app)
        .put(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ test: 'cannot modify' });
      expect([404, 405]).toContain(putRes.status);

      const patchRes = await request(app)
        .patch(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({ test: 'cannot modify' });
      expect([404, 405]).toContain(patchRes.status);

      const deleteRes = await request(app)
        .delete(`/requests/${testReqId}/history`)
        .set('Authorization', `Bearer ${orgAManagerToken}`);
      expect([404, 405]).toContain(deleteRes.status);
    });
  });

  describe('9. Day 3 Edge-Case Hardening Tests', () => {
    it('concurrent race: one approval and one assignment on same expectedVersion; exactly one succeeds, the other gets 409 CONFLICT', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Race Approval vs Assignment Request',
          description: 'Testing race between transition and assignment',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
          status: RequestStatus.UNDER_REVIEW,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      // Both operations are valid for MANAGER on UNDER_REVIEW status with expectedVersion: 1
      const [resApproval, resAssign] = await Promise.all([
        request(app)
          .post(`/requests/${req.id}/transition`)
          .set('Authorization', `Bearer ${orgAManagerToken}`)
          .send({
            toStatus: RequestStatus.APPROVED,
            expectedVersion: 1,
          }),
        request(app)
          .patch(`/requests/${req.id}/assign`)
          .set('Authorization', `Bearer ${orgAManagerToken}`)
          .send({
            assigneeId: orgADev1Id,
            expectedVersion: 1,
          }),
      ]);

      const statuses = [resApproval.status, resAssign.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      const conflictRes = resApproval.status === 409 ? resApproval : resAssign;
      expect(conflictRes.body.error.code).toBe('CONFLICT');

      // The final version is incremented exactly once (from 1 to 2)
      const freshReq = await prisma.request.findUniqueOrThrow({
        where: { id: req.id },
      });
      expect(freshReq.version).toBe(2);
    });

    it('a DEVELOPER assigned to a COMPLETED request can still read its history and detail', async () => {
      const completedReq = await prisma.request.create({
        data: {
          title: 'Completed Request for Dev Read Check',
          description: 'Developer reading completed request',
          category: RequestCategory.BUG_FIX,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.COMPLETED,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          assigneeId: orgADev1Id,
          version: 5,
        },
      });

      await prisma.activityLog.create({
        data: {
          organizationId: orgAId,
          requestId: completedReq.id,
          actorId: orgADev1Id,
          event: 'STATUS_CHANGED',
          previousStatus: RequestStatus.IN_PROGRESS,
          newStatus: RequestStatus.COMPLETED,
          metadata: { note: 'Finished implementation' },
        },
      });

      // Detail access: GET /requests/:id by assigned developer
      const detailRes = await request(app)
        .get(`/requests/${completedReq.id}`)
        .set('Authorization', `Bearer ${orgADev1Token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.request.id).toBe(completedReq.id);
      expect(detailRes.body.request.status).toBe(RequestStatus.COMPLETED);
      expect(detailRes.body.request.assigneeId).toBe(orgADev1Id);

      // History access: GET /requests/:id/history by assigned developer
      const historyRes = await request(app)
        .get(`/requests/${completedReq.id}/history`)
        .set('Authorization', `Bearer ${orgADev1Token}`);

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.history)).toBe(true);
      expect(historyRes.body.history.length).toBeGreaterThanOrEqual(1);
      expect(historyRes.body.history[0].event).toBe('STATUS_CHANGED');
    });

    it('a reason sent with a non-REJECTED transition never writes to rejectionReason', async () => {
      const req = await prisma.request.create({
        data: {
          title: 'Approval with Remark Request',
          description: 'Testing non-rejected transition with reason',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.MEDIUM,
          status: RequestStatus.UNDER_REVIEW,
          rejectionReason: null,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 1,
        },
      });

      // Manager approves request while passing a comment/reason
      const res = await request(app)
        .post(`/requests/${req.id}/transition`)
        .set('Authorization', `Bearer ${orgAManagerToken}`)
        .send({
          toStatus: RequestStatus.APPROVED,
          expectedVersion: 1,
          reason: 'Looks great! Approved for the next sprint.',
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe(RequestStatus.APPROVED);
      expect(res.body.request.rejectionReason).toBeNull();

      // Confirm directly in database that rejectionReason was not written
      const freshReq = await prisma.request.findUniqueOrThrow({
        where: { id: req.id },
      });
      expect(freshReq.rejectionReason).toBeNull();
    });

    it('GET /requests/:id returns rejectionReason to the owning CLIENT_USER', async () => {
      const rejectedReasonText = 'Scope cannot be accommodated in Q4 roadmap due to resource constraints';
      const rejectedReq = await prisma.request.create({
        data: {
          title: 'Client Rejected Request View Test',
          description: 'Client viewing rejection reason',
          category: RequestCategory.FEATURE_REQUEST,
          priority: RequestPriority.HIGH,
          status: RequestStatus.REJECTED,
          rejectionReason: rejectedReasonText,
          organizationId: orgAId,
          clientId: clientA1Id,
          ownerId: orgAClientUser1Id,
          version: 2,
        },
      });

      const res = await request(app)
        .get(`/requests/${rejectedReq.id}`)
        .set('Authorization', `Bearer ${orgAClientUser1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.request.id).toBe(rejectedReq.id);
      expect(res.body.request.status).toBe(RequestStatus.REJECTED);
      expect(res.body.request.rejectionReason).toBe(rejectedReasonText);
    });
  });
});
