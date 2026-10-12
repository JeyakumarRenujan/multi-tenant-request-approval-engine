export type Role =
  | 'PLATFORM_ADMIN'
  | 'ORG_ADMIN'
  | 'MANAGER'
  | 'DEVELOPER'
  | 'CLIENT_USER';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type RequestCategory = 'BUG' | 'FEATURE_REQUEST' | 'SUPPORT' | 'GENERAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
  clientId: string | null;
  isActive?: boolean;
}

export interface Client {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  dueDate: string | null;
  rejectionReason: string | null;
  version: number;
  isOverdue: boolean;
  ownerId: string;
  assigneeId: string | null;
  clientId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string };
  assignee?: { id: string; name: string; email: string } | null;
  client?: { id: string; name: string };
}

export interface ActivityLog {
  id: string;
  requestId: string;
  organizationId: string;
  actorId: string;
  event: 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'STATUS_CHANGED';
  metadata: any;
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: Role };
}

export interface DashboardMetrics {
  total: number;
  overdue: number;
  byStatus: Record<RequestStatus, number>;
  byPriority: Record<RequestPriority, number>;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: any;
}
