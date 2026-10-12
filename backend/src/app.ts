import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import organizationRoutes from './modules/organization/organization.routes';
import clientRoutes from './modules/client/client.routes';
import userRoutes from './modules/user/user.routes';
import requestRoutes from './modules/request/request.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import { errorHandler } from './middlewares/errorHandler.middleware';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes
app.use('/auth', authRoutes);

// Organization routes (PLATFORM_ADMIN only)
app.use('/organizations', organizationRoutes);

// Client and User management routes (ORG_ADMIN only)
app.use('/clients', clientRoutes);
app.use('/users', userRoutes);

// Request workflow routes
app.use('/requests', requestRoutes);

// Dashboard metrics routes
app.use('/dashboard', dashboardRoutes);

// Centralized error handler
app.use(errorHandler);
