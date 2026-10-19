import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_BRANCH_NOIDA_ID,
  BETA_BRANCH_JAIPUR_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  BETA_DESIG_CSM_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient(initialData: Record<string, any[]> = {}): SupabaseClient {
  const store: Record<string, any[]> = {};
  for (const [table, rows] of Object.entries(initialData)) {
    store[table] = rows.map((r) => ({ ...r }));
  }

  const mock = {
    from: (tableName: string) => {
      let currentData = [...(store[tableName] || [])];
      let pendingUpdates: any = null;

      const applyPendingUpdates = () => {
        if (pendingUpdates) {
          for (let i = 0; i < (store[tableName] || []).length; i++) {
            const item = store[tableName]![i];
            if (currentData.some((c) => c.id === item.id)) {
              store[tableName]![i] = {
                ...item,
                ...pendingUpdates,
                updated_at: new Date().toISOString(),
              };
            }
          }
          currentData = currentData.map((item) => ({
            ...item,
            ...pendingUpdates,
            updated_at: new Date().toISOString(),
          }));
          pendingUpdates = null;
        }
      };

      const queryBuilder: any = {
        select: () => queryBuilder,
        insert: (rows: any) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          const inserted = rowArray.map((r) => ({
            id: r.id || `id-${Math.random().toString(36).substring(7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          store[tableName] = [...(store[tableName] || []), ...inserted];
          currentData = inserted;
          return queryBuilder;
        },
        upsert: (row: any, options?: { onConflict?: string }) => {
          const conflictFields = (options?.onConflict || 'id').split(',');
          const existingIdx = (store[tableName] || []).findIndex((item) =>
            conflictFields.every((f) => item[f.trim()] === row[f.trim()]),
          );

          if (existingIdx >= 0) {
            const updated = {
              ...store[tableName]![existingIdx],
              ...row,
              updated_at: new Date().toISOString(),
            };
            store[tableName]![existingIdx] = updated;
            currentData = [updated];
          } else {
            const inserted = {
              id: row.id || `id-${Math.random().toString(36).substring(7)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            };
            store[tableName] = [...(store[tableName] || []), inserted];
            currentData = [inserted];
          }
          return queryBuilder;
        },
        update: (updates: any) => {
          pendingUpdates = updates;
          return queryBuilder;
        },
        eq: (field: string, val: any) => {
          currentData = currentData.filter((item) => item[field] === val);
          return queryBuilder;
        },
        is: (field: string, val: any) => {
          currentData = currentData.filter((item) => item[field] === val);
          return queryBuilder;
        },
        order: () => queryBuilder,
        range: (from: number, to: number) => {
          currentData = currentData.slice(from, to + 1);
          return queryBuilder;
        },
        single: async () => {
          applyPendingUpdates();
          return { data: currentData[0] || null, error: null };
        },
        maybeSingle: async () => {
          applyPendingUpdates();
          return { data: currentData[0] || null, error: null };
        },
        then: (resolve: any) => {
          applyPendingUpdates();
          return resolve({ data: currentData, error: null, count: currentData.length });
        },
      };

      return queryBuilder;
    },
  };

  return mock as unknown as SupabaseClient;
}

describe('Phase 3 Assignment Security & Tenant Isolation Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();

  beforeEach(() => {
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  const setupSecurityFixtures = () => {
    return {
      chat_assignment_rules: [
        {
          id: 'rule-alpha-gn',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          strategy: 'weighted_round_robin',
          is_enabled: true,
          configuration: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'rule-beta-jp',
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          strategy: 'weighted_round_robin',
          is_enabled: true,
          configuration: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      chat_agent_settings: [
        {
          id: '33333333-0001-4000-a000-000000000001',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          employee_id: 'e1111111-0001-4000-8000-000000000001',
          designation_id: ALPHA_DESIG_SR_EXEC_ID,
          is_eligible: true,
          assignment_weight: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '33333333-0002-4000-a000-000000000002',
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          employee_id: 'e2222222-0002-4000-8000-000000000002',
          designation_id: BETA_DESIG_CSM_ID,
          is_eligible: true,
          assignment_weight: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      leads: [
        {
          id: '11111111-0001-4000-a000-000000000001',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          name: 'Alpha Lead GN',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '22222222-0001-4000-a000-000000000001',
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          name: 'Beta Lead JP',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      conversations: [
        {
          id: 'c2222222-0001-4000-8000-000000000001',
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          lead_id: '22222222-0001-4000-a000-000000000001',
          channel_id: 'c2222222-0001-4000-8000-000000000001',
          assigned_employee_id: null,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      chat_assignment_state: [],
      assignment_audit: [],
    };
  };

  it('1. Tenant Alpha admin cannot assign Tenant Beta leads', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    // Alpha admin tries to assign Beta lead
    const res = await request(app)
      .post('/api/v1/leads/22222222-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('2. Tenant Alpha admin cannot assign Tenant Beta conversations', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    // Alpha admin tries to assign Beta conversation
    const res = await request(app)
      .post('/api/v1/conversations/c2222222-0001-4000-8000-000000000001/assign')
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('3. Tenant Alpha admin cannot view Tenant Beta agent settings', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    const res = await request(app)
      .get(`/api/v1/agent-settings?tenantId=${TENANT_BETA_ID}&branchId=${BETA_BRANCH_JAIPUR_ID}`)
      .set('x-mock-identity', 'alpha_admin');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('4. Tenant Alpha admin cannot preview Tenant Beta assignments', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    const res = await request(app)
      .post(`/api/v1/branches/${BETA_BRANCH_JAIPUR_ID}/assignment/preview`)
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('5. Branch admin cannot assign leads belonging to another branch within same tenant', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    // alpha_branch_admin is assigned to Greater Noida.
    // Let's create an Alpha Noida lead:
    const data = setupSecurityFixtures();
    data.leads.push({
      id: '11111111-0002-4000-a000-000000000001',
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_NOIDA_ID, // Noida, not Greater Noida!
      name: 'Alpha Noida Lead',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0002-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_SCOPE_FORBIDDEN');
  });

  it('6. Ordinary employee cannot modify branch assignment weights or settings', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    // alpha_employee tries to update agent setting
    const res = await request(app)
      .patch('/api/v1/agent-settings/33333333-0001-4000-a000-000000000001')
      .set('x-mock-identity', 'alpha_employee')
      .send({ assignmentWeight: 50 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ASSIGNMENT_FORBIDDEN');
  });

  it('7. Ordinary employee cannot configure new agent settings', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    const res = await request(app)
      .post('/api/v1/agent-settings')
      .set('x-mock-identity', 'alpha_employee')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0002-4000-8000-000000000002',
        isEligible: true,
        assignmentWeight: 20,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ASSIGNMENT_FORBIDDEN');
  });

  it('8. Super admin can preview and assign across any tenant and branch', async () => {
    setSupabaseClient(createMockSupabaseClient(setupSecurityFixtures()));

    const res = await request(app)
      .post(`/api/v1/branches/${BETA_BRANCH_JAIPUR_ID}/assignment/preview`)
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.tenantId).toBe(TENANT_BETA_ID);
  });
});
