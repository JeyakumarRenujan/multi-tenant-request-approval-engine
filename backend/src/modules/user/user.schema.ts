import { z } from 'zod';
import { Role } from '@prisma/client';

const tenantRoles = [
  Role.ORG_ADMIN,
  Role.MANAGER,
  Role.DEVELOPER,
  Role.CLIENT_USER,
] as const;

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(tenantRoles, {
    message: 'Role must be ORG_ADMIN, MANAGER, DEVELOPER, or CLIENT_USER',
  }),
  clientId: z.string().uuid('Invalid client UUID').optional().nullable(),
});

export const updateUserSchema = z.object({
  role: z.enum(tenantRoles, {
    message: 'Role must be ORG_ADMIN, MANAGER, DEVELOPER, or CLIENT_USER',
  }).optional(),
  isActive: z.boolean().optional(),
  clientId: z.string().uuid('Invalid client UUID').optional().nullable(),
});

export const userParamsSchema = z.object({
  id: z.string().uuid('Invalid user UUID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
