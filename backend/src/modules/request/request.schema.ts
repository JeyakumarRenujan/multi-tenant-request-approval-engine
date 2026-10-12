import { z } from 'zod';
import { RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';

export const createRequestSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000, 'Description cannot exceed 2000 characters'),
  category: z.nativeEnum(RequestCategory, {
    message: 'Invalid request category',
  }),
  priority: z.nativeEnum(RequestPriority, {
    message: 'Invalid request priority',
  }),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO datetime string' }).optional().nullable(),
  clientId: z.string().uuid('Invalid client UUID').optional().nullable(),
});

export const updateRequestSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters').optional(),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000, 'Description cannot exceed 2000 characters').optional(),
  category: z.nativeEnum(RequestCategory, {
    message: 'Invalid request category',
  }).optional(),
  priority: z.nativeEnum(RequestPriority, {
    message: 'Invalid request priority',
  }).optional(),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO datetime string' }).optional().nullable(),
  expectedVersion: z.number().int().positive().optional(),
});

export const assignRequestSchema = z.object({
  assigneeId: z.string().uuid('Invalid assignee UUID'),
  expectedVersion: z.number().int().positive().optional(),
});

export const transitionRequestSchema = z
  .object({
    toStatus: z.nativeEnum(RequestStatus, {
      message: 'Invalid request status',
    }),
    expectedVersion: z.number().int().positive(),
    reason: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.toStatus === RequestStatus.REJECTED && (!data.reason || data.reason.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Reason is required when rejecting a request',
      });
    }
  });

export const requestQuerySchema = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  priority: z.nativeEnum(RequestPriority).optional(),
  category: z.nativeEnum(RequestCategory).optional(),
  assigneeId: z.string().uuid().optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional()
    .default('1' as any),
  pageSize: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default('10' as any),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const requestParamsSchema = z.object({
  id: z.string().uuid('Invalid request UUID'),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type AssignRequestInput = z.infer<typeof assignRequestSchema>;
export type TransitionRequestInput = z.infer<typeof transitionRequestSchema>;
export type RequestQueryInput = z.infer<typeof requestQuerySchema>;
