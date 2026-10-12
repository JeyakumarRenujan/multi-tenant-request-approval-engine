import { Router } from 'express';
import { Role } from '@prisma/client';
import { requestController } from './request.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createRequestSchema,
  updateRequestSchema,
  assignRequestSchema,
  requestQuerySchema,
  requestParamsSchema,
} from './request.schema';

const router = Router();

// Requests endpoints are restricted to tenant roles.
// PLATFORM_ADMIN is excluded and automatically receives 403 Forbidden.
router.use(
  authenticate,
  authorize(Role.ORG_ADMIN, Role.MANAGER, Role.DEVELOPER, Role.CLIENT_USER)
);

// POST /requests - Create a new draft request
router.post(
  '/',
  authorize(Role.ORG_ADMIN, Role.MANAGER, Role.CLIENT_USER),
  validate({ body: createRequestSchema }),
  (req, res, next) => requestController.create(req, res, next)
);

// GET /requests - Query requests with role-based visibility and filters
router.get(
  '/',
  validate({ query: requestQuerySchema }),
  (req, res, next) => requestController.getAll(req, res, next)
);

// GET /requests/:id - View single request with visibility checks
router.get(
  '/:id',
  validate({ params: requestParamsSchema }),
  (req, res, next) => requestController.getById(req, res, next)
);

// PATCH /requests/:id - Edit draft request (creator only)
router.patch(
  '/:id',
  validate({ params: requestParamsSchema, body: updateRequestSchema }),
  (req, res, next) => requestController.update(req, res, next)
);

// PATCH /requests/:id/assign - Assign developer to request (MANAGER only)
router.patch(
  '/:id/assign',
  authorize(Role.MANAGER),
  validate({ params: requestParamsSchema, body: assignRequestSchema }),
  (req, res, next) => requestController.assign(req, res, next)
);

export default router;
