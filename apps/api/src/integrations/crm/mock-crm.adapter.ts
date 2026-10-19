import {
  Tenant,
  Branch,
  Employee,
  ChatDesignation,
  EligibleChatAgent,
  CurrentIdentityResponse,
  ApiResponse,
  MockIdentity,
} from '@gym-helpdesk/shared-types';
import { ICrmAdapter, CrmGenericFilters, CrmEmployeeFilters } from './crm.interface';
import { CrmNotFoundError, CrmAuthorizationError } from './crm.errors';

/**
 * In-memory Mock CRM Adapter for local isolated testing without network overhead.
 * Maintains its own decoupled in-memory datasets adhering to ICrmAdapter.
 */
export class MockCrmAdapter implements ICrmAdapter {
  private tenants: Tenant[] = [
    {
      id: '11111111-1111-4000-8000-000000000001',
      name: 'Tenant Alpha',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { tier: 'enterprise' },
    },
    {
      id: '22222222-2222-4000-8000-000000000002',
      name: 'Tenant Beta',
      status: 'active',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
      metadata: { tier: 'standard' },
    },
  ];

  private branches: Branch[] = [
    {
      id: 'aaaaaaaa-0001-4000-8000-000000000001',
      tenantId: '11111111-1111-4000-8000-000000000001',
      name: 'Alpha — Greater Noida',
      city: 'Greater Noida',
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'aaaaaaaa-0002-4000-8000-000000000002',
      tenantId: '11111111-1111-4000-8000-000000000001',
      name: 'Alpha — Noida',
      city: 'Noida',
      status: 'active',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
    {
      id: 'bbbbbbbb-0001-4000-8000-000000000001',
      tenantId: '22222222-2222-4000-8000-000000000002',
      name: 'Beta — Jaipur',
      city: 'Jaipur',
      status: 'active',
      createdAt: '2026-01-16T00:00:00.000Z',
      updatedAt: '2026-01-16T00:00:00.000Z',
    },
    {
      id: 'bbbbbbbb-0002-4000-8000-000000000002',
      tenantId: '22222222-2222-4000-8000-000000000002',
      name: 'Beta — Gurugram',
      city: 'Gurugram',
      status: 'active',
      createdAt: '2026-01-17T00:00:00.000Z',
      updatedAt: '2026-01-17T00:00:00.000Z',
    },
  ];

  private designations: ChatDesignation[] = [
    {
      id: 'd1111111-0001-4000-8000-000000000001',
      tenantId: '11111111-1111-4000-8000-000000000001',
      name: 'Chat Support Executive',
      description: 'Frontline chat handling',
      status: 'active',
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    },
    {
      id: 'd1111111-0002-4000-8000-000000000002',
      tenantId: '11111111-1111-4000-8000-000000000001',
      name: 'Senior Chat Executive',
      description: 'Escalations and complex support',
      status: 'active',
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    },
    {
      id: 'd2222222-0001-4000-8000-000000000001',
      tenantId: '22222222-2222-4000-8000-000000000002',
      name: 'Customer Care Agent',
      description: 'Primary customer support',
      status: 'active',
      createdAt: '2026-01-18T00:00:00.000Z',
      updatedAt: '2026-01-18T00:00:00.000Z',
    },
  ];

  private employees: Employee[] = [
    {
      id: 'e1111111-0001-4000-8000-000000000001',
      tenantId: '11111111-1111-4000-8000-000000000001',
      branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      status: 'active',
      crmRole: 'branch_admin',
      chatSupportEligible: true,
      designationId: 'd1111111-0002-4000-8000-000000000002',
      createdAt: '2026-01-06T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
    },
    {
      id: 'e1111111-0002-4000-8000-000000000002',
      tenantId: '11111111-1111-4000-8000-000000000001',
      branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
      fullName: 'Diya Patel',
      email: 'diya.patel@example.com',
      status: 'active',
      crmRole: 'employee',
      chatSupportEligible: true,
      designationId: 'd1111111-0001-4000-8000-000000000001',
      createdAt: '2026-01-06T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
    },
    {
      id: 'e2222222-0001-4000-8000-000000000001',
      tenantId: '22222222-2222-4000-8000-000000000002',
      branchId: 'bbbbbbbb-0001-4000-8000-000000000001',
      fullName: 'Vikram Rathore',
      email: 'vikram.rathore@example.com',
      status: 'active',
      crmRole: 'tenant_admin',
      chatSupportEligible: false,
      designationId: null,
      createdAt: '2026-01-20T00:00:00.000Z',
      updatedAt: '2026-01-20T00:00:00.000Z',
    },
  ];

  public async checkHealth(): Promise<{ status: string; service: string; version: string }> {
    return {
      status: 'ok',
      service: 'in-memory-mock-crm-adapter',
      version: '1.0.0',
    };
  }

  public async getTenantById(tenantId: string, _identityKey?: string): Promise<Tenant> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new CrmNotFoundError(`Tenant with id ${tenantId} not found`);
    return { ...tenant };
  }

  public async listAccessibleTenants(
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    _identityKey?: string,
  ): Promise<ApiResponse<Tenant[]>> {
    let list = this.tenants;
    if (filters?.status) list = list.filter((t) => t.status === filters.status);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) || 1 },
    };
  }

  public async listBranchesByTenant(
    tenantId: string,
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    _identityKey?: string,
  ): Promise<ApiResponse<Branch[]>> {
    let list = this.branches.filter((b) => b.tenantId === tenantId);
    if (filters?.status) list = list.filter((b) => b.status === filters.status);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) || 1 },
    };
  }

  public async getBranchById(branchId: string, _identityKey?: string): Promise<Branch> {
    const branch = this.branches.find((b) => b.id === branchId);
    if (!branch) throw new CrmNotFoundError(`Branch with id ${branchId} not found`);
    return { ...branch };
  }

  public async listEmployeesByTenant(
    tenantId: string,
    filters?: CrmEmployeeFilters,
    page: number = 1,
    limit: number = 20,
    _identityKey?: string,
  ): Promise<ApiResponse<Employee[]>> {
    let list = this.employees.filter((e) => e.tenantId === tenantId);
    if (filters?.status) list = list.filter((e) => e.status === filters.status);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) || 1 },
    };
  }

  public async listEmployeesByBranch(
    branchId: string,
    filters?: CrmEmployeeFilters,
    page: number = 1,
    limit: number = 20,
    _identityKey?: string,
  ): Promise<ApiResponse<Employee[]>> {
    let list = this.employees.filter((e) => e.branchId === branchId);
    if (filters?.status) list = list.filter((e) => e.status === filters.status);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) || 1 },
    };
  }

  public async getEmployeeById(employeeId: string, _identityKey?: string): Promise<Employee> {
    const employee = this.employees.find((e) => e.id === employeeId);
    if (!employee) throw new CrmNotFoundError(`Employee with id ${employeeId} not found`);
    return { ...employee };
  }

  public async listChatDesignations(
    tenantId: string,
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    _identityKey?: string,
  ): Promise<ApiResponse<ChatDesignation[]>> {
    let list = this.designations.filter((d) => d.tenantId === tenantId);
    if (filters?.status) list = list.filter((d) => d.status === filters.status);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) || 1 },
    };
  }

  public async getChatDesignationById(
    designationId: string,
    _identityKey?: string,
  ): Promise<ChatDesignation> {
    const desig = this.designations.find((d) => d.id === designationId);
    if (!desig) throw new CrmNotFoundError(`Designation with id ${designationId} not found`);
    return { ...desig };
  }

  public async listEligibleChatAgents(
    branchId: string,
    _identityKey?: string,
  ): Promise<EligibleChatAgent[]> {
    const branch = this.branches.find((b) => b.id === branchId);
    if (!branch) throw new CrmNotFoundError(`Branch with id ${branchId} not found`);

    const emps = this.employees.filter(
      (e) =>
        e.branchId === branchId &&
        e.status === 'active' &&
        e.chatSupportEligible &&
        e.designationId,
    );

    return emps.map((e) => {
      const d = this.designations.find((des) => des.id === e.designationId);
      return {
        employeeId: e.id,
        tenantId: e.tenantId,
        branchId: e.branchId,
        fullName: e.fullName,
        email: e.email,
        designationId: d ? d.id : '',
        designationName: d ? d.name : 'Unknown',
        eligibilityStatus: true,
        employeeStatus: e.status,
        exampleAssignmentWeight: 10,
      };
    });
  }

  private mockIdentities: Record<string, MockIdentity> = {
    super_admin: {
      key: 'super_admin',
      userId: '00000000-0000-4000-8000-000000000001',
      name: 'Alex Vance (Super Admin)',
      email: 'superadmin@example.com',
      role: 'super_admin',
      tenantId: null,
      branchId: null,
      permissions: [
        'tenants:read',
        'branches:read',
        'employees:read',
        'designations:read',
        'chat_agents:read',
      ],
    },
    alpha_admin: {
      key: 'alpha_admin',
      userId: 'e1111111-0005-4000-8000-000000000005',
      name: 'Rohan Mehta (Alpha Admin)',
      email: 'rohan.mehta@example.com',
      role: 'tenant_admin',
      tenantId: '11111111-1111-4000-8000-000000000001',
      branchId: null,
      permissions: [
        'tenants:read',
        'branches:read',
        'employees:read',
        'designations:read',
        'chat_agents:read',
      ],
    },
    alpha_branch_admin: {
      key: 'alpha_branch_admin',
      userId: 'e1111111-0001-4000-8000-000000000001',
      name: 'Aarav Sharma (Alpha Greater Noida Admin)',
      email: 'aarav.sharma@example.com',
      role: 'branch_admin',
      tenantId: '11111111-1111-4000-8000-000000000001',
      branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
      permissions: ['branches:read', 'employees:read', 'designations:read', 'chat_agents:read'],
    },
    alpha_employee: {
      key: 'alpha_employee',
      userId: 'e1111111-0002-4000-8000-000000000002',
      name: 'Diya Patel (Alpha Greater Noida Employee)',
      email: 'diya.patel@example.com',
      role: 'employee',
      tenantId: '11111111-1111-4000-8000-000000000001',
      branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
      permissions: ['branches:read', 'employees:read'],
    },
    beta_admin: {
      key: 'beta_admin',
      userId: 'e2222222-0001-4000-8000-000000000001',
      name: 'Vikram Rathore (Beta Admin)',
      email: 'vikram.rathore@example.com',
      role: 'tenant_admin',
      tenantId: '22222222-2222-4000-8000-000000000002',
      branchId: null,
      permissions: [
        'tenants:read',
        'branches:read',
        'employees:read',
        'designations:read',
        'chat_agents:read',
      ],
    },
    beta_branch_admin: {
      key: 'beta_branch_admin',
      userId: 'e2222222-0002-4000-8000-000000000002',
      name: 'Meera Joshi (Beta Jaipur Admin)',
      email: 'meera.joshi@example.com',
      role: 'branch_admin',
      tenantId: '22222222-2222-4000-8000-000000000002',
      branchId: 'bbbbbbbb-0001-4000-8000-000000000001',
      permissions: ['branches:read', 'employees:read', 'designations:read', 'chat_agents:read'],
    },
    beta_employee: {
      key: 'beta_employee',
      userId: 'e2222222-0003-4000-8000-000000000003',
      name: 'Karan Malhotra (Beta Jaipur Employee)',
      email: 'karan.malhotra@example.com',
      role: 'employee',
      tenantId: '22222222-2222-4000-8000-000000000002',
      branchId: 'bbbbbbbb-0001-4000-8000-000000000001',
      permissions: ['branches:read', 'employees:read'],
    },
  };

  public async getCurrentIdentity(
    identityKey: string = 'super_admin',
  ): Promise<CurrentIdentityResponse> {
    if (identityKey === 'invalid_key' || !this.mockIdentities[identityKey]) {
      throw new CrmAuthorizationError('Invalid identity key');
    }
    const id = this.mockIdentities[identityKey]!;
    return {
      identity: { ...id },
      scope: {
        isSuperAdmin: id.role === 'super_admin',
        authorizedTenantId: id.tenantId,
        authorizedBranchId: id.branchId,
        allowedPermissions: [...id.permissions],
      },
    };
  }
}
