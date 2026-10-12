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

// User management is strictly restricted to ORG_ADMIN of the tenant
router.use(authenticate, authorize(Role.ORG_ADMIN));

router.post(
  '/',
  validate({ body: createUserSchema }),
  (req, res, next) => userController.create(req, res, next)
);

router.get('/', (req, res, next) => userController.getAll(req, res, next));

router.patch(
  '/:id',
  validate({ params: userParamsSchema, body: updateUserSchema }),
  (req, res, next) => userController.update(req, res, next)
);

export default router;
