import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  BETA_BRANCH_JAIPUR_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
  BETA_DESIG_CSM_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient(store: Record<string, any[]> = {}): SupabaseClient {
  for (const table of ['leads', 'conversations', 'chat_agent_settings', 'chat_assignment_rules', 'chat_assignment_state', 'assignment_audit']) {
    if (!store[table]) store[table] = [];
  }

  const mock = {
    from: (tableName: string) => {
      if (!store[tableName]) store[tableName] = [];
      let currentData = [...store[tableName]!];
      let pendingUpdates: any = null;

      const applyPendingUpdates = () => {
        if (pendingUpdates) {
          for (let i = 0; i < store[tableName]!.length; i++) {
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
            id: r.id || randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          store[tableName]!.push(...inserted);
          currentData = inserted;
          return queryBuilder;
        },
        upsert: (row: any, options?: { onConflict?: string }) => {
          const conflictFields = (options?.onConflict || 'id').split(',');
          const existingIdx = store[tableName]!.findIndex((item) =>
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
              id: row.id || randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            };
            store[tableName]!.push(inserted);
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

describe('Phases 1-3 End-to-End Integration & Reliability Scenarios', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();

  const AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Aarav (weight 15)
  const DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Diya (weight 10)
  const KAVYA_ID = 'e2222222-0002-4000-8000-000000000002'; // Kavya in Beta Jaipur

  beforeEach(() => {
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  const setupE2EFixtures = () => {
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
          employee_id: AARAV_ID,
          designation_id: ALPHA_DESIG_SR_EXEC_ID,
          is_eligible: true,
          assignment_weight: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '33333333-0002-4000-a000-000000000002',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          employee_id: DIYA_ID,
          designation_id: ALPHA_DESIG_EXEC_ID,
          is_eligible: true,
          assignment_weight: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '33333333-0003-4000-a000-000000000003',
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          employee_id: KAVYA_ID,
          designation_id: BETA_DESIG_CSM_ID,
          is_eligible: true,
          assignment_weight: 20,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      leads: [] as any[],
      conversations: [] as any[],
      chat_assignment_state: [] as any[],
      assignment_audit: [] as any[],
    };
  };

  // ===========================================================================
  // Scenario A – New Lead Assignment & Cross-Restart Persistence
  // ===========================================================================
  it('Scenario A: Complete lifecycle of a new lead assignment with persistent state across restart', async () => {
    const dbData = setupE2EFixtures();
    setSupabaseClient(createMockSupabaseClient(dbData));

    // 1. Authenticate as authorized branch admin and retrieve eligible agents via CRM adapter
    const eligibleAgentsRes = await request(app)
      .get(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/agent-settings/eligible`)
      .set('x-mock-identity', 'alpha_branch_admin');

    expect(eligibleAgentsRes.status).toBe(200);
    expect(eligibleAgentsRes.body.data).toHaveLength(2);
    expect(eligibleAgentsRes.body.data.map((a: any) => a.employeeId)).toEqual([AARAV_ID, DIYA_ID]);

    // 2. Create a new lead in the branch
    const createLeadRes = await request(app)
      .post('/api/v1/leads')
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'New Prospect Scenario A',
        phoneNumber: '+919876543210',
        email: 'prospect.a@example.com',
        source: 'whatsapp',
      });

    expect(createLeadRes.status).toBe(201);
    const newLeadId = createLeadRes.body.data.id;
    expect(newLeadId).toBeDefined();

    // Attach an initial conversation for this lead
    dbData.conversations.push({
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      lead_id: newLeadId,
      channel_id: 'c1111111-0001-4000-8000-000000000001',
      assigned_employee_id: null,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Trigger assignment
    const assignRes = await request(app)
      .post(`/api/v1/leads/${newLeadId}/assign`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assigned).toBe(true);
    const assignedEmpId = assignRes.body.data.assignedEmployeeId;
    expect([AARAV_ID, DIYA_ID]).toContain(assignedEmpId);
    expect(assignRes.body.data.reason).toBe('NEW_LEAD_ASSIGNMENT');

    // 4. Verify assignment audit was recorded in Supabase
    expect(dbData.assignment_audit).toHaveLength(1);
    expect(dbData.assignment_audit[0]!.new_employee_id).toBe(assignedEmpId);
    expect(dbData.assignment_audit[0]!.reason).toBe('NEW_LEAD_ASSIGNMENT');

    // 5. Verify assignment state exists in Supabase
    expect(dbData.chat_assignment_state).toHaveLength(1);
    expect(dbData.chat_assignment_state[0]!.strategy).toBe('weighted_round_robin');
    expect(dbData.chat_assignment_state[0]!.state).toBeDefined();

    // 6. Simulate application restart by creating a brand-new App instance and re-binding the database client
    const restartedApp = createHelpdeskApp();
    setSupabaseClient(createMockSupabaseClient(dbData));

    // 7. Verify the assigned lead owner remains intact after restart
    const fetchLeadRes = await request(restartedApp)
      .get(`/api/v1/leads/${newLeadId}`)
      .set('x-mock-identity', 'alpha_branch_admin');

    expect(fetchLeadRes.status).toBe(200);
    expect(fetchLeadRes.body.data.metadata?.assignedEmployeeId).toBe(assignedEmpId);
  });

  // ===========================================================================
  // Scenario B – Returning Lead Ownership & Idempotency
  // ===========================================================================
  it('Scenario B: Returning lead retains original owner without advancing round-robin state or duplicating audit', async () => {
    const dbData = setupE2EFixtures();
    const LEAD_ID = '11111111-0001-4000-a000-000000000001';
    dbData.leads.push({
      id: LEAD_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      name: 'Existing Prospect',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    dbData.conversations.push({
      id: 'c0000000-0000-4000-8000-000000000001',
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      lead_id: LEAD_ID,
      channel_id: 'c1111111-0001-4000-8000-000000000001',
      assigned_employee_id: null,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSupabaseClient(createMockSupabaseClient(dbData));

    // First assignment: gets an eligible employee
    const res1 = await request(app)
      .post(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(res1.status).toBe(200);
    const firstOwner = res1.body.data.assignedEmployeeId;
    const auditCountBefore = dbData.assignment_audit.length;
    const stateCursorBefore = JSON.stringify(dbData.chat_assignment_state[0]?.cursor_state);

    // Second assignment (returning lead):
    const res2 = await request(app)
      .post(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(res2.status).toBe(200);
    expect(res2.body.data.assignedEmployeeId).toBe(firstOwner);
    expect(res2.body.data.isRetained).toBe(true);
    expect(res2.body.data.reason).toBe('OWNER_RETAINED');

    // Round-robin cursor state must NOT advance
    const stateCursorAfter = JSON.stringify(dbData.chat_assignment_state[0]?.cursor_state);
    expect(stateCursorAfter).toBe(stateCursorBefore);

    // Audit records must NOT duplicate for retained existing owner
    expect(dbData.assignment_audit.length).toBe(auditCountBefore);
  });

  // ===========================================================================
  // Scenario C – Multi-Tenant Isolation & Boundary Enforcement
  // ===========================================================================
  it('Scenario C: Multi-tenant and branch boundaries strictly enforced at all entrypoints', async () => {
    const dbData = setupE2EFixtures();
    const ALPHA_LEAD_ID = '11111111-0001-4000-a000-000000000001';
    const BETA_LEAD_ID = '22222222-0001-4000-a000-000000000001';

    dbData.leads.push(
      {
        id: ALPHA_LEAD_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Alpha Lead',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: BETA_LEAD_ID,
        tenant_id: TENANT_BETA_ID,
        branch_id: BETA_BRANCH_JAIPUR_ID,
        name: 'Beta Lead',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    );

    setSupabaseClient(createMockSupabaseClient(dbData));

    // 1. Beta Admin attempts to assign Alpha Lead -> 403
    const crossTenantAssign = await request(app)
      .post(`/api/v1/leads/${ALPHA_LEAD_ID}/assign`)
      .set('x-mock-identity', 'beta_admin')
      .send({});

    expect(crossTenantAssign.status).toBe(403);
    expect(crossTenantAssign.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');

    // 2. Alpha Admin attempts to assign Beta Lead -> 403
    const alphaOnBetaAssign = await request(app)
      .post(`/api/v1/leads/${BETA_LEAD_ID}/assign`)
      .set('x-mock-identity', 'alpha_admin')
      .send({});

    expect(alphaOnBetaAssign.status).toBe(403);
    expect(alphaOnBetaAssign.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');

    // 3. Alpha Branch Admin (Greater Noida) attempts to preview Beta branch -> 403
    const previewCrossTenant = await request(app)
      .post(`/api/v1/branches/${BETA_BRANCH_JAIPUR_ID}/assignment/preview`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(previewCrossTenant.status).toBe(403);

    // 4. Ordinary employee cannot modify settings -> 403
    const employeeSettingUpdate = await request(app)
      .patch('/api/v1/agent-settings/33333333-0001-4000-a000-000000000001')
      .set('x-mock-identity', 'alpha_employee')
      .send({ assignmentWeight: 50 });

    expect(employeeSettingUpdate.status).toBe(403);
  });

  // ===========================================================================
  // Scenario D – No Eligible Agents Handling
  // ===========================================================================
  it('Scenario D: Gracefully leaves lead unassigned when no eligible agents exist in branch', async () => {
    const dbData = setupE2EFixtures();
    // Disable all agent settings in Greater Noida
    dbData.chat_agent_settings.forEach((s) => (s.is_eligible = false));

    const UNASSIGNED_LEAD_ID = '11111111-0001-4000-a000-000000000001';
    dbData.leads.push({
      id: UNASSIGNED_LEAD_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      name: 'Unassigned Prospect',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSupabaseClient(createMockSupabaseClient(dbData));

    const res = await request(app)
      .post(`/api/v1/leads/${UNASSIGNED_LEAD_ID}/assign`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(false);
    expect(res.body.data.assignedEmployeeId).toBeNull();
    expect(res.body.data.reason).toBe('NO_ELIGIBLE_AGENTS');

    // Never selects an employee from another branch (e.g. Beta Jaipur)
    expect(res.body.data.assignedEmployeeId).not.toBe(KAVYA_ID);

    // Lead metadata records the unassigned status
    expect(dbData.leads[0]?.metadata?.assignmentStatus).toBe('unassigned');
    expect(dbData.leads[0]?.metadata?.unassignedReason).toBe('NO_ELIGIBLE_AGENTS');
  });

  // ===========================================================================
  // Scenario E – Concurrent Assignment Safety
  // ===========================================================================
  it('Scenario E: Handles concurrent assignment requests safely maintaining balanced distribution', async () => {
    const dbData = setupE2EFixtures();
    const leadIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const id = `11111111-0000-4000-a000-${i.toString().padStart(12, '0')}`;
      const convId = `c0000000-0000-4000-8000-${i.toString().padStart(12, '0')}`;
      leadIds.push(id);
      dbData.leads.push({
        id,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: `Lead ${i}`,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      dbData.conversations.push({
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: id,
        channel_id: 'c1111111-0001-4000-8000-000000000001',
        assigned_employee_id: null,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    setSupabaseClient(createMockSupabaseClient(dbData));

    // Dispatch 10 concurrent assignment requests
    const promises = leadIds.map((id) =>
      request(app)
        .post(`/api/v1/leads/${id}/assign`)
        .set('x-mock-identity', 'alpha_admin')
        .send({}),
    );

    const responses = await Promise.all(promises);

    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(r.body.data.assigned).toBe(true);
      expect([AARAV_ID, DIYA_ID]).toContain(r.body.data.assignedEmployeeId);
    }

    const assignedIds = responses.map((r) => r.body.data.assignedEmployeeId);
    const aaravCount = assignedIds.filter((id) => id === AARAV_ID).length;
    const diyaCount = assignedIds.filter((id) => id === DIYA_ID).length;

    // Weights are 15 (Aarav) and 10 (Diya) -> 3:2 ratio. Over 10 assignments: exactly 6 and 4!
    expect(aaravCount).toBe(6);
    expect(diyaCount).toBe(4);

    // Audit ledger has all 10 records
    expect(dbData.assignment_audit).toHaveLength(10);
  });

  // ===========================================================================
  // Failure Condition & Safety Checks
  // ===========================================================================
  it('Safe failure when no assignment rule is configured for the branch', async () => {
    const dbData = setupE2EFixtures();
    // Wipe rules
    dbData.chat_assignment_rules = [];

    const LEAD_ID = '11111111-0001-4000-a000-000000000001';
    dbData.leads.push({
      id: LEAD_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      name: 'No Rule Lead',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSupabaseClient(createMockSupabaseClient(dbData));

    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ASSIGNMENT_RULE_NOT_FOUND');
  });

  it('Preview endpoint does not mutate persistent assignment state', async () => {
    const dbData = setupE2EFixtures();
    setSupabaseClient(createMockSupabaseClient(dbData));

    const previewRes = await request(app)
      .post(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/assignment/preview`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({});

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.predictedEmployeeId).toBe(AARAV_ID);

    // Persistent state must NOT be created by preview
    expect(dbData.chat_assignment_state).toHaveLength(0);
    expect(dbData.assignment_audit).toHaveLength(0);
  });
});
