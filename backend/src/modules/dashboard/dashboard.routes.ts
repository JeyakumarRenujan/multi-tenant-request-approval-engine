import { Router } from 'express';
import { Role } from '@prisma/client';
import { dashboardController } from './dashboard.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();

// Dashboard is restricted to tenant roles.
// PLATFORM_ADMIN receives 403 Forbidden.
router.use(
  authenticate,
  authorize(Role.ORG_ADMIN, Role.MANAGER, Role.DEVELOPER, Role.CLIENT_USER)
);

// GET /dashboard - Returns tenant-scoped counts
router.get('/', (req, res, next) => dashboardController.getMetrics(req, res, next));

export default router;
