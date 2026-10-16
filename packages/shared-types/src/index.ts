import { z } from 'zod';

// ============================================================================
// Core Domain Entities
// ============================================================================

export type EntityStatus = 'active' | 'inactive';

export type CrmRole = 'super_admin' | 'tenant_admin' | 'branch_admin' | 'employee';

export interface Tenant {
  id: string; // UUID
  name: string;
  status: EntityStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface Branch {
  id: string; // UUID
  tenantId: string; // UUID
  name: string;
  city: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatDesignation {
  id: string; // UUID
  tenantId: string; // UUID
  name: string;
  description: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string; // UUID
  tenantId: string; // UUID
  branchId: string; // UUID
  fullName: string;
  email: string;
  status: EntityStatus;
  crmRole: CrmRole;
  chatSupportEligible: boolean;
  designationId: string | null; // UUID or null
  createdAt: string;
  updatedAt: string;
}

export interface EligibleChatAgent {
  employeeId: string;
  tenantId: string;
  branchId: string;
  fullName: string;
  email: string;
  designationId: string;
  designationName: string;
  eligibilityStatus: boolean;
  employeeStatus: EntityStatus;
  exampleAssignmentWeight?: number; // Optional fixture weight, real routing is owned by helpdesk
}

// ============================================================================
// Permissions and Authorization
// ============================================================================

export type Permission =
  | 'tenants:read'
  | 'branches:read'
  | 'employees:read'
  | 'designations:read'
  | 'employees:manage'
  | 'chat_agents:read';

export type MockIdentityKey =
  | 'super_admin'
  | 'alpha_admin'
  | 'alpha_branch_admin'
  | 'alpha_employee'
  | 'beta_admin'
  | 'beta_branch_admin'
  | 'beta_employee';

export interface MockIdentity {
  key: MockIdentityKey;
  userId: string;
  name: string;
  email: string;
  role: CrmRole;
  tenantId: string | null; // null for super_admin
  branchId: string | null; // null for tenant_admin / super_admin
  permissions: Permission[];
}

export interface CurrentIdentityResponse {
  identity: MockIdentity;
  scope: {
    isSuperAdmin: boolean;
    authorizedTenantId: string | null;
    authorizedBranchId: string | null;
    allowedPermissions: Permission[];
  };
}

// ============================================================================
// API Envelopes and Pagination
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const UuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page must be a positive integer >= 1',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'limit must be between 1 and 100',
    }),
});

export const EmployeeFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  branchId: z.string().uuid().optional(),
  role: z.enum(['super_admin', 'tenant_admin', 'branch_admin', 'employee']).optional(),
  chatEligible: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined)),
});

export const BranchFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export const DesignationFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});
