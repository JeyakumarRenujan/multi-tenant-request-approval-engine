import { RequestStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../types/express';
import {
  BadRequestError,
  ForbiddenError,
  InvalidTransitionError,
} from '../../errors/AppError';

/**
 * State Machine Transition Definition
 */
export interface TransitionRule {
  from: RequestStatus;
  to: RequestStatus;
  allowedRoles: Role[];
  description: string;
}

/**
 * Context of the request required for transition validation.
 */
export interface RequestTransitionContext {
  id?: string;
  ownerId: string;
  assigneeId?: string | null;
  status: RequestStatus;
  [key: string]: any;
}

export interface TransitionValidationResult {
  allowed: boolean;
  denialReason?: string;
  errorCode?: 'INVALID_TRANSITION' | 'FORBIDDEN' | 'BAD_REQUEST';
}

/**
 * Terminal States Architecture Decision:
 * ---------------------------------------
 * REJECTED and COMPLETED are terminal states.
 * No transitions out of these states are allowed under any circumstances.
 *
 * Rationale:
 * 1. COMPLETED: Once all work is fulfilled, verified, and delivered, the lifecycle of
 *    that specific request has definitively concluded. Any subsequent defects or feature
 *    enhancements must be tracked as a new request to preserve historical integrity,
 *    clear SLA calculations, and audit traceability.
 * 2. REJECTED: Once rejected by management with a documented rejectionReason, that
 *    proposal is permanently closed. If requirements change or prerequisites are
 *    subsequently met, a new request must be created and submitted through the standard
 *    review and approval pipeline.
 *
 * Neither REJECTED nor COMPLETED can ever transition to any other status.
 */
export const TERMINAL_STATUSES: readonly RequestStatus[] = [
  RequestStatus.REJECTED,
  RequestStatus.COMPLETED,
] as const;

/**
 * Permitted status transitions in the workflow engine and authorized roles.
 */
export const ALLOWED_TRANSITIONS: readonly TransitionRule[] = [
  {
    from: RequestStatus.DRAFT,
    to: RequestStatus.SUBMITTED,
    allowedRoles: [Role.CLIENT_USER],
    description: 'Client user submits their draft request for review',
  },
  {
    from: RequestStatus.SUBMITTED,
    to: RequestStatus.UNDER_REVIEW,
    allowedRoles: [Role.MANAGER],
    description: 'Manager moves submitted request under formal review',
  },
  {
    from: RequestStatus.UNDER_REVIEW,
    to: RequestStatus.APPROVED,
    allowedRoles: [Role.MANAGER],
    description: 'Manager approves reviewed request',
  },
  {
    from: RequestStatus.UNDER_REVIEW,
    to: RequestStatus.REJECTED,
    allowedRoles: [Role.MANAGER],
    description: 'Manager rejects reviewed request with mandatory rejection reason',
  },
  {
    from: RequestStatus.APPROVED,
    to: RequestStatus.IN_PROGRESS,
    allowedRoles: [Role.DEVELOPER],
    description: 'Assigned developer starts working on approved request',
  },
  {
    from: RequestStatus.IN_PROGRESS,
    to: RequestStatus.COMPLETED,
    allowedRoles: [Role.DEVELOPER],
    description: 'Assigned developer completes the request',
  },
] as const;

/**
 * Validates whether a status transition is permitted given the current request status,
 * target status, authenticated user, request entity, and optional rejection reason.
 *
 * Returns allowed (true/false) and a clear reason for denial along with the corresponding error code.
 */
export function validateTransition(
  currentStatus: RequestStatus,
  toStatus: RequestStatus,
  user: AuthenticatedUser,
  request: RequestTransitionContext,
  reason?: string
): TransitionValidationResult {
  // 1. Verify if the transition exists in the state machine
  const rule = ALLOWED_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === toStatus
  );

  if (!rule) {
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      return {
        allowed: false,
        denialReason: `Cannot transition from terminal state ${currentStatus} to ${toStatus}. Terminal states cannot be reopened or modified.`,
        errorCode: 'INVALID_TRANSITION',
      };
    }
    return {
      allowed: false,
      denialReason: `Transition from ${currentStatus} to ${toStatus} is not permitted by the workflow state machine.`,
      errorCode: 'INVALID_TRANSITION',
    };
  }

  // 2. Validate user role authorization for this valid transition
  if (!rule.allowedRoles.includes(user.role)) {
    return {
      allowed: false,
      denialReason: `Role ${user.role} is not authorized to transition request from ${currentStatus} to ${toStatus}. Allowed roles: ${rule.allowedRoles.join(', ')}.`,
      errorCode: 'FORBIDDEN',
    };
  }

  // 3. Additional transition-specific preconditions:
  // DRAFT -> SUBMITTED: must be the creator (owner) of the request
  if (currentStatus === RequestStatus.DRAFT && toStatus === RequestStatus.SUBMITTED) {
    if (request.ownerId !== user.id) {
      return {
        allowed: false,
        denialReason: 'Only the request creator can submit this draft request',
        errorCode: 'FORBIDDEN',
      };
    }
  }

  // UNDER_REVIEW -> REJECTED: rejectionReason is required
  if (currentStatus === RequestStatus.UNDER_REVIEW && toStatus === RequestStatus.REJECTED) {
    if (!reason || reason.trim().length === 0) {
      return {
        allowed: false,
        denialReason: 'Rejection reason is required when rejecting a request',
        errorCode: 'BAD_REQUEST',
      };
    }
  }

  // APPROVED -> IN_PROGRESS: must be assigned to a developer, and user must be that assignee
  if (currentStatus === RequestStatus.APPROVED && toStatus === RequestStatus.IN_PROGRESS) {
    if (!request.assigneeId) {
      return {
        allowed: false,
        denialReason: 'Request must be assigned to a developer before work can begin',
        errorCode: 'FORBIDDEN',
      };
    }
    if (request.assigneeId !== user.id) {
      return {
        allowed: false,
        denialReason: 'Only the assigned developer can move this request to IN_PROGRESS',
        errorCode: 'FORBIDDEN',
      };
    }
  }

  // IN_PROGRESS -> COMPLETED: must be the assigned developer
  if (currentStatus === RequestStatus.IN_PROGRESS && toStatus === RequestStatus.COMPLETED) {
    if (!request.assigneeId || request.assigneeId !== user.id) {
      return {
        allowed: false,
        denialReason: 'Only the assigned developer can mark this request as COMPLETED',
        errorCode: 'FORBIDDEN',
      };
    }
  }

  return { allowed: true };
}

/**
 * Throws the corresponding AppError (InvalidTransitionError 409, ForbiddenError 403, or BadRequestError 400)
 * if the transition is not allowed.
 */
export function assertTransitionAllowed(
  currentStatus: RequestStatus,
  toStatus: RequestStatus,
  user: AuthenticatedUser,
  request: RequestTransitionContext,
  reason?: string
): void {
  const result = validateTransition(currentStatus, toStatus, user, request, reason);

  if (!result.allowed) {
    if (result.errorCode === 'INVALID_TRANSITION') {
      throw new InvalidTransitionError(result.denialReason);
    }
    if (result.errorCode === 'BAD_REQUEST') {
      throw new BadRequestError(result.denialReason);
    }
    throw new ForbiddenError(result.denialReason);
  }
}

