import { describe, it, expect } from 'vitest';
import { MockCrmRepository } from '../../apps/mock-crm-api/src/repositories/crm.repository';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  BETA_BRANCH_JAIPUR_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';

describe('MockCrmRepository Unit Tests', () => {
  const repo = new MockCrmRepository();

  describe('Tenants', () => {
    it('should retrieve a tenant by valid ID', async () => {
      const tenant = await repo.getTenantById(TENANT_ALPHA_ID);
      expect(tenant).not.toBeNull();
      expect(tenant?.name).toBe('Tenant Alpha');
      expect(tenant?.status).toBe('active');
    });

    it('should return null for unknown tenant ID', async () => {
      const tenant = await repo.getTenantById('99999999-9999-4000-8000-999999999999');
      expect(tenant).toBeNull();
    });

    it('should list tenants with pagination metadata', async () => {
      const result = await repo.listTenants(undefined, 1, 10);
      expect(result.data.length).toBe(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('Branches', () => {
    it('should list branches belonging only to requested tenant', async () => {
      const alphaBranches = await repo.listBranchesByTenant(TENANT_ALPHA_ID);
      expect(alphaBranches.data.length).toBe(2);
      expect(alphaBranches.data.every((b) => b.tenantId === TENANT_ALPHA_ID)).toBe(true);

      const betaBranches = await repo.listBranchesByTenant(TENANT_BETA_ID);
      expect(betaBranches.data.length).toBe(2);
      expect(betaBranches.data.every((b) => b.tenantId === TENANT_BETA_ID)).toBe(true);
    });

    it('should retrieve branch by ID', async () => {
      const branch = await repo.getBranchById(ALPHA_BRANCH_GREATER_NOIDA_ID);
      expect(branch).not.toBeNull();
      expect(branch?.name).toBe('Alpha — Greater Noida');
    });
  });

  describe('Employees & Filtering', () => {
    it('should return 4 employees for Alpha Greater Noida branch', async () => {
      const result = await repo.listEmployeesByBranch(ALPHA_BRANCH_GREATER_NOIDA_ID);
      expect(result.data.length).toBe(4);
      expect(result.data.every((e) => e.branchId === ALPHA_BRANCH_GREATER_NOIDA_ID)).toBe(true);
    });

    it('should filter employees by active status', async () => {
      const activeEmployees = await repo.listEmployeesByBranch(ALPHA_BRANCH_GREATER_NOIDA_ID, {
        status: 'active',
      });
      expect(activeEmployees.data.length).toBe(3);

      const inactiveEmployees = await repo.listEmployeesByBranch(ALPHA_BRANCH_GREATER_NOIDA_ID, {
        status: 'inactive',
      });
      expect(inactiveEmployees.data.length).toBe(1);
      expect(inactiveEmployees.data[0]?.fullName).toBe('Ananya Verma');
    });

    it('should filter employees by role', async () => {
      const admins = await repo.listEmployeesByBranch(ALPHA_BRANCH_GREATER_NOIDA_ID, {
        role: 'branch_admin',
      });
      expect(admins.data.length).toBe(1);
      expect(admins.data[0]?.fullName).toBe('Aarav Sharma');
    });

    it('should paginate results properly', async () => {
      const page1 = await repo.listEmployeesByTenant(TENANT_ALPHA_ID, undefined, 1, 3);
      expect(page1.data.length).toBe(3);
      expect(page1.meta.page).toBe(1);
      expect(page1.meta.limit).toBe(3);
      expect(page1.meta.total).toBe(8);
      expect(page1.meta.totalPages).toBe(3);

      const page2 = await repo.listEmployeesByTenant(TENANT_ALPHA_ID, undefined, 2, 3);
      expect(page2.data.length).toBe(3);
      expect(page2.data[0]?.id).not.toBe(page1.data[0]?.id);
    });
  });

  describe('Eligible Chat Agents', () => {
    it('should return only active and chat-eligible employees with active designations', async () => {
      const agents = await repo.listEligibleChatAgents(ALPHA_BRANCH_GREATER_NOIDA_ID);
      // In Alpha Greater Noida:
      // - Aarav Sharma: active, chatEligible=true, desig=Alpha Desig 2 (active) -> YES
      // - Diya Patel: active, chatEligible=true, desig=Alpha Desig 1 (active) -> YES
      // - Ishaan Gupta: active, chatEligible=false -> NO
      // - Ananya Verma: inactive, chatEligible=true -> NO (inactive status excludes them)
      expect(agents.length).toBe(2);
      expect(agents.map((a) => a.fullName)).toEqual(
        expect.arrayContaining(['Aarav Sharma', 'Diya Patel']),
      );
      expect(agents.every((a) => a.eligibilityStatus === true)).toBe(true);
      expect(agents.every((a) => a.employeeStatus === 'active')).toBe(true);
      expect(agents.every((a) => Boolean(a.designationName))).toBe(true);
    });

    it('should return eligible agents for Beta Jaipur branch', async () => {
      const agents = await repo.listEligibleChatAgents(BETA_BRANCH_JAIPUR_ID);
      // In Beta Jaipur:
      // - Meera Joshi (branch_admin, chatEligible=true, active) -> YES
      // - Karan Malhotra (employee, chatEligible=true, active) -> YES
      expect(agents.length).toBe(2);
      expect(agents.every((a) => a.tenantId === TENANT_BETA_ID)).toBe(true);
    });
  });
});
