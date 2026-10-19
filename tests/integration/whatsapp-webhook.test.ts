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
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
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

describe('WhatsApp Webhook Handshake & Inbound Processing Integration Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();
  const testAppSecret = 'test_webhook_app_secret_98765';
  const testVerifyToken = 'test_webhook_verify_token_alpha';
  const mockProvider = new MockWhatsAppProvider(testAppSecret);

  const ACTIVE_PHONE_NUMBER_ID = '109876543210987';
  const INACTIVE_PHONE_NUMBER_ID = '109876543210988';
  const CHANNEL_ID = 'c1111111-0001-4000-a000-000000000001';
  const INACTIVE_CHANNEL_ID = 'c1111111-0002-4000-a000-000000000002';

  const AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Aarav (weight 15)
  const DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Diya (weight 10)

  interface TestWebhookStore {
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

  let dbStore: TestWebhookStore;

  const setupBaseStore = (): TestWebhookStore => ({
    whatsapp_channels: [
      {
        id: CHANNEL_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        provider: 'meta_whatsapp',
        phone_number_id: ACTIVE_PHONE_NUMBER_ID,
        waba_id: 'waba-alpha-12345',
        display_name: 'Alpha Greater Noida WhatsApp Support',
        status: 'active',
        credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
        configuration: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: INACTIVE_CHANNEL_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        provider: 'meta_whatsapp',
        phone_number_id: INACTIVE_PHONE_NUMBER_ID,
        waba_id: 'waba-alpha-12345',
        display_name: 'Alpha Inactive Channel',
        status: 'inactive',
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
        employee_id: AARAV_ID,
        designation_id: ALPHA_DESIG_SR_EXEC_ID,
        is_eligible: true,
        assignment_weight: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'setting-diya',
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
    chat_assignment_state: [],
    assignment_audit: [],
    leads: [],
    conversations: [],
    messages: [],
    webhook_events: [],
  });

  beforeEach(() => {
    dbStore = setupBaseStore();
    setSupabaseClient(createMockSupabaseClient(dbStore));
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
    whatsappWebhookService.setProvider(mockProvider);
    whatsappWebhookService.setVerifyToken(testVerifyToken);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  describe('GET /api/v1/webhooks/whatsapp — Subscription Verification Handshake', () => {
    it('returns challenge plain text when mode and verify token match', async () => {
      const challengeStr = 'challenge_random_string_12345678';
      const res = await request(app)
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': testVerifyToken,
          'hub.challenge': challengeStr,
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challengeStr);
    });

    it('rejects invalid verify token with 403', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '12345',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WEBHOOK_VERIFY_TOKEN_MISMATCH');
    });

    it('rejects invalid hub.mode with 400', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'publish',
          'hub.verify_token': testVerifyToken,
          'hub.challenge': '12345',
        });

      expect(res.status).toBe(400);
    });

    it('rejects missing challenge with 400', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': testVerifyToken,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/webhooks/whatsapp — Signature & Security Verification', () => {
    it('rejects requests missing x-hub-signature-256 header with 403', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const res = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WHATSAPP_INVALID_SIGNATURE');
    });

    it('rejects requests with tampered payload or invalid signature with 403', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const validSig = mockProvider.generateSignature(rawBody);

      // Send different body than signed
      const res = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', validSig)
        .send({ ...payload, injectedField: 'tampered' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WHATSAPP_INVALID_SIGNATURE');
    });
  });

  describe('Inbound Message Processing & Phase 3 Assignment Integration', () => {
    it('creates lead, conversation, persists message, and assigns to eligible employee', async () => {
      const messageId = 'wamid.HBgLTEST_INBOUND_001==';
      const senderPhone = '+919876543210';
      const senderName = 'Rohan Gupta';

      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: ACTIVE_PHONE_NUMBER_ID,
                  },
                  contacts: [
                    {
                      profile: { name: senderName },
                      wa_id: senderPhone,
                    },
                  ],
                  messages: [
                    {
                      from: senderPhone,
                      id: messageId,
                      timestamp: '1729315200',
                      type: 'text',
                      text: { body: 'Hello! I want a trial pass for Greater Noida gym.' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(webhookPayload));
      const sig = mockProvider.generateSignature(rawBody);

      const res = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.processedMessages).toBe(1);

      // 1. Verify Lead creation
      expect(dbStore.leads).toHaveLength(1);
      const lead = dbStore.leads[0];
      expect(lead.tenant_id).toBe(TENANT_ALPHA_ID);
      expect(lead.branch_id).toBe(ALPHA_BRANCH_GREATER_NOIDA_ID);
      expect(lead.name).toBe(senderName);
      expect(lead.phone_number).toBe(senderPhone);
      expect(lead.source).toBe('whatsapp');

      // 2. Verify Conversation creation
      expect(dbStore.conversations).toHaveLength(1);
      const conv = dbStore.conversations[0];
      expect(conv.lead_id).toBe(lead.id);
      expect(conv.channel_id).toBe(CHANNEL_ID);
      expect(conv.status).toBe('open');

      // 3. Verify Message persistence
      expect(dbStore.messages).toHaveLength(1);
      const msg = dbStore.messages[0];
      expect(msg.conversation_id).toBe(conv.id);
      expect(msg.external_message_id).toBe(messageId);
      expect(msg.direction).toBe('inbound');
      expect(msg.message_type).toBe('text');
      expect(msg.body).toBe('Hello! I want a trial pass for Greater Noida gym.');
      expect(msg.delivery_status).toBe('delivered');

      // 4. Verify Phase 3 smooth weighted round-robin assigned lead & conversation
      expect(conv.assigned_employee_id).toBe(AARAV_ID); // Aarav has highest initial weight
      expect(lead.metadata?.assignedEmployeeId).toBe(AARAV_ID);

      // 5. Verify Assignment Audit record
      expect(dbStore.assignment_audit).toHaveLength(1);
      expect(dbStore.assignment_audit[0].new_employee_id).toBe(AARAV_ID);
      expect(dbStore.assignment_audit[0].reason).toBe('NEW_LEAD_ASSIGNMENT');

      // 6. Verify Webhook Event marked completed
      expect(dbStore.webhook_events).toHaveLength(1);
      expect(dbStore.webhook_events[0].processing_status).toBe('completed');
    });

    it('retains existing eligible owner for returning contacts without consuming weighted assignment', async () => {
      const senderPhone = '+919876543210';
      const existingLeadId = randomUUID();
      const existingConvId = randomUUID();

      // Pre-seed returning lead owned by Diya
      dbStore.leads.push({
        id: existingLeadId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Rohan Gupta',
        phone_number: senderPhone,
        external_contact_id: senderPhone,
        source: 'whatsapp',
        metadata: { assignedEmployeeId: DIYA_ID },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbStore.conversations.push({
        id: existingConvId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: existingLeadId,
        channel_id: CHANNEL_ID,
        assigned_employee_id: DIYA_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const messageId = 'wamid.HBgLTEST_RETURNING_002==';
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: ACTIVE_PHONE_NUMBER_ID },
                  messages: [
                    {
                      from: senderPhone,
                      id: messageId,
                      timestamp: '1729315300',
                      type: 'text',
                      text: { body: 'What time is the yoga class?' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(webhookPayload));
      const sig = mockProvider.generateSignature(rawBody);

      const res = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      // Lead count unchanged
      expect(dbStore.leads).toHaveLength(1);
      expect(dbStore.conversations).toHaveLength(1);

      // Retains existing owner Diya
      const conv = dbStore.conversations[0];
      expect(conv.assigned_employee_id).toBe(DIYA_ID);

      // Ownership retained without consuming round-robin state or writing re-assignment audit
      expect(dbStore.assignment_audit).toHaveLength(0);
      expect(dbStore.chat_assignment_state).toHaveLength(0);
    });

    it('enforces idempotency on duplicate webhook receipts (no duplicate leads/convs/messages/assignments)', async () => {
      const messageId = 'wamid.HBgLTEST_DUPLICATE_003==';
      const senderPhone = '+919999988888';

      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: ACTIVE_PHONE_NUMBER_ID },
                  messages: [
                    {
                      from: senderPhone,
                      id: messageId,
                      timestamp: '1729315400',
                      type: 'text',
                      text: { body: 'Duplicate test message' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(webhookPayload));
      const sig = mockProvider.generateSignature(rawBody);

      // First webhook post
      const res1 = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(webhookPayload);
      expect(res1.status).toBe(200);
      expect(dbStore.leads).toHaveLength(1);
      expect(dbStore.messages).toHaveLength(1);
      expect(dbStore.assignment_audit).toHaveLength(1);

      // Duplicate webhook post with identical payload
      const res2 = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(webhookPayload);
      expect(res2.status).toBe(200);

      // Assert no duplicates created
      expect(dbStore.leads).toHaveLength(1);
      expect(dbStore.conversations).toHaveLength(1);
      expect(dbStore.messages).toHaveLength(1);
      expect(dbStore.assignment_audit).toHaveLength(1);
    });

    it('safely handles unknown and inactive channels without creating records', async () => {
      // 1. Unknown Channel
      const unknownPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-unknown',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: '999999999999999' },
                  messages: [{ from: '+15551234567', id: 'wamid.unknown.1', type: 'text', text: { body: 'Hi' } }],
                },
              },
            ],
          },
        ],
      };
      let raw = Buffer.from(JSON.stringify(unknownPayload));
      let sig = mockProvider.generateSignature(raw);

      const resUnknown = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(unknownPayload);

      expect(resUnknown.status).toBe(200);
      expect(dbStore.leads).toHaveLength(0);
      expect(dbStore.conversations).toHaveLength(0);
      expect(dbStore.messages).toHaveLength(0);
      expect(dbStore.webhook_events[0].processing_status).toBe('ignored');
      expect(dbStore.webhook_events[0].error_code).toBe('CHANNEL_INACTIVE_OR_UNKNOWN');

      // 2. Inactive Channel
      const inactivePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-inactive',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: INACTIVE_PHONE_NUMBER_ID },
                  messages: [{ from: '+15551234567', id: 'wamid.inactive.1', type: 'text', text: { body: 'Hi' } }],
                },
              },
            ],
          },
        ],
      };
      raw = Buffer.from(JSON.stringify(inactivePayload));
      sig = mockProvider.generateSignature(raw);

      const resInactive = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(inactivePayload);

      expect(resInactive.status).toBe(200);
      expect(dbStore.leads).toHaveLength(0);
      expect(dbStore.conversations).toHaveLength(0);
      expect(dbStore.messages).toHaveLength(0);
    });

    it('safely processes unsupported message types (e.g. sticker) and audio media without crashing', async () => {
      const stickerPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: ACTIVE_PHONE_NUMBER_ID },
                  messages: [
                    {
                      from: '+919811122233',
                      id: 'wamid.sticker.1',
                      type: 'sticker',
                      sticker: { mime_type: 'image/webp', sha256: 'mockhash', id: 'stick-1' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const raw = Buffer.from(JSON.stringify(stickerPayload));
      const sig = mockProvider.generateSignature(raw);

      const res = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(stickerPayload);

      expect(res.status).toBe(200);
      expect(dbStore.messages).toHaveLength(1);
      expect(dbStore.messages[0].body).toBe('[STICKER]');
      expect(dbStore.messages[0].payload).toBeDefined();
    });
  });

  describe('Delivery-Status Webhook Notifications', () => {
    it('updates outbound message delivery_status monotonically from sent to delivered to read', async () => {
      const externalMsgId = 'wamid.HBgLOUTBOUND_001==';
      const convId = randomUUID();

      // Pre-seed conversation and outbound message in 'sent' status
      dbStore.conversations.push({
        id: convId,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: randomUUID(),
        channel_id: CHANNEL_ID,
        assigned_employee_id: AARAV_ID,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbStore.messages.push({
        id: randomUUID(),
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        conversation_id: convId,
        external_message_id: externalMsgId,
        direction: 'outbound',
        message_type: 'text',
        body: 'Your gym pass is confirmed!',
        delivery_status: 'sent',
        sent_at: '2026-10-19T06:00:00.000Z',
        delivered_at: null,
        read_at: null,
        payload: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 1. Deliver 'delivered' status
      const deliveredPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: ACTIVE_PHONE_NUMBER_ID },
                  statuses: [
                    {
                      id: externalMsgId,
                      status: 'delivered',
                      timestamp: '1729317600',
                      recipient_id: '15551234567',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      let raw = Buffer.from(JSON.stringify(deliveredPayload));
      let sig = mockProvider.generateSignature(raw);

      const resDelivered = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(deliveredPayload);

      expect(resDelivered.status).toBe(200);
      expect(dbStore.messages[0].delivery_status).toBe('delivered');
      expect(dbStore.messages[0].delivered_at).toBeDefined();

      // 2. Deliver 'read' status
      const readPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-alpha-12345',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: ACTIVE_PHONE_NUMBER_ID },
                  statuses: [
                    {
                      id: externalMsgId,
                      status: 'read',
                      timestamp: '1729317660',
                      recipient_id: '15551234567',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      raw = Buffer.from(JSON.stringify(readPayload));
      sig = mockProvider.generateSignature(raw);

      const resRead = await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(readPayload);

      expect(resRead.status).toBe(200);
      expect(dbStore.messages[0].delivery_status).toBe('read');
      expect(dbStore.messages[0].read_at).toBeDefined();

      // 3. Regressive status (e.g. late delivered packet) should be safely rejected
      await request(app)
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', sig)
        .send(deliveredPayload);

      // Status remains read, did not regress
      expect(dbStore.messages[0].delivery_status).toBe('read');
    });
  });
});
