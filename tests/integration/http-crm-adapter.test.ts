import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../../apps/mock-crm-api/src/app';
import { HttpCrmAdapter } from '../../apps/api/src/integrations/crm/http-crm.adapter';
import {
  CrmNotFoundError,
  CrmAuthorizationError,
  CrmAuthenticationError,
} from '../../apps/api/src/integrations/crm/crm.errors';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';

describe('HttpCrmAdapter Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let adapter: HttpCrmAdapter;

  beforeAll(async () => {
    // Start mock-crm-api on an ephemeral port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://localhost:${addr.port}`;
        adapter = new HttpCrmAdapter({
          baseUrl,
          defaultIdentityKey: 'super_admin',
          timeoutMs: 3000,
        });
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should verify health check of upstream CRM', async () => {
    const health = await adapter.checkHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('mock-crm-api');
  });

  it('should retrieve current identity', async () => {
    const identity = await adapter.getCurrentIdentity('super_admin');
    expect(identity.identity.key).toBe('super_admin');
    expect(identity.scope.isSuperAdmin).toBe(true);
  });

  it('should list tenants with pagination', async () => {
    const res = await adapter.listAccessibleTenants(undefined, 1, 10);
    expect(res.data.length).toBe(2);
    expect(res.meta?.total).toBe(2);
  });

  it('should get tenant by ID', async () => {
    const tenant = await adapter.getTenantById(TENANT_ALPHA_ID);
    expect(tenant.id).toBe(TENANT_ALPHA_ID);
    expect(tenant.name).toBe('Tenant Alpha');
  });

  it('should list branches by tenant', async () => {
    const res = await adapter.listBranchesByTenant(TENANT_ALPHA_ID);
    expect(res.data.length).toBe(2);
    expect(res.data[0]?.tenantId).toBe(TENANT_ALPHA_ID);
  });

  it('should get branch by ID', async () => {
    const branch = await adapter.getBranchById(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(branch.id).toBe(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(branch.name).toBe('Alpha — Greater Noida');
  });

  it('should list employees by tenant', async () => {
    const res = await adapter.listEmployeesByTenant(TENANT_ALPHA_ID);
    expect(res.data.length).toBe(8);
  });

  it('should list employees by branch', async () => {
    const res = await adapter.listEmployeesByBranch(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(res.data.length).toBe(4);
  });

  it('should list eligible chat agents for branch', async () => {
    const agents = await adapter.listEligibleChatAgents(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(agents.length).toBe(2);
    expect(agents[0]?.eligibilityStatus).toBe(true);
  });

  it('should get chat designation by ID', async () => {
    const desig = await adapter.getChatDesignationById(ALPHA_DESIG_EXEC_ID);
    expect(desig.id).toBe(ALPHA_DESIG_EXEC_ID);
  });

  it('should map 404 from upstream into CrmNotFoundError', async () => {
    await expect(adapter.getTenantById('99999999-9999-4000-8000-999999999999')).rejects.toThrow(
      CrmNotFoundError,
    );
  });

  it('should map 403 cross-tenant denial into CrmAuthorizationError', async () => {
    await expect(adapter.getTenantById(TENANT_ALPHA_ID, 'beta_admin')).rejects.toThrow(
      CrmAuthorizationError,
    );
  });

  it('should map 401 invalid identity into CrmAuthenticationError', async () => {
    await expect(adapter.getTenantById(TENANT_ALPHA_ID, 'invalid_identity_header')).rejects.toThrow(
      CrmAuthenticationError,
    );
  });
});
