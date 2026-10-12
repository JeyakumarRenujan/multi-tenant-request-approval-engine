import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2, 'Client name must be at least 2 characters').max(100, 'Client name cannot exceed 100 characters'),
});

export const updateClientSchema = z.object({
  name: z.string().min(2, 'Client name must be at least 2 characters').max(100, 'Client name cannot exceed 100 characters'),
});

export const clientParamsSchema = z.object({
  id: z.string().uuid('Invalid client UUID'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
