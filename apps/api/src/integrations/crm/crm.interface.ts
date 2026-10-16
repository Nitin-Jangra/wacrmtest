import {
  Tenant,
  Branch,
  Employee,
  ChatDesignation,
  EligibleChatAgent,
  CurrentIdentityResponse,
  ApiResponse,
} from '@gym-helpdesk/shared-types';

export interface CrmEmployeeFilters {
  status?: 'active' | 'inactive';
  branchId?: string;
  role?: string;
  chatEligible?: boolean;
}

export interface CrmGenericFilters {
  status?: 'active' | 'inactive';
}

export interface ICrmAdapter {
  /**
   * Health status of CRM service
   */
  checkHealth(): Promise<{ status: string; service: string; version: string }>;

  /**
   * Get tenant by ID
   */
  getTenantById(tenantId: string, identityKey?: string): Promise<Tenant>;

  /**
   * List accessible tenants
   */
  listAccessibleTenants(
    filters?: CrmGenericFilters,
    page?: number,
    limit?: number,
    identityKey?: string,
  ): Promise<ApiResponse<Tenant[]>>;

  /**
   * List branches for a tenant
   */
  listBranchesByTenant(
    tenantId: string,
    filters?: CrmGenericFilters,
    page?: number,
    limit?: number,
    identityKey?: string,
  ): Promise<ApiResponse<Branch[]>>;

  /**
   * Get branch by ID
   */
  getBranchById(branchId: string, identityKey?: string): Promise<Branch>;

  /**
   * List employees for a tenant
   */
  listEmployeesByTenant(
    tenantId: string,
    filters?: CrmEmployeeFilters,
    page?: number,
    limit?: number,
    identityKey?: string,
  ): Promise<ApiResponse<Employee[]>>;

  /**
   * List employees for a branch
   */
  listEmployeesByBranch(
    branchId: string,
    filters?: CrmEmployeeFilters,
    page?: number,
    limit?: number,
    identityKey?: string,
  ): Promise<ApiResponse<Employee[]>>;

  /**
   * Get employee by ID
   */
  getEmployeeById(employeeId: string, identityKey?: string): Promise<Employee>;

  /**
   * List chat designations for a tenant
   */
  listChatDesignations(
    tenantId: string,
    filters?: CrmGenericFilters,
    page?: number,
    limit?: number,
    identityKey?: string,
  ): Promise<ApiResponse<ChatDesignation[]>>;

  /**
   * Get chat designation by ID
   */
  getChatDesignationById(designationId: string, identityKey?: string): Promise<ChatDesignation>;

  /**
   * List eligible chat agents for a branch
   */
  listEligibleChatAgents(branchId: string, identityKey?: string): Promise<EligibleChatAgent[]>;

  /**
   * Get current simulated identity and scope
   */
  getCurrentIdentity(identityKey?: string): Promise<CurrentIdentityResponse>;
}
