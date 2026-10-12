export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request payload', details?: any) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: any) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', details?: any) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/**
 * 404 Not Found error.
 * Used for both missing resources and cross-tenant access to prevent leaking ID existence (Rule #3).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: any) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: any) {
    super(409, 'CONFLICT', message, details);
  }
}
