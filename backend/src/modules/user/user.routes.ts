import { Router } from 'express';
import { Role } from '@prisma/client';
import { userController } from './user.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  userParamsSchema,
} from './user.schema';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /users/assignable - Accessible by MANAGER and ORG_ADMIN only
// Returns only { id, name } of ACTIVE developers in the caller's own organization
router.get(
  '/assignable',
  authorize(Role.MANAGER, Role.ORG_ADMIN),
  (req, res, next) => userController.getAssignable(req, res, next)
);

// General User management is strictly restricted to ORG_ADMIN of the tenant
router.post(
  '/',
  authorize(Role.ORG_ADMIN),
  validate({ body: createUserSchema }),
  (req, res, next) => userController.create(req, res, next)
);

router.get(
  '/',
  authorize(Role.ORG_ADMIN),
  (req, res, next) => userController.getAll(req, res, next)
);

router.patch(
  '/:id',
  authorize(Role.ORG_ADMIN),
  validate({ params: userParamsSchema, body: updateUserSchema }),
  (req, res, next) => userController.update(req, res, next)
);

export default router;
