import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// POST /auth/login - Authenticate with email and password
router.post('/login', (req, res, next) => authController.login(req, res, next));

// POST /auth/refresh - Rotate refresh token and obtain new access token
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

// POST /auth/logout - Revoke refresh token
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// GET /auth/me - Protected endpoint returning the authenticated user profile
router.get('/me', authenticate, (req, res) => {
  const profile = {
    id: req.user!.id,
    name: req.user!.name,
    email: req.user!.email,
    role: req.user!.role,
    organizationId: req.user!.organizationId,
    clientId: req.user!.clientId,
  };
  res.status(200).json({
    user: profile,
    ...profile,
  });
});

export default router;

