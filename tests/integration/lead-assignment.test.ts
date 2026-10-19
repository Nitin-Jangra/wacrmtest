import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
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
          // updates matched records in store
          for (let i = 0; i < (store[tableName] || []).length; i++) {
            const item = store[tableName]![i];
            if (currentData.some((c) => c.id === item.id)) {
              store[tableName]![i] = {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              };
            }
          }
          currentData = currentData.map((item) => ({
            ...item,
            ...updates,
            updated_at: new Date().toISOString(),
          }));
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
        single: async () => ({ data: currentData[0] || null, error: null }),
        maybeSingle: async () => ({ data: currentData[0] || null, error: null }),
        then: (resolve: any) =>
          resolve({ data: currentData, error: null, count: currentData.length }),
      };

      return queryBuilder;
    },
  };

  return mock as unknown as SupabaseClient;
}

describe('Phase 3 Lead Assignment Integration Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();

  const AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Aarav (weight 15)
  const DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Diya (weight 10)

  beforeEach(() => {
    assignmentService.setCrmAdapter(mockCrm);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  const setupBaseData = () => {
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
      ],
      chat_agent_settings: [
        {
          id: 's-aarav',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          employee_id: AARAV_ID,
          designation_id: ALPHA_DESIG_SR_EXEC_ID,
          is_eligible: true,
          assignment_weight: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 's-diya',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          employee_id: DIYA_ID,
          designation_id: ALPHA_DESIG_EXEC_ID,
          is_eligible: true,
          assignment_weight: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      leads: [
        {
          id: '11111111-0001-4000-a000-000000000001',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          external_contact_id: 'ext-lead-01',
          name: 'First Prospect',
          phone_number: '+919800000001',
          source: 'whatsapp',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '11111111-0001-4000-a000-000000000002',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          external_contact_id: 'ext-lead-02',
          name: 'Second Prospect',
          phone_number: '+919800000002',
          source: 'whatsapp',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      conversations: [
        {
          id: 'c0000000-0000-4000-8000-000000000001',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          lead_id: '11111111-0001-4000-a000-000000000001',
          channel_id: 'c1111111-0001-4000-8000-000000000001',
          assigned_employee_id: null as string | null,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      chat_assignment_state: [],
      assignment_audit: [],
    };
  };

  it('assigns a new lead to an eligible branch employee and records audit', async () => {
    setSupabaseClient(createMockSupabaseClient(setupBaseData()));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    expect(res.body.data.leadId).toBe('11111111-0001-4000-a000-000000000001');
    expect(res.body.data.reason).toBe('NEW_LEAD_ASSIGNMENT');
    expect([AARAV_ID, DIYA_ID]).toContain(res.body.data.assignedEmployeeId);
  });

  it('retains the existing owner for a returning lead without consuming weighted state', async () => {
    const data = setupBaseData();
    // Lead 1 already has Aarav as owner
    data.leads[0]!.metadata = { assignedEmployeeId: AARAV_ID };

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    expect(res.body.data.assignedEmployeeId).toBe(AARAV_ID);
    expect(res.body.data.reason).toBe('OWNER_RETAINED');
    expect(res.body.data.isRetained).toBe(true);
  });

  it('reassigns lead when previous owner is no longer eligible', async () => {
    const data = setupBaseData();
    // Lead has Ananya Verma (inactive in CRM) as previous owner
    const INACTIVE_EMP_ID = 'e1111111-0004-4000-8000-000000000004';
    data.leads[0]!.metadata = { assignedEmployeeId: INACTIVE_EMP_ID };

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    // Must NOT be inactive employee
    expect(res.body.data.assignedEmployeeId).not.toBe(INACTIVE_EMP_ID);
    expect(res.body.data.reason).toBe('OWNER_INELIGIBLE');
    expect([AARAV_ID, DIYA_ID]).toContain(res.body.data.assignedEmployeeId);
  });

  it('leaves lead unassigned with clear NO_ELIGIBLE_AGENTS reason when no agents are eligible', async () => {
    const data = setupBaseData();
    // Disable all agent settings
    data.chat_agent_settings.forEach((s) => (s.is_eligible = false));

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(false);
    expect(res.body.data.assignedEmployeeId).toBeNull();
    expect(res.body.data.reason).toBe('NO_ELIGIBLE_AGENTS');
  });

  it('supports retry assignment after previously unassigned lead receives eligible agents', async () => {
    const data = setupBaseData();
    data.leads[0]!.metadata = { assignmentStatus: 'unassigned', unassignedReason: 'NO_ELIGIBLE_AGENTS' };

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    expect(res.body.data.reason).toBe('RETRY_ASSIGNMENT');
  });

  it('assigns a conversation and retains the lead owner', async () => {
    const data = setupBaseData();
    data.leads[0]!.metadata = { assignedEmployeeId: DIYA_ID };

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/conversations/c0000000-0000-4000-8000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    expect(res.body.data.assignedEmployeeId).toBe(DIYA_ID);
    expect(res.body.data.reason).toBe('OWNER_RETAINED');
  });

  it('repeated duplicate assignment requests return existing assignment idempotently', async () => {
    const data = setupBaseData();
    data.conversations[0]!.assigned_employee_id = AARAV_ID;
    data.leads[0]!.metadata = { assignedEmployeeId: AARAV_ID };

    setSupabaseClient(createMockSupabaseClient(data));

    // Request 1
    const res1 = await request(app)
      .post('/api/v1/conversations/c0000000-0000-4000-8000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    // Request 2 (duplicate retry)
    const res2 = await request(app)
      .post('/api/v1/conversations/c0000000-0000-4000-8000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res1.body.data.assignedEmployeeId).toBe(AARAV_ID);
    expect(res2.body.data.assignedEmployeeId).toBe(AARAV_ID);
    expect(res2.body.data.isRetained).toBe(true);
  });

  it('returns 422 when branch has no active assignment rule', async () => {
    const data = setupBaseData();
    data.chat_assignment_rules = []; // No rules configured

    setSupabaseClient(createMockSupabaseClient(data));

    const res = await request(app)
      .post('/api/v1/leads/11111111-0001-4000-a000-000000000001/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ASSIGNMENT_RULE_NOT_FOUND');
  });

  it('returns 404 when lead is not found', async () => {
    setSupabaseClient(createMockSupabaseClient(setupBaseData()));

    const res = await request(app)
      .post('/api/v1/leads/99999999-9999-4000-8000-999999999999/assign')
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DATABASE_RECORD_NOT_FOUND');
  });
});
