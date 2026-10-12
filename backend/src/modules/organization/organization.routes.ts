import { Router } from 'express';
import { Role } from '@prisma/client';
import { organizationController } from './organization.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createOrganizationSchema } from './organization.schema';

const router = Router();

// Organizations can ONLY be accessed and managed by PLATFORM_ADMIN
router.use(authenticate, authorize(Role.PLATFORM_ADMIN));

router.post(
  '/',
  validate({ body: createOrganizationSchema }),
  (req, res, next) => organizationController.create(req, res, next)
);

router.get('/', (req, res, next) => organizationController.getAll(req, res, next));

export default router;
