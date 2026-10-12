import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret-for-dev-only',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-for-dev-only',
    accessExpiresIn: '15m',
    refreshExpiresDays: 7,
  },
};

