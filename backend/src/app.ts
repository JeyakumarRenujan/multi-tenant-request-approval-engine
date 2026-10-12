import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import organizationRoutes from './modules/organization/organization.routes';
import clientRoutes from './modules/client/client.routes';
import userRoutes from './modules/user/user.routes';
import requestRoutes from './modules/request/request.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './docs/swagger';
import { errorHandler } from './middlewares/errorHandler.middleware';

export const app = express();

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Permits Swagger UI interactive documentation assets
  })
);

// Enable CORS restricted strictly to frontend origin
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.frontendUrl) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// API Documentation served at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
