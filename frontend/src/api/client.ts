import type {
  ApiErrorDetail,
  Client,
  DashboardMetrics,
  Organization,
  RequestCategory,
  RequestItem,
  RequestPriority,
  RequestStatus,
  User,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(status: number, errorData: ApiErrorDetail) {
    super(errorData.message || 'API request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = errorData.code || 'UNKNOWN_ERROR';
    this.details = errorData.details;
  }
}

// In-memory access token storage (Requirement: access token stored in memory, not localStorage)
let memoryAccessToken: string | null = null;
let onLogoutListener: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const tokenStorage = {
  getAccessToken: () => memoryAccessToken,
  setAccessToken: (token: string | null) => {
    memoryAccessToken = token;
  },
  // Refresh token in sessionStorage as documented trade-off
  getRefreshToken: () => sessionStorage.getItem('refresh_token'),
  setRefreshToken: (token: string | null) => {
    if (token) {
      sessionStorage.setItem('refresh_token', token);
    } else {
      sessionStorage.removeItem('refresh_token');
    }
  },
  clear: () => {
    memoryAccessToken = null;
    sessionStorage.removeItem('refresh_token');
  },
  setOnLogout: (listener: () => void) => {
    onLogoutListener = listener;
  },
};

/**
 * Attempts to rotate refresh token once and obtain a new access token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      tokenStorage.clear();
      if (onLogoutListener) onLogoutListener();
      return null;
    }

    const data = await res.json();
    tokenStorage.setAccessToken(data.accessToken);
    if (data.refreshToken) {
      tokenStorage.setRefreshToken(data.refreshToken);
    }
    return data.accessToken;
  } catch {
    tokenStorage.clear();
    if (onLogoutListener) onLogoutListener();
    return null;
  }
}

/**
 * Core API fetch wrapper with automated token attachment and 401 retry
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: err.message || 'Network request failed. Is the server running?',
    });
  }

  // Handle 401 Unauthorized with token refresh (once)
  if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      // Retry original request once with new token
      return apiFetch<T>(endpoint, options, true);
    } else {
      tokenStorage.clear();
      if (onLogoutListener) onLogoutListener();
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: 'Your session has expired. Please log in again.',
      });
    }
  }

  // Parse response
  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorData: ApiErrorDetail = data?.error || {
      code: `HTTP_${res.status}`,
      message: res.statusText || 'An unexpected error occurred',
    };
    throw new ApiError(res.status, errorData);
  }

  return data as T;
}

// ----------------- Typed API Service Methods -----------------

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: (refreshToken?: string) =>
    apiFetch<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refreshToken || tokenStorage.getRefreshToken() }),
    }),

  getMe: () => apiFetch<{ user: User } & User>('/auth/me'),

  // Dashboard
  getDashboard: () => apiFetch<DashboardMetrics>('/dashboard'),

  // Requests
  getRequests: (params: {
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    overdue?: boolean | string;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.category) query.set('category', params.category);
    if (params.assigneeId) query.set('assigneeId', params.assigneeId);
    if (params.overdue !== undefined && params.overdue !== '') {
      query.set('overdue', String(params.overdue));
    }
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const qs = query.toString();
    return apiFetch<{
      data: RequestItem[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`/requests${qs ? `?${qs}` : ''}`);
  },

  getRequestById: (id: string) => apiFetch<{ request: RequestItem }>(`/requests/${id}`),

  createRequest: (data: {
    title: string;
    description: string;
    category: RequestCategory;
    priority: RequestPriority;
    dueDate?: string | null;
  }) =>
    apiFetch<{ request: RequestItem }>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRequest: (
    id: string,
    data: {
      title?: string;
      description?: string;
      category?: RequestCategory;
      priority?: RequestPriority;
      dueDate?: string | null;
      expectedVersion?: number;
    }
  ) =>
    apiFetch<{ request: RequestItem }>(`/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  assignRequest: (id: string, assigneeId: string, expectedVersion?: number) =>
    apiFetch<{ request: RequestItem }>(`/requests/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId, expectedVersion }),
    }),

  transitionRequest: (
    id: string,
    payload: {
      toStatus: RequestStatus;
      expectedVersion: number;
      reason?: string;
    }
  ) =>
    apiFetch<{ request: RequestItem }>(`/requests/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRequestHistory: (id: string) => apiFetch<{ history: any[] }>(`/requests/${id}/history`),

  // Users (ORG_ADMIN or Assignee lookup for MANAGER)
  getUsers: (params?: { role?: string; isActive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    const qs = query.toString();
    return apiFetch<{ users: User[] }>(`/users${qs ? `?${qs}` : ''}`);
  },

  getAssignableDevelopers: () =>
    apiFetch<{ developers: { id: string; name: string }[] }>('/users/assignable'),

  createUser: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    clientId?: string;
  }) =>
    apiFetch<{ user: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: { role?: string; isActive?: boolean }) =>
    apiFetch<{ user: User }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Clients (ORG_ADMIN)
  getClients: () => apiFetch<{ clients: Client[] }>('/clients'),

  createClient: (data: { name: string }) =>
    apiFetch<{ client: Client }>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateClient: (id: string, data: { name: string }) =>
    apiFetch<{ client: Client }>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Organizations (PLATFORM_ADMIN)
  getOrganizations: () => apiFetch<{ organizations: Organization[] }>('/organizations'),

  createOrganization: (data: { name: string }) =>
    apiFetch<{ organization: Organization }>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

