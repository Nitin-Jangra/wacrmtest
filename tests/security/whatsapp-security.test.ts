import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { whatsappWebhookService } from '../../apps/api/src/services/whatsapp/whatsapp-webhook.service';
import { MockWhatsAppProvider } from '../../apps/api/src/integrations/whatsapp/mock-whatsapp.provider';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  BETA_BRANCH_JAIPUR_ID,
  ALPHA_DESIG_SR_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient(store: Record<string, any[]> = {}): SupabaseClient {
  const tables = [
    'whatsapp_channels',
    'leads',
    'conversations',
    'messages',
    'webhook_events',
    'assignment_audit',
    'chat_agent_settings',
    'chat_assignment_rules',
    'chat_assignment_state',
  ];
  for (const table of tables) {
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

describe('WhatsApp Security, Tenant Isolation & Concurrency Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();
  const mockProvider = new MockWhatsAppProvider('sec_secret');

  const ALPHA_PHONE_NUMBER_ID = '109876543210987';
  const BETA_PHONE_NUMBER_ID = '209876543210987';

  const CHANNEL_ALPHA_ID = 'c1111111-0001-4000-a000-000000000001';
  const CHANNEL_BETA_ID = 'c2222222-0001-4000-a000-000000000001';

  const CONV_BETA_ID = 'cb000000-0001-4000-8000-000000000001';
  const LEAD_BETA_ID = 'lb000000-0001-4000-8000-000000000001';

  interface TestSecurityStore {
    whatsapp_channels: any[];
    chat_assignment_rules: any[];
    chat_agent_settings: any[];
    chat_assignment_state: any[];
    assignment_audit: any[];
    leads: any[];
    conversations: any[];
    messages: any[];
    webhook_events: any[];
    [key: string]: any[];
  }

  let dbStore: TestSecurityStore;

  beforeEach(() => {
    dbStore = {
      whatsapp_channels: [
        {
          id: CHANNEL_ALPHA_ID,
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          provider: 'meta_whatsapp',
          phone_number_id: ALPHA_PHONE_NUMBER_ID,
          waba_id: 'waba-alpha',
          display_name: 'Alpha WhatsApp',
          status: 'active',
          credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
          configuration: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: CHANNEL_BETA_ID,
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          provider: 'meta_whatsapp',
          phone_number_id: BETA_PHONE_NUMBER_ID,
          waba_id: 'waba-beta',
          display_name: 'Beta WhatsApp',
          status: 'active',
          credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
          configuration: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
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
          id: 'setting-aarav',
          tenant_id: TENANT_ALPHA_ID,
          branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
          employee_id: 'e1111111-0001-4000-8000-000000000001',
          designation_id: ALPHA_DESIG_SR_EXEC_ID,
          is_eligible: true,
          assignment_weight: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      chat_assignment_state: [],
      assignment_audit: [],
      leads: [
        {
          id: LEAD_BETA_ID,
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          name: 'Beta Member',
          phone_number: '+919111122222',
          external_contact_id: '+919111122222',
          source: 'whatsapp',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      conversations: [
        {
          id: CONV_BETA_ID,
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          lead_id: LEAD_BETA_ID,
          channel_id: CHANNEL_BETA_ID,
          assigned_employee_id: 'e2222222-0001-4000-8000-000000000001',
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      messages: [
        {
          id: randomUUID(),
          tenant_id: TENANT_BETA_ID,
          branch_id: BETA_BRANCH_JAIPUR_ID,
          conversation_id: CONV_BETA_ID,
          external_message_id: 'wamid.beta.secret.1',
          direction: 'inbound',
          message_type: 'text',
          body: 'Confidential Beta message',
          delivery_status: 'delivered',
          payload: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      webhook_events: [],
    };

    setSupabaseClient(createMockSupabaseClient(dbStore));
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
    whatsappWebhookService.setProvider(mockProvider);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  it('enforces tenant isolation: Tenant Alpha admin cannot send message on Tenant Beta conversation', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_BETA_ID}/messages`)
      .set('x-mock-identity', 'alpha_admin')
      .send({
        type: 'text',
        text: 'Malicious Alpha attempt on Beta conversation',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('enforces tenant isolation: Tenant Alpha employee cannot send message on Tenant Beta conversation', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_BETA_ID}/messages`)
      .set('x-mock-identity', 'alpha_employee')
      .send({
        type: 'text',
        text: 'Malicious Alpha employee attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('allows safe retry of failed webhook processing without corrupting state', async () => {
    const msgId = 'wamid.retry.test.001';
    const senderPhone = '+919988776655';

    // Simulate an existing failed webhook event record
    dbStore.webhook_events.push({
      id: 'event-failed-id-1',
      provider: 'meta_whatsapp',
      external_event_id: msgId,
      tenant_id: TENANT_ALPHA_ID,
      channel_id: CHANNEL_ALPHA_ID,
      event_type: 'message',
      processing_status: 'failed',
      error_code: 'DATABASE_TIMEOUT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Retry Lead' }, wa_id: senderPhone }],
                messages: [
                  {
                    from: senderPhone,
                    id: msgId,
                    timestamp: '1729318000',
                    type: 'text',
                    text: { body: 'Retry payload after earlier failure' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const raw = Buffer.from(JSON.stringify(payload));
    const sig = mockProvider.generateSignature(raw);

    const res = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', sig)
      .send(payload);

    expect(res.status).toBe(200);

    // Lead and conversation created on retry
    expect(dbStore.leads).toHaveLength(2); // 1 Beta + 1 new Alpha
    expect(dbStore.conversations).toHaveLength(2);

    // Webhook event marked as completed
    const event = dbStore.webhook_events.find((e) => e.external_event_id === msgId);
    expect(event?.processing_status).toBe('completed');
  });

  it('handles concurrent duplicate webhook deliveries without duplicate leads or multiple assignments', async () => {
    const msgId = 'wamid.concurrent.test.002';
    const senderPhone = '+919876500000';

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Concurrent Lead' }, wa_id: senderPhone }],
                messages: [
                  {
                    from: senderPhone,
                    id: msgId,
                    timestamp: '1729318100',
                    type: 'text',
                    text: { body: 'Concurrent delivery test' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const raw = Buffer.from(JSON.stringify(payload));
    const sig = mockProvider.generateSignature(raw);

    // Send 5 identical requests concurrently
    const promises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(payload),
    );

    const responses = await Promise.all(promises);

    // All should return 200 OK
    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    // Only 1 new Alpha lead should exist
    const alphaLeads = dbStore.leads.filter((l) => l.tenant_id === TENANT_ALPHA_ID);
    expect(alphaLeads).toHaveLength(1);

    // Only 1 new Alpha conversation
    const alphaConvs = dbStore.conversations.filter((c) => c.tenant_id === TENANT_ALPHA_ID);
    expect(alphaConvs).toHaveLength(1);

    // Only 1 assignment audit record for this conversation
    const audits = dbStore.assignment_audit.filter(
      (a) => a.conversation_id === alphaConvs[0].id,
    );
    expect(audits).toHaveLength(1);
  });
});
