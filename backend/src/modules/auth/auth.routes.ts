import { Router } from 'express';
import { authController } from './auth.controller';

const router = Router();

// POST /auth/login - Authenticate with email and password
router.post('/login', (req, res, next) => authController.login(req, res, next));

// POST /auth/refresh - Rotate refresh token and obtain new access token
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

// POST /auth/logout - Revoke refresh token
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

export default router;

