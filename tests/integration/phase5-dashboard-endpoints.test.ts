import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient(store: Record<string, any[]> = {}): SupabaseClient {
  for (const table of [
    'leads',
    'conversations',
    'messages',
    'chat_agent_settings',
    'chat_assignment_rules',
    'chat_assignment_state',
    'assignment_audit',
    'follow_ups',
    'channels',
  ]) {
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

describe('Phase 5 Helpdesk Dashboard Backend Endpoints', () => {
  let app: any;
  let mockCrm: MockCrmAdapter;
  let store: Record<string, any[]>;

  // Real employee IDs from MockCrmAdapter fixtures for Alpha Greater Noida
  const EMP_AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Aarav Sharma (Branch Admin & Eligible Agent)
  const EMP_DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Diya Patel (Employee & Eligible Agent)

  beforeEach(() => {
    store = {};
    const mockSupabase = createMockSupabaseClient(store);
    setSupabaseClient(mockSupabase);

    mockCrm = new MockCrmAdapter();
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);

    app = createHelpdeskApp();

    // Seed agent settings for Aarav and Diya in Greater Noida
    store['chat_agent_settings'] = [
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employee_id: EMP_AARAV_ID,
        designation_id: ALPHA_DESIG_SR_EXEC_ID,
        is_eligible: true,
        assignment_weight: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employee_id: EMP_DIYA_ID,
        designation_id: ALPHA_DESIG_EXEC_ID,
        is_eligible: true,
        assignment_weight: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Seed assignment rule
    store['chat_assignment_rules'] = [
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        strategy: 'weighted_round_robin',
        is_enabled: true,
        configuration: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  it('1. Successfully updates conversation status lifecycle (open -> on_hold -> resolved -> open -> closed)', async () => {
    const leadId = randomUUID();
    const channelId = randomUUID();
    const convId = randomUUID();

    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'John Doe',
        phone_number: '+919876543210',
        metadata: {},
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: channelId,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      },
    ];

    // Put on hold
    const holdRes = await request(app)
      .patch(`/api/v1/conversations/${convId}/status`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ status: 'on_hold' });
    expect(holdRes.status).toBe(200);
    expect(holdRes.body.data.status).toBe('on_hold');

    // Resolve
    const resRes = await request(app)
      .patch(`/api/v1/conversations/${convId}/status`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ status: 'resolved' });
    expect(resRes.status).toBe(200);
    expect(resRes.body.data.status).toBe('resolved');
    expect(resRes.body.data.closedAt).toBeTruthy();

    // Reopen
    const reopenRes = await request(app)
      .patch(`/api/v1/conversations/${convId}/status`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ status: 'open' });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.status).toBe('open');
    expect(reopenRes.body.data.closedAt).toBeNull();

    // Close
    const closeRes = await request(app)
      .patch(`/api/v1/conversations/${convId}/status`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ status: 'closed' });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('closed');
    expect(closeRes.body.data.closedAt).toBeTruthy();
  });

  it('2. Rejects conversation status update from unauthorized cross-tenant identity', async () => {
    const leadId = randomUUID();
    const channelId = randomUUID();
    const convId = randomUUID();

    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Jane Doe',
        metadata: {},
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: channelId,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Caller from Tenant Beta attempting to change status of Tenant Alpha conversation
    const res = await request(app)
      .patch(`/api/v1/conversations/${convId}/status`)
      .set('x-mock-identity', 'beta_branch_admin')
      .send({ status: 'resolved' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Caller not authorized to update conversation status');
  });

  it('3. Successfully transfers conversation to an eligible employee and writes audit log', async () => {
    const leadId = randomUUID();
    const channelId = randomUUID();
    const convId = randomUUID();

    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Mark Taylor',
        metadata: { assignedEmployeeId: EMP_AARAV_ID },
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: channelId,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Transfer from Aarav to Diya
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/assign`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ targetEmployeeId: EMP_DIYA_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(true);
    expect(res.body.data.assignedEmployeeId).toBe(EMP_DIYA_ID);
    expect(res.body.data.reason).toBe('MANUAL_REASSIGNMENT');

    // Verify conversation owner updated
    const conv = store['conversations'].find((c) => c.id === convId);
    expect(conv!.assigned_employee_id).toBe(EMP_DIYA_ID);

    // Verify audit log recorded
    expect(store['assignment_audit']!.length).toBeGreaterThan(0);
    const audit = store['assignment_audit']![0];
    expect(audit!.conversation_id).toBe(convId);
    expect(audit!.previous_employee_id).toBe(EMP_AARAV_ID);
    expect(audit!.new_employee_id).toBe(EMP_DIYA_ID);
    expect(audit!.reason).toBe('MANUAL_REASSIGNMENT');
  });

  it('4. Rejects conversation transfer to an ineligible employee', async () => {
    const leadId = randomUUID();
    const channelId = randomUUID();
    const convId = randomUUID();
    const fakeEmployeeId = randomUUID();

    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Sarah Connor',
        metadata: {},
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: channelId,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Attempt transfer to an employee ID that is not eligible in this branch
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/assign`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ targetEmployeeId: fakeEmployeeId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not an active eligible chat agent');
  });

  it('5. Successfully creates, lists, and updates follow-up status', async () => {
    const leadId = randomUUID();
    const channelId = randomUUID();
    const convId = randomUUID();

    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Robert Davis',
        metadata: {},
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: channelId,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Create follow-up
    const createRes = await request(app)
      .post('/api/v1/follow-ups')
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        conversationId: convId,
        assignedEmployeeId: EMP_AARAV_ID,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'scheduled',
        note: 'Call customer regarding annual membership plan',
      });

    expect(createRes.status).toBe(201);
    const fuId = createRes.body.data.id;
    expect(fuId).toBeTruthy();

    // List follow-ups for conversation
    const listRes = await request(app)
      .get(`/api/v1/follow-ups?tenantId=${TENANT_ALPHA_ID}&conversationId=${convId}`)
      .set('x-mock-identity', 'alpha_branch_admin');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(fuId);

    // Update follow-up status to completed
    const patchRes = await request(app)
      .patch(`/api/v1/follow-ups/${fuId}`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({ status: 'completed', note: 'Customer subscribed successfully' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('completed');
    expect(patchRes.body.data.note).toBe('Customer subscribed successfully');
  });

  it('6. Filters conversation list by assignedEmployeeId (My Conversations)', async () => {
    const lead1 = randomUUID();
    const lead2 = randomUUID();
    const channelId = randomUUID();

    store['conversations'] = [
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: lead1,
        channel_id: channelId,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: lead2,
        channel_id: channelId,
        assigned_employee_id: EMP_DIYA_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Filter by Aarav
    const resAarav = await request(app)
      .get(`/api/v1/conversations?tenantId=${TENANT_ALPHA_ID}&assignedEmployeeId=${EMP_AARAV_ID}`)
      .set('x-mock-identity', 'alpha_branch_admin');

    expect(resAarav.status).toBe(200);
    expect(resAarav.body.data.length).toBe(1);
    expect(resAarav.body.data[0].assignedEmployeeId).toBe(EMP_AARAV_ID);
  });
});
