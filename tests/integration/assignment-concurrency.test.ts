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

describe('Phase 3 Assignment Concurrency & State Persistence Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();

  const AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Aarav (weight 3)
  const DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Diya (weight 2)

  beforeEach(() => {
    assignmentService.setCrmAdapter(mockCrm);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  it('handles simultaneous concurrent lead assignments without race conditions or corrupted state', async () => {
    // Setup 20 unique leads
    const leads = [];
    for (let i = 1; i <= 20; i++) {
      const hex = i.toString().padStart(12, '0');
      leads.push({
        id: `11111111-0001-4000-a000-${hex}`,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: `Concurrent Lead ${i}`,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const initialData = {
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
          assignment_weight: 3,
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
          assignment_weight: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      leads,
      conversations: [],
      chat_assignment_state: [],
      assignment_audit: [],
    };

    setSupabaseClient(createMockSupabaseClient(initialData));

    // Fire all 20 assignment requests concurrently
    const responses = await Promise.all(
      leads.map((l) =>
        request(app)
          .post(`/api/v1/leads/${l.id}/assign`)
          .set('x-mock-identity', 'super_admin')
          .send({}),
      ),
    );

    // All must succeed
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.data.assigned).toBe(true);
    }

    const assignedIds = responses.map((r) => r.body.data.assignedEmployeeId);
    const countAarav = assignedIds.filter((id) => id === AARAV_ID).length;
    const countDiya = assignedIds.filter((id) => id === DIYA_ID).length;

    // Weights are 3:2 -> over 20 items: Aarav = 12 (60%), Diya = 8 (40%)
    expect(countAarav).toBe(12);
    expect(countDiya).toBe(8);
  });

  it('preview endpoint does not mutate persistent state', async () => {
    const initialData = {
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
      ],
      leads: [],
      conversations: [],
      chat_assignment_state: [],
      assignment_audit: [],
    };

    setSupabaseClient(createMockSupabaseClient(initialData));

    // Preview twice
    const res1 = await request(app)
      .post(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/assignment/preview`)
      .set('x-mock-identity', 'super_admin')
      .send({});

    const res2 = await request(app)
      .post(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/assignment/preview`)
      .set('x-mock-identity', 'super_admin')
      .send({});

    expect(res1.status).toBe(200);
    expect(res1.body.data.predictedEmployeeId).toBe(AARAV_ID);
    expect(res2.body.data.predictedEmployeeId).toBe(AARAV_ID);
  });
});
