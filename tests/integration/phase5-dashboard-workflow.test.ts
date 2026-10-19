import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { HelpdeskApiClient } from '../../apps/dashboard/src/api/client';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';
import { setCrmProxyAdapter } from '../../apps/api/src/modules/crm-proxy/crm-proxy.route';

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
    'whatsapp_channels',
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

describe('Phase 5 Helpdesk Dashboard Client Integration Workflow', () => {
  let server: any;
  let client: HelpdeskApiClient;
  let store: Record<string, any[]>;

  const EMP_AARAV_ID = 'e1111111-0001-4000-8000-000000000001';
  const EMP_DIYA_ID = 'e1111111-0002-4000-8000-000000000002';
  const TEST_CHANNEL_ID = randomUUID();

  beforeEach(async () => {
    store = {};
    const mockSupabase = createMockSupabaseClient(store);
    setSupabaseClient(mockSupabase);

    const mockCrm = new MockCrmAdapter();
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
    setCrmProxyAdapter(mockCrm);

    const app = createHelpdeskApp();

    // Start local ephemeral HTTP server for client testing
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        client = new HelpdeskApiClient(`http://localhost:${port}/api/v1`);
        resolve();
      });
    });

    // Seed channel in whatsapp_channels
    store['whatsapp_channels'] = [
      {
        id: TEST_CHANNEL_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        provider: 'mock',
        status: 'active',
        display_name: 'Test WhatsApp Channel',
        phone_number_id: 'mock-phone-id',
        waba_id: 'mock-waba-id',
        credential_reference: null,
        configuration: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Seed agent settings
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

    // Seed rule
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

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  it('1. Loads authorized user profile and tenant scope via API client', async () => {
    client.setIdentity('alpha_branch_admin');
    const profile = await client.getCurrentIdentity();

    expect(profile.identity.key).toBe('alpha_branch_admin');
    expect(profile.identity.tenantId).toBe(TENANT_ALPHA_ID);
    expect(profile.identity.branchId).toBe(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(profile.identity.role).toBe('branch_admin');
  });

  it('2. Loads conversation inbox and verifies server-side status filtering', async () => {
    client.setIdentity('alpha_branch_admin');

    const lead1 = randomUUID();
    const lead2 = randomUUID();
    store['leads'] = [
      { id: lead1, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID, name: 'Lead 1' },
      { id: lead2, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID, name: 'Lead 2' },
    ];

    store['conversations'] = [
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: lead1,
        channel_id: TEST_CHANNEL_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: lead2,
        channel_id: TEST_CHANNEL_ID,
        status: 'resolved',
        created_at: new Date().toISOString(),
      },
    ];

    // Query open
    const openRes = await client.listConversations({
      tenantId: TENANT_ALPHA_ID,
      branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
      status: 'open',
    });
    expect(openRes.data.length).toBe(1);
    expect(openRes.data[0]!.status).toBe('open');

    // Query resolved
    const resRes = await client.listConversations({
      tenantId: TENANT_ALPHA_ID,
      branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
      status: 'resolved',
    });
    expect(resRes.data.length).toBe(1);
    expect(resRes.data[0]!.status).toBe('resolved');
  });

  it('3. Sends a WhatsApp reply message and verifies message history and delivery status', async () => {
    client.setIdentity('alpha_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    store['leads'] = [
      {
        id: leadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Gym Member',
        phone_number: '+919876543210',
      },
    ];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    // Send WhatsApp text message
    const sentMsg = await client.sendTextMessage(convId, 'Welcome to PowerGym! How may I assist you today?');
    expect(sentMsg.id).toBeTruthy();
    expect(sentMsg.body).toBe('Welcome to PowerGym! How may I assist you today?');
    expect(sentMsg.direction).toBe('outbound');
    expect(sentMsg.deliveryStatus).toBe('sent');

    // Fetch messages history
    const history = await client.listMessages(convId);
    expect(history.data.length).toBe(1);
    expect(history.data[0]!.id).toBe(sentMsg.id);
  });

  it('4. Updates conversation status to on_hold and resolved through client', async () => {
    client.setIdentity('alpha_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    store['leads'] = [{ id: leadId, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID }];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    const updated1 = await client.updateConversationStatus(convId, 'on_hold');
    expect(updated1.status).toBe('on_hold');

    const updated2 = await client.updateConversationStatus(convId, 'resolved');
    expect(updated2.status).toBe('resolved');
    expect(updated2.closedAt).toBeTruthy();
  });

  it('5. Performs manual conversation transfer to eligible employee', async () => {
    client.setIdentity('alpha_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    store['leads'] = [{ id: leadId, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID }];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    // Transfer to Diya
    const transferRes: any = await client.transferConversation(convId, EMP_DIYA_ID);
    expect(transferRes.assigned).toBe(true);
    expect(transferRes.assignedEmployeeId).toBe(EMP_DIYA_ID);
    expect(transferRes.reason).toBe('MANUAL_REASSIGNMENT');
  });

  it('6. Rejects transfer to invalid or cross-branch employee with structured error', async () => {
    client.setIdentity('alpha_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    const fakeId = randomUUID();
    store['leads'] = [{ id: leadId, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID }];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    await expect(client.transferConversation(convId, fakeId)).rejects.toThrow();
  });

  it('7. Schedules customer follow-up and updates follow-up status', async () => {
    client.setIdentity('alpha_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    store['leads'] = [{ id: leadId, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID }];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        assigned_employee_id: EMP_AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    const fu = await client.scheduleFollowUp({
      tenantId: TENANT_ALPHA_ID,
      branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversationId: convId,
      assignedEmployeeId: EMP_AARAV_ID,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'scheduled',
      note: 'Follow-up regarding PT session trial',
    });

    expect(fu.id).toBeTruthy();
    expect(fu.status).toBe('scheduled');

    // List follow-ups
    const list = await client.listFollowUps({ tenantId: TENANT_ALPHA_ID, conversationId: convId });
    expect(list.length).toBe(1);

    // Complete follow-up
    const completed = await client.updateFollowUp(fu.id, { status: 'completed' });
    expect(completed.status).toBe('completed');
  });

  it('8. Rejects cross-tenant operations strictly (Tenant Beta cannot modify Tenant Alpha)', async () => {
    client.setIdentity('beta_branch_admin');

    const leadId = randomUUID();
    const convId = randomUUID();
    store['leads'] = [{ id: leadId, tenant_id: TENANT_ALPHA_ID, branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID }];
    store['conversations'] = [
      {
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: leadId,
        channel_id: TEST_CHANNEL_ID,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ];

    await expect(client.updateConversationStatus(convId, 'resolved')).rejects.toThrow();
  });
});
