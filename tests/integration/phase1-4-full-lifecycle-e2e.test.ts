import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { whatsappWebhookService } from '../../apps/api/src/services/whatsapp/whatsapp-webhook.service';
import { whatsappMessagingService } from '../../apps/api/src/services/whatsapp/whatsapp-messaging.service';
import { MockWhatsAppProvider } from '../../apps/api/src/integrations/whatsapp/mock-whatsapp.provider';
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

interface E2EStore {
  whatsapp_channels: any[];
  leads: any[];
  conversations: any[];
  messages: any[];
  webhook_events: any[];
  assignment_audit: any[];
  chat_agent_settings: any[];
  chat_assignment_rules: any[];
  chat_assignment_state: any[];
  [key: string]: any[];
}

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

describe('Phases 1-4 Complete Full Lifecycle Integration & Verification', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();
  const testAppSecret = 'phase4_e2e_secret_12345';
  const testVerifyToken = 'phase4_e2e_verify_token';
  const mockProvider = new MockWhatsAppProvider(testAppSecret);

  // Channels
  const ALPHA_PHONE_NUMBER_ID = '109876543210987';
  const BETA_PHONE_NUMBER_ID = '209876543210987';
  const CHANNEL_ALPHA_ID = 'c1111111-0001-4000-a000-000000000001';
  const CHANNEL_BETA_ID = 'c2222222-0001-4000-a000-000000000001';

  // Employees (from Phase 1 mock CRM fixtures)
  const AARAV_ID = 'e1111111-0001-4000-8000-000000000001'; // Alpha GN (wt 15)
  const DIYA_ID = 'e1111111-0002-4000-8000-000000000002'; // Alpha GN (wt 10)
  const KAVYA_ID = 'e2222222-0002-4000-8000-000000000002'; // Beta Jaipur

  let dbStore: E2EStore;

  const setupE2EFixtures = (): E2EStore => ({
    whatsapp_channels: [
      {
        id: CHANNEL_ALPHA_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        provider: 'meta_whatsapp',
        phone_number_id: ALPHA_PHONE_NUMBER_ID,
        waba_id: 'waba-alpha-12345',
        display_name: 'Alpha Greater Noida WhatsApp Helpdesk',
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
        waba_id: 'waba-beta-12345',
        display_name: 'Beta Jaipur WhatsApp Helpdesk',
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
      {
        id: 'setting-kavya',
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
    chat_assignment_state: [],
    assignment_audit: [],
    leads: [],
    conversations: [],
    messages: [],
    webhook_events: [],
  });

  beforeEach(() => {
    dbStore = setupE2EFixtures();
    setSupabaseClient(createMockSupabaseClient(dbStore));
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
    mockProvider.clearSentMessages();
    mockProvider.setMode('success');
    whatsappWebhookService.setProvider(mockProvider);
    whatsappWebhookService.setVerifyToken(testVerifyToken);
    whatsappMessagingService.setProvider(mockProvider);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  it('Scenario 1: Meta webhook handshake -> Inbound WhatsApp message -> Smooth Weighted Assignment (Aarav then Diya)', async () => {
    // 1. Meta Webhook Handshake Verification
    const handshakeRes = await request(app)
      .get('/api/v1/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': testVerifyToken,
        'hub.challenge': 'challenge_token_phase4_verified',
      });
    expect(handshakeRes.status).toBe(200);
    expect(handshakeRes.text).toBe('challenge_token_phase4_verified');

    // 2. First Inbound WhatsApp Message from Rohan (+919800011111)
    const msg1Id = 'wamid.HBgLROHAN001==';
    const payload1 = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Rohan Member' }, wa_id: '+919800011111' }],
                messages: [
                  {
                    from: '+919800011111',
                    id: msg1Id,
                    timestamp: '1729320000',
                    type: 'text',
                    text: { body: 'Inquiring about personal training in Greater Noida gym' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const raw1 = Buffer.from(JSON.stringify(payload1));
    const sig1 = mockProvider.generateSignature(raw1);

    const res1 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', sig1)
      .send(payload1);

    expect(res1.status).toBe(200);
    expect(res1.body.processedMessages).toBe(1);

    // Verify Lead 1 and Conversation 1
    expect(dbStore.leads).toHaveLength(1);
    expect(dbStore.conversations).toHaveLength(1);
    expect(dbStore.messages).toHaveLength(1);

    const lead1 = dbStore.leads[0];
    const conv1 = dbStore.conversations[0];
    expect(lead1.tenant_id).toBe(TENANT_ALPHA_ID);
    expect(lead1.branch_id).toBe(ALPHA_BRANCH_GREATER_NOIDA_ID);
    expect(lead1.name).toBe('Rohan Member');
    expect(lead1.phone_number).toBe('+919800011111');

    // SWRR selection 1: Aarav (weight 15 > Diya weight 10)
    expect(conv1.assigned_employee_id).toBe(AARAV_ID);
    expect(lead1.metadata.assignedEmployeeId).toBe(AARAV_ID);
    expect(dbStore.assignment_audit).toHaveLength(1);
    expect(dbStore.assignment_audit[0].new_employee_id).toBe(AARAV_ID);
    expect(dbStore.assignment_audit[0].reason).toBe('NEW_LEAD_ASSIGNMENT');

    // 3. Second Inbound WhatsApp Message from Priya (+919800022222)
    const msg2Id = 'wamid.HBgLPRIYA002==';
    const payload2 = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Priya Patel' }, wa_id: '+919800022222' }],
                messages: [
                  {
                    from: '+919800022222',
                    id: msg2Id,
                    timestamp: '1729320100',
                    type: 'text',
                    text: { body: 'What are the gym hours?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw2 = Buffer.from(JSON.stringify(payload2));
    const sig2 = mockProvider.generateSignature(raw2);

    const res2 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', sig2)
      .send(payload2);

    expect(res2.status).toBe(200);
    expect(dbStore.leads).toHaveLength(2);
    expect(dbStore.conversations).toHaveLength(2);

    // SWRR selection 2: Diya (current weights after Aarav's decrease give Diya priority)
    const conv2 = dbStore.conversations[1];
    expect(conv2.assigned_employee_id).toBe(DIYA_ID);
    expect(dbStore.assignment_audit).toHaveLength(2);
    expect(dbStore.assignment_audit[1].new_employee_id).toBe(DIYA_ID);
  });

  it('Scenario 2: Outbound Agent Messaging & Delivery-Status Progression (pending -> sent -> delivered -> read)', async () => {
    // 1. First trigger inbound message to create lead & conversation
    const msgId = 'wamid.inbound.lifecycle.1';
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Gym Lead' }, wa_id: '+919811122233' }],
                messages: [
                  {
                    from: '+919811122233',
                    id: msgId,
                    timestamp: '1729320200',
                    type: 'text',
                    text: { body: 'Hi, I need membership details' },
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
    await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload);

    const convId = dbStore.conversations[0].id;

    // 2. Assigned Agent sends an outbound response
    const sendRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('x-mock-identity', 'alpha_branch_admin') // Aarav
      .send({
        type: 'text',
        text: 'Welcome to Alpha Gym! Our monthly pass is 2000 INR.',
      });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.status).toBe('sent');
    const outboundMsgId = sendRes.body.data.externalMessageId;
    expect(outboundMsgId).toMatch(/^wamid\./);

    // Check message persisted as sent
    const getOutboundInDb = () => dbStore.messages.find((m) => m.external_message_id === outboundMsgId);
    expect(getOutboundInDb()?.delivery_status).toBe('sent');
    expect(getOutboundInDb()?.sent_at).toBeDefined();

    // 3. Meta delivers "delivered" receipt webhook
    const deliveredPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                statuses: [
                  {
                    id: outboundMsgId,
                    status: 'delivered',
                    timestamp: '1729320250',
                    recipient_id: '+919811122233',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawDelivered = Buffer.from(JSON.stringify(deliveredPayload));
    const sigDelivered = mockProvider.generateSignature(rawDelivered);
    await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sigDelivered).send(deliveredPayload);

    expect(getOutboundInDb()?.delivery_status).toBe('delivered');
    expect(getOutboundInDb()?.delivered_at).toBeDefined();

    // 4. Meta delivers "read" receipt webhook
    const readPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                statuses: [
                  {
                    id: outboundMsgId,
                    status: 'read',
                    timestamp: '1729320300',
                    recipient_id: '+919811122233',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawRead = Buffer.from(JSON.stringify(readPayload));
    const sigRead = mockProvider.generateSignature(rawRead);
    await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sigRead).send(readPayload);

    expect(getOutboundInDb()?.delivery_status).toBe('read');
    expect(getOutboundInDb()?.read_at).toBeDefined();

    // 5. Out-of-order/regressive status receipt: Meta re-delivers late "delivered" packet
    await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sigDelivered).send(deliveredPayload);

    // Status does not regress back to delivered; stays read
    expect(getOutboundInDb()?.delivery_status).toBe('read');
  });

  it('Scenario 3: Returning Contact Retention across all 4 phases', async () => {
    const senderPhone = '+919877766554';

    // First Message creates Lead and assigns to Aarav
    const payload1 = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Returning Lead' }, wa_id: senderPhone }],
                messages: [
                  {
                    from: senderPhone,
                    id: 'wamid.ret.001',
                    timestamp: '1729321000',
                    type: 'text',
                    text: { body: 'First inquiry' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    let raw = Buffer.from(JSON.stringify(payload1));
    let sig = mockProvider.generateSignature(raw);
    await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload1);

    expect(dbStore.leads).toHaveLength(1);
    expect(dbStore.conversations).toHaveLength(1);
    expect(dbStore.conversations[0].assigned_employee_id).toBe(AARAV_ID);
    expect(dbStore.assignment_audit).toHaveLength(1);

    // Second message from same contact days later
    const payload2 = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Returning Lead' }, wa_id: senderPhone }],
                messages: [
                  {
                    from: senderPhone,
                    id: 'wamid.ret.002',
                    timestamp: '1729325000',
                    type: 'text',
                    text: { body: 'I want to renew my gym membership' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    raw = Buffer.from(JSON.stringify(payload2));
    sig = mockProvider.generateSignature(raw);
    const res2 = await request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload2);

    expect(res2.status).toBe(200);

    // No duplicate leads or conversations
    expect(dbStore.leads).toHaveLength(1);
    expect(dbStore.conversations).toHaveLength(1);

    // Aarav retained as owner without consuming round-robin assignment
    expect(dbStore.conversations[0].assigned_employee_id).toBe(AARAV_ID);
    // Audit log count unchanged (no redundant assignment was executed)
    expect(dbStore.assignment_audit).toHaveLength(1);
    // Second message persisted in same conversation
    expect(dbStore.messages).toHaveLength(2);
    expect(dbStore.messages[1].conversation_id).toBe(dbStore.conversations[0].id);
  });

  it('Scenario 4: Cross-Tenant WhatsApp Isolation (Alpha vs Beta)', async () => {
    // Inbound WhatsApp message to Beta Jaipur channel
    const betaMsgId = 'wamid.beta.e2e.001';
    const betaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-beta-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: BETA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Jaipur Member' }, wa_id: '+919141414141' }],
                messages: [
                  {
                    from: '+919141414141',
                    id: betaMsgId,
                    timestamp: '1729326000',
                    type: 'text',
                    text: { body: 'Inquiry for Jaipur branch gym' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBeta = Buffer.from(JSON.stringify(betaPayload));
    const sigBeta = mockProvider.generateSignature(rawBeta);

    const betaRes = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', sigBeta)
      .send(betaPayload);

    expect(betaRes.status).toBe(200);

    // Verify Beta lead and conversation are isolated to Beta tenant and branch
    const betaLead = dbStore.leads.find((l) => l.tenant_id === TENANT_BETA_ID);
    const betaConv = dbStore.conversations.find((c) => c.tenant_id === TENANT_BETA_ID);
    expect(betaLead).toBeDefined();
    expect(betaConv).toBeDefined();
    expect(betaLead?.branch_id).toBe(BETA_BRANCH_JAIPUR_ID);
    expect(betaConv?.branch_id).toBe(BETA_BRANCH_JAIPUR_ID);
    // In Mock CRM, Beta has no active eligible chat agents (Vikram is tenant_admin with chatSupportEligible=false)
    expect(betaConv?.assigned_employee_id).toBeNull();

    // Tenant Alpha branch admin tries to reply to Beta conversation
    const crossTenantSend = await request(app)
      .post(`/api/v1/conversations/${betaConv?.id}/messages`)
      .set('x-mock-identity', 'alpha_branch_admin')
      .send({
        type: 'text',
        text: 'Illicit Alpha reply to Beta conversation',
      });

    expect(crossTenantSend.status).toBe(403);
    expect(crossTenantSend.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
  });

  it('Scenario 5: Webhook Idempotency & Fault Tolerance under concurrent duplicate deliveries', async () => {
    const duplicateMsgId = 'wamid.concurrent.e2e.999';
    const sender = '+919855544433';

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-alpha-12345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: ALPHA_PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Concurrent Lead' }, wa_id: sender }],
                messages: [
                  {
                    from: sender,
                    id: duplicateMsgId,
                    timestamp: '1729327000',
                    type: 'text',
                    text: { body: 'Testing concurrent delivery safety' },
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

    // Fire 4 identical concurrent webhook POSTs
    const responses = await Promise.all([
      request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload),
      request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload),
      request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload),
      request(app).post('/api/v1/webhooks/whatsapp').set('x-hub-signature-256', sig).send(payload),
    ]);

    // All should be acknowledged with 200 OK
    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    // Exactly 1 lead, 1 conversation, 1 message, and 1 assignment record created
    expect(dbStore.leads).toHaveLength(1);
    expect(dbStore.conversations).toHaveLength(1);
    expect(dbStore.messages).toHaveLength(1);
    expect(dbStore.assignment_audit).toHaveLength(1);
  });
});
