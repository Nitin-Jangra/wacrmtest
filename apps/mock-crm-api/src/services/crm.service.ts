import {
  Tenant,
  Branch,
  Employee,
  ChatDesignation,
  EligibleChatAgent,
  MockIdentity,
  CurrentIdentityResponse,
} from '@gym-helpdesk/shared-types';
import {
  mockCrmRepository,
  PaginatedResult,
  EmployeeFilters,
  GenericFilters,
} from '../repositories/crm.repository';
import { NotFoundError, ForbiddenError } from '../errors/app.errors';

export class CrmService {
  constructor(private readonly repo = mockCrmRepository) {}

  // --- Current Mock Identity ---
  public async getMe(identity: MockIdentity): Promise<CurrentIdentityResponse> {
    const isSuperAdmin = identity.role === 'super_admin' || identity.tenantId === null;
    return {
      identity,
      scope: {
        isSuperAdmin,
        authorizedTenantId: identity.tenantId,
        authorizedBranchId: identity.branchId,
        allowedPermissions: identity.permissions,
      },
    };
  }

  // --- Tenants ---
  public async listTenants(
    identity: MockIdentity,
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Tenant>> {
    // If super_admin, list all tenants
    if (identity.role === 'super_admin' || identity.tenantId === null) {
      return this.repo.listTenants(filters, page, limit);
    }

    // Otherwise, user only sees their own tenant
    const tenant = await this.repo.getTenantById(identity.tenantId);
    if (!tenant) {
      return {
        data: [],
        meta: { page: 1, limit: limit || 20, total: 0, totalPages: 0 },
      };
    }

    if (filters?.status && tenant.status !== filters.status) {
      return {
        data: [],
        meta: { page: 1, limit: limit || 20, total: 0, totalPages: 0 },
      };
    }

    return {
      data: [tenant],
      meta: {
        page: 1,
        limit: limit || 20,
        total: 1,
        totalPages: 1,
      },
    };
  }

  public async getTenantById(identity: MockIdentity, tenantId: string): Promise<Tenant> {
    // Check tenant access
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to access this tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    const tenant = await this.repo.getTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
    }

    return tenant;
  }

  // --- Branches ---
  public async listBranchesByTenant(
    identity: MockIdentity,
    tenantId: string,
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Branch>> {
    // Verify tenant authorization
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to access branches for this tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    const result = await this.repo.listBranchesByTenant(tenantId, filters, page, limit);

    // If caller is branch-scoped (branch_admin or employee), filter to their branch
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null
    ) {
      const filtered = result.data.filter((b) => b.id === identity.branchId);
      return {
        data: filtered,
        meta: {
          page: 1,
          limit: limit || 20,
          total: filtered.length,
          totalPages: 1,
        },
      };
    }

    return result;
  }

  public async getBranchById(identity: MockIdentity, branchId: string): Promise<Branch> {
    const branch = await this.repo.getBranchById(branchId);
    if (!branch) {
      throw new NotFoundError(`Branch with id "${branchId}" not found`);
    }

    // Check tenant scope
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== branch.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view this branch.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    // Check branch scope for branch users
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null &&
      identity.branchId !== branchId
    ) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to access this branch.',
        'BRANCH_SCOPE_FORBIDDEN',
      );
    }

    return branch;
  }

  // --- Employees ---
  public async listEmployeesByTenant(
    identity: MockIdentity,
    tenantId: string,
    filters?: EmployeeFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Employee>> {
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view employees from this tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    // If caller is branch-scoped, constrain branchId
    const effectiveFilters: EmployeeFilters = { ...filters };
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null
    ) {
      effectiveFilters.branchId = identity.branchId;
    }

    return this.repo.listEmployeesByTenant(tenantId, effectiveFilters, page, limit);
  }

  public async listEmployeesByBranch(
    identity: MockIdentity,
    branchId: string,
    filters?: EmployeeFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Employee>> {
    const branch = await this.repo.getBranchById(branchId);
    if (!branch) {
      throw new NotFoundError(`Branch with id "${branchId}" not found`);
    }

    // Check tenant scope
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== branch.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view employees from another tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    // Check branch scope
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null &&
      identity.branchId !== branchId
    ) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to view employees outside your branch.',
        'BRANCH_SCOPE_FORBIDDEN',
      );
    }

    return this.repo.listEmployeesByBranch(branchId, filters, page, limit);
  }

  public async getEmployeeById(identity: MockIdentity, employeeId: string): Promise<Employee> {
    const employee = await this.repo.getEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundError(`Employee with id "${employeeId}" not found`);
    }

    // Check tenant scope
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== employee.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view this employee.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    // Check branch scope
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null &&
      identity.branchId !== employee.branchId
    ) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to view employees outside your branch.',
        'BRANCH_SCOPE_FORBIDDEN',
      );
    }

    return employee;
  }

  // --- Chat Designations ---
  public async listDesignationsByTenant(
    identity: MockIdentity,
    tenantId: string,
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ChatDesignation>> {
    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view designations for this tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    return this.repo.listDesignationsByTenant(tenantId, filters, page, limit);
  }

  public async getDesignationById(
    identity: MockIdentity,
    designationId: string,
  ): Promise<ChatDesignation> {
    const designation = await this.repo.getDesignationById(designationId);
    if (!designation) {
      throw new NotFoundError(`Designation with id "${designationId}" not found`);
    }

    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== designation.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view this designation.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    return designation;
  }

  // --- Eligible Chat Agents ---
  public async listEligibleChatAgents(
    identity: MockIdentity,
    branchId: string,
  ): Promise<EligibleChatAgent[]> {
    const branch = await this.repo.getBranchById(branchId);
    if (!branch) {
      throw new NotFoundError(`Branch with id "${branchId}" not found`);
    }

    if (identity.role !== 'super_admin' && identity.tenantId !== null) {
      if (identity.tenantId !== branch.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view chat agents for this branch.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }
    }

    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null &&
      identity.branchId !== branchId
    ) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to view chat agents for another branch.',
        'BRANCH_SCOPE_FORBIDDEN',
      );
    }

    return this.repo.listEligibleChatAgents(branchId);
  }
}

export const crmService = new CrmService();
