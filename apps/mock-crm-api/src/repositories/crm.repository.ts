import {
  Tenant,
  Branch,
  Employee,
  ChatDesignation,
  EligibleChatAgent,
  PaginationMeta,
} from '@gym-helpdesk/shared-types';
import {
  FIXTURE_TENANTS,
  FIXTURE_BRANCHES,
  FIXTURE_EMPLOYEES,
  FIXTURE_DESIGNATIONS,
} from '../data/fixtures';
import { IntegrityValidator } from './integrity.validator';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface EmployeeFilters {
  status?: 'active' | 'inactive';
  branchId?: string;
  role?: string;
  chatEligible?: boolean;
}

export interface GenericFilters {
  status?: 'active' | 'inactive';
}

export class MockCrmRepository {
  private tenants: Tenant[];
  private branches: Branch[];
  private employees: Employee[];
  private designations: ChatDesignation[];

  constructor() {
    // Deep clone fixtures to protect against mutations
    this.tenants = JSON.parse(JSON.stringify(FIXTURE_TENANTS));
    this.branches = JSON.parse(JSON.stringify(FIXTURE_BRANCHES));
    this.employees = JSON.parse(JSON.stringify(FIXTURE_EMPLOYEES));
    this.designations = JSON.parse(JSON.stringify(FIXTURE_DESIGNATIONS));

    // Validate dataset relational integrity at startup
    const validation = IntegrityValidator.validateDataset(
      this.tenants,
      this.branches,
      this.employees,
      this.designations,
    );

    if (!validation.isValid) {
      throw new Error(
        `Mock CRM Fixture integrity validation failed: ${validation.errors.join('; ')}`,
      );
    }
  }

  private paginate<T>(items: T[], page: number = 1, limit: number = 20): PaginatedResult<T> {
    const total = items.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIndex = (safePage - 1) * safeLimit;
    const data = items.slice(startIndex, startIndex + safeLimit);

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  // --- Tenants ---
  public async getTenantById(tenantId: string): Promise<Tenant | null> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    return tenant ? { ...tenant } : null;
  }

  public async listTenants(
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Tenant>> {
    let list = this.tenants;
    if (filters?.status) {
      list = list.filter((t) => t.status === filters.status);
    }
    return this.paginate(list, page, limit);
  }

  // --- Branches ---
  public async getBranchById(branchId: string): Promise<Branch | null> {
    const branch = this.branches.find((b) => b.id === branchId);
    return branch ? { ...branch } : null;
  }

  public async listBranchesByTenant(
    tenantId: string,
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Branch>> {
    let list = this.branches.filter((b) => b.tenantId === tenantId);
    if (filters?.status) {
      list = list.filter((b) => b.status === filters.status);
    }
    return this.paginate(list, page, limit);
  }

  // --- Employees ---
  public async getEmployeeById(employeeId: string): Promise<Employee | null> {
    const employee = this.employees.find((e) => e.id === employeeId);
    return employee ? { ...employee } : null;
  }

  public async listEmployeesByTenant(
    tenantId: string,
    filters?: EmployeeFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Employee>> {
    let list = this.employees.filter((e) => e.tenantId === tenantId);

    if (filters?.status) {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters?.branchId) {
      list = list.filter((e) => e.branchId === filters.branchId);
    }
    if (filters?.role) {
      list = list.filter((e) => e.crmRole === filters.role);
    }
    if (filters?.chatEligible !== undefined) {
      list = list.filter((e) => e.chatSupportEligible === filters.chatEligible);
    }

    return this.paginate(list, page, limit);
  }

  public async listEmployeesByBranch(
    branchId: string,
    filters?: EmployeeFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Employee>> {
    let list = this.employees.filter((e) => e.branchId === branchId);

    if (filters?.status) {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters?.role) {
      list = list.filter((e) => e.crmRole === filters.role);
    }
    if (filters?.chatEligible !== undefined) {
      list = list.filter((e) => e.chatSupportEligible === filters.chatEligible);
    }

    return this.paginate(list, page, limit);
  }

  // --- Chat Designations ---
  public async getDesignationById(designationId: string): Promise<ChatDesignation | null> {
    const desig = this.designations.find((d) => d.id === designationId);
    return desig ? { ...desig } : null;
  }

  public async listDesignationsByTenant(
    tenantId: string,
    filters?: GenericFilters,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ChatDesignation>> {
    let list = this.designations.filter((d) => d.tenantId === tenantId);
    if (filters?.status) {
      list = list.filter((d) => d.status === filters.status);
    }
    return this.paginate(list, page, limit);
  }

  // --- Eligible Chat Agents ---
  public async listEligibleChatAgents(branchId: string): Promise<EligibleChatAgent[]> {
    // Find active employees assigned to this branch who are chatSupportEligible
    const eligibleEmployees = this.employees.filter(
      (e) =>
        e.branchId === branchId &&
        e.status === 'active' &&
        e.chatSupportEligible === true &&
        e.designationId !== null,
    );

    const result: EligibleChatAgent[] = [];

    for (const emp of eligibleEmployees) {
      const designation = this.designations.find((d) => d.id === emp.designationId);
      if (designation && designation.status === 'active') {
        result.push({
          employeeId: emp.id,
          tenantId: emp.tenantId,
          branchId: emp.branchId,
          fullName: emp.fullName,
          email: emp.email,
          designationId: designation.id,
          designationName: designation.name,
          eligibilityStatus: true,
          employeeStatus: emp.status,
          exampleAssignmentWeight: 10,
        });
      }
    }

    return result;
  }
}

// Singleton instance for repository
export const mockCrmRepository = new MockCrmRepository();
