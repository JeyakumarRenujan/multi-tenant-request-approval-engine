import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';

/**
 * Centralized Express error handler.
 * Guarantees all errors conform to the contract: { error: { code, message, details } }
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Known operational application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Prisma unique constraint violation (e.g. duplicate email)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: `A record with this ${target.join(', ') || 'field'} already exists`,
          details: { fields: target },
        },
      });
    }

    // Prisma record to update/delete not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Requested record was not found',
        },
      });
    }
  }

  // SyntaxError from invalid JSON body parser
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
      },
    });
  }

  // Unexpected internal errors (don't leak stack trace in production)
  console.error('[Unhandled Internal Error]:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
    },
  });
}

