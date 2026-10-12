import { RequestCategory, RequestPriority, RequestStatus, Role } from '@prisma/client';

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Multi-Tenant Client Request & Approval Workflow Engine API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for a multi-tenant client request management and approval engine with optimistic locking, strict tenant scoping, and immutable audit trails.',
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment API Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide a valid access token in the format: Bearer <token>',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'BAD_REQUEST',
              },
              message: {
                type: 'string',
                example: 'Validation error',
              },
              details: {
                type: 'object',
                nullable: true,
                example: [{ field: 'title', message: 'Title must be at least 3 characters' }],
              },
            },
          },
        },
      },
      UserRole: {
        type: 'string',
        enum: Object.values(Role),
      },
      RequestStatusEnum: {
        type: 'string',
        enum: Object.values(RequestStatus),
      },
      RequestCategoryEnum: {
        type: 'string',
        enum: Object.values(RequestCategory),
      },
      RequestPriorityEnum: {
        type: 'string',
        enum: Object.values(RequestPriority),
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { $ref: '#/components/schemas/UserRole' },
          isActive: { type: 'boolean' },
          organizationId: { type: 'string', format: 'uuid', nullable: true },
          clientId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Client: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Request: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { $ref: '#/components/schemas/RequestCategoryEnum' },
          priority: { $ref: '#/components/schemas/RequestPriorityEnum' },
          ownerId: { type: 'string', format: 'uuid' },
          assigneeId: { type: 'string', format: 'uuid', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          status: { $ref: '#/components/schemas/RequestStatusEnum' },
          rejectionReason: { type: 'string', nullable: true },
          version: { type: 'integer' },
          isOverdue: { type: 'boolean', description: 'Computed dynamically at read time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ActivityLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          requestId: { type: 'string', format: 'uuid' },
          actorId: { type: 'string', format: 'uuid' },
          event: { type: 'string', example: 'STATUS_CHANGED' },
          previousStatus: { $ref: '#/components/schemas/RequestStatusEnum', nullable: true },
          newStatus: { $ref: '#/components/schemas/RequestStatusEnum', nullable: true },
          metadata: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          actor: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              role: { $ref: '#/components/schemas/UserRole' },
            },
          },
        },
      },
      DashboardMetrics: {
        type: 'object',
        properties: {
          byStatus: {
            type: 'object',
            additionalProperties: { type: 'integer' },
          },
          byPriority: {
            type: 'object',
            additionalProperties: { type: 'integer' },
          },
          overdue: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Service health check',
        security: [],
        responses: {
          200: {
            description: 'Service is operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user credentials',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and issue new access token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens rotated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke active refresh token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Logged out successfully' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user profile',
        responses: {
          200: {
            description: 'Current user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/organizations': {
      post: {
        summary: 'Create a new tenant organization (PLATFORM_ADMIN only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Organization created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    organization: { $ref: '#/components/schemas/Organization' },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      get: {
        summary: 'List all organizations (PLATFORM_ADMIN only)',
        responses: {
          200: {
            description: 'List of organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    organizations: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Organization' },
                    },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/clients': {
      post: {
        summary: 'Create a new client entity in own organization (ORG_ADMIN only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Client created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    client: { $ref: '#/components/schemas/Client' },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      get: {
        summary: 'List clients in own organization (ORG_ADMIN only)',
        responses: {
          200: {
            description: 'List of clients',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clients: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Client' },
                    },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/clients/{id}': {
      get: {
        summary: 'Get client details by ID (ORG_ADMIN only)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Client details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    client: { $ref: '#/components/schemas/Client' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update client details (ORG_ADMIN only)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Client updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    client: { $ref: '#/components/schemas/Client' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/users': {
      post: {
        summary: 'Create tenant user (ORG_ADMIN only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string', minLength: 2 },
                  role: {
                    type: 'string',
                    enum: [Role.ORG_ADMIN, Role.MANAGER, Role.DEVELOPER, Role.CLIENT_USER],
                  },
                  clientId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      get: {
        summary: 'List users in own organization (ORG_ADMIN only)',
        responses: {
          200: {
            description: 'List of tenant users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/users/{id}': {
      patch: {
        summary: 'Update tenant user role or status (ORG_ADMIN only, cannot modify self)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: [Role.ORG_ADMIN, Role.MANAGER, Role.DEVELOPER, Role.CLIENT_USER],
                  },
                  isActive: { type: 'boolean' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'User updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/requests': {
      post: {
        summary: 'Create a new draft request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'priority'],
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 150 },
                  description: { type: 'string', minLength: 5, maxLength: 2000 },
                  category: { $ref: '#/components/schemas/RequestCategoryEnum' },
                  priority: { $ref: '#/components/schemas/RequestPriorityEnum' },
                  dueDate: { type: 'string', format: 'date-time', nullable: true },
                  clientId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description: 'Required for internal staff; omitted for CLIENT_USER',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Request created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request: { $ref: '#/components/schemas/Request' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
      get: {
        summary: 'List requests with role-based visibility and filters',
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/RequestStatusEnum' } },
          { name: 'priority', in: 'query', schema: { $ref: '#/components/schemas/RequestPriorityEnum' } },
          { name: 'category', in: 'query', schema: { $ref: '#/components/schemas/RequestCategoryEnum' } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'overdue', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['createdAt', 'dueDate', 'priority', 'title'], default: 'createdAt' },
          },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          200: {
            description: 'Paginated requests response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Request' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        pageSize: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/requests/{id}': {
      get: {
        summary: 'Get request detail by ID with visibility enforcement and computed isOverdue',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Request detail response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request: { $ref: '#/components/schemas/Request' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Edit draft request (creator only, optimistic locking with expectedVersion)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { $ref: '#/components/schemas/RequestCategoryEnum' },
                  priority: { $ref: '#/components/schemas/RequestPriorityEnum' },
                  dueDate: { type: 'string', format: 'date-time', nullable: true },
                  expectedVersion: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Request updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request: { $ref: '#/components/schemas/Request' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/requests/{id}/assign': {
      patch: {
        summary: 'Assign active developer to request (MANAGER only, optimistic locking)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['assigneeId'],
                properties: {
                  assigneeId: { type: 'string', format: 'uuid' },
                  expectedVersion: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Request assigned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request: { $ref: '#/components/schemas/Request' },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/requests/{id}/transition': {
      post: {
        summary: 'Transition request workflow state (state machine checked, atomic concurrency lock)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['toStatus', 'expectedVersion'],
                properties: {
                  toStatus: { $ref: '#/components/schemas/RequestStatusEnum' },
                  expectedVersion: { type: 'integer', minimum: 1 },
                  reason: { type: 'string', description: 'Mandatory when toStatus is REJECTED' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Workflow transitioned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request: { $ref: '#/components/schemas/Request' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/requests/{id}/history': {
      get: {
        summary: 'Get chronological activity audit history (read-only, tenant-scoped)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Audit history list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    history: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ActivityLog' },
                    },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/dashboard': {
      get: {
        summary: 'Get tenant-scoped dashboard metrics (byStatus, byPriority, overdue, total)',
        responses: {
          200: {
            description: 'Dashboard metrics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardMetrics' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
  },
  responses: {
    BadRequest: {
      description: 'Bad Request / Validation Failure',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    Unauthorized: {
      description: 'Unauthorized / Missing or invalid token',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    Forbidden: {
      description: 'Forbidden / Role lacks permission',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    NotFound: {
      description: 'Resource not found or cross-tenant access prevented',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    Conflict: {
      description: 'Conflict / Version mismatch or illegal workflow transition',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
};
