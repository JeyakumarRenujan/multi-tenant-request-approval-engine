import { Router } from 'express';
import { Role } from '@prisma/client';
import { clientController } from './client.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createClientSchema,
  updateClientSchema,
  clientParamsSchema,
} from './client.schema';

const router = Router();

// Clients endpoint is restricted to ORG_ADMIN of the tenant only.
// PLATFORM_ADMIN, CLIENT_USER, DEVELOPER, and MANAGER get 403 Forbidden.
router.use(authenticate, authorize(Role.ORG_ADMIN));

router.post(
  '/',
  validate({ body: createClientSchema }),
  (req, res, next) => clientController.create(req, res, next)
);

router.get('/', (req, res, next) => clientController.getAll(req, res, next));

router.get(
  '/:id',
  validate({ params: clientParamsSchema }),
  (req, res, next) => clientController.getById(req, res, next)
);

router.patch(
  '/:id',
  validate({ params: clientParamsSchema, body: updateClientSchema }),
  (req, res, next) => clientController.update(req, res, next)
);

export default router;
