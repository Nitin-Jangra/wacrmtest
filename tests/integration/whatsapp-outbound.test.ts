import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createHelpdeskApp } from '../../apps/api/src/app';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { assignmentService } from '../../apps/api/src/services/assignment/assignment.service';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { whatsappMessagingService } from '../../apps/api/src/services/whatsapp/whatsapp-messaging.service';
import { MockWhatsAppProvider } from '../../apps/api/src/integrations/whatsapp/mock-whatsapp.provider';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_BRANCH_NOIDA_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { SupabaseClient } from '@supabase/supabase-js';

interface TestStore {
  whatsapp_channels: any[];
  leads: any[];
  conversations: any[];
  messages: any[];
  [key: string]: any[];
}

function createMockSupabaseClient(store: Record<string, any[]> = {}): SupabaseClient {
  const tables = ['whatsapp_channels', 'leads', 'conversations', 'messages'];
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
        update: (updates: any) => {
          pendingUpdates = updates;
          return queryBuilder;
        },
        eq: (field: string, val: any) => {
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

describe('WhatsApp Outbound Messaging Integration Tests', () => {
  const app = createHelpdeskApp();
  const mockCrm = new MockCrmAdapter();
  const mockProvider = new MockWhatsAppProvider('test_secret');

  const ACTIVE_PHONE_NUMBER_ID = '109876543210987';
  const INACTIVE_PHONE_NUMBER_ID = '109876543210988';
  const CHANNEL_ID = 'c1111111-0001-4000-a000-000000000001';
  const INACTIVE_CHANNEL_ID = 'c1111111-0002-4000-a000-000000000002';

  // Alpha Greater Noida branch admin (Aarav)
  const AARAV_IDENTITY = 'alpha_branch_admin';
  // Beta Tenant Admin
  const BETA_ADMIN_IDENTITY = 'beta_admin';

  const CONVERSATION_ALPHA_ID = 'c0000000-0001-4000-8000-000000000001';
  const LEAD_ALPHA_ID = 'l0000000-0001-4000-8000-000000000001';

  let dbStore: TestStore;

  const setupStore = (): TestStore => ({
    whatsapp_channels: [
      {
        id: CHANNEL_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        provider: 'meta_whatsapp',
        phone_number_id: ACTIVE_PHONE_NUMBER_ID,
        waba_id: 'waba-alpha-12345',
        display_name: 'Alpha GN Support',
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
        display_name: 'Alpha Inactive Support',
        status: 'inactive',
        credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
        configuration: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    leads: [
      {
        id: LEAD_ALPHA_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        name: 'Member Test',
        phone_number: '+919876543210',
        external_contact_id: '+919876543210',
        source: 'whatsapp',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    conversations: [
      {
        id: CONVERSATION_ALPHA_ID,
        tenant_id: TENANT_ALPHA_ID,
        branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
        lead_id: LEAD_ALPHA_ID,
        channel_id: CHANNEL_ID,
        assigned_employee_id: 'e1111111-0001-4000-8000-000000000001',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    messages: [],
  });

  beforeEach(() => {
    dbStore = setupStore();
    setSupabaseClient(createMockSupabaseClient(dbStore));
    mockProvider.clearSentMessages();
    mockProvider.setMode('success');
    whatsappMessagingService.setProvider(mockProvider);
    assignmentService.setCrmAdapter(mockCrm);
    helpdeskService.setCrmAdapter(mockCrm);
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  it('sends text message through WhatsApp provider and updates delivery status to sent', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONVERSATION_ALPHA_ID}/messages`)
      .set('x-mock-identity', AARAV_IDENTITY)
      .send({
        type: 'text',
        text: 'Hello! How can we help you?',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.status).toBe('sent');
    expect(res.body.data.externalMessageId).toMatch(/^wamid\./);
    expect(res.body.data.deliveryStatus).toBe('sent');
    expect(res.body.data.body).toBe('Hello! How can we help you?');

    // Check message persisted in database
    expect(dbStore.messages).toHaveLength(1);
    const msg = dbStore.messages[0];
    expect(msg.direction).toBe('outbound');
    expect(msg.delivery_status).toBe('sent');
    expect(msg.external_message_id).toBe(res.body.data.externalMessageId);

    // Check mock provider dispatched
    const sent = mockProvider.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('+919876543210');
    expect(sent[0].text).toBe('Hello! How can we help you?');
  });

  it('rejects message sending from unauthorized employee in different branch', async () => {
    // Create conversation in Alpha Noida branch
    const NOIDA_CONV_ID = randomUUID();
    dbStore.conversations.push({
      id: NOIDA_CONV_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_NOIDA_ID, // Different branch!
      lead_id: LEAD_ALPHA_ID,
      channel_id: CHANNEL_ID,
      assigned_employee_id: null,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post(`/api/v1/conversations/${NOIDA_CONV_ID}/messages`)
      .set('x-mock-identity', AARAV_IDENTITY) // Aarav is in Greater Noida, not Indirapuram
      .send({
        type: 'text',
        text: 'Unauthorized cross-branch attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_SCOPE_FORBIDDEN');
    expect(mockProvider.getSentMessages()).toHaveLength(0);
  });

  it('rejects message sending from cross-tenant employee (Beta -> Alpha)', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONVERSATION_ALPHA_ID}/messages`)
      .set('x-mock-identity', BETA_ADMIN_IDENTITY) // Beta Admin attempting on Alpha
      .send({
        type: 'text',
        text: 'Cross tenant attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
    expect(dbStore.messages).toHaveLength(0);
  });

  it('rejects outbound message when channel is inactive with 422', async () => {
    // Point conversation to inactive channel
    dbStore.conversations[0].channel_id = INACTIVE_CHANNEL_ID;

    const res = await request(app)
      .post(`/api/v1/conversations/${CONVERSATION_ALPHA_ID}/messages`)
      .set('x-mock-identity', AARAV_IDENTITY)
      .send({
        type: 'text',
        text: 'Channel is inactive',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WHATSAPP_CHANNEL_INACTIVE');
  });

  it('records message as failed when provider rejects with error details', async () => {
    mockProvider.setMode('rejection');

    const res = await request(app)
      .post(`/api/v1/conversations/${CONVERSATION_ALPHA_ID}/messages`)
      .set('x-mock-identity', AARAV_IDENTITY)
      .send({
        type: 'text',
        text: 'Will be rejected by mock provider',
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('WHATSAPP_PROVIDER_ERROR');

    // Message record must be persisted and marked failed
    expect(dbStore.messages).toHaveLength(1);
    expect(dbStore.messages[0].delivery_status).toBe('failed');
    expect(dbStore.messages[0].payload.sendError).toBeDefined();
  });

  it('preserves backwards compatibility for legacy direct message persistence without provider dispatch', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONVERSATION_ALPHA_ID}/messages`)
      .send({
        direction: 'inbound',
        messageType: 'text',
        body: 'Internal note or imported chat message',
        deliveryStatus: 'delivered',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe('Internal note or imported chat message');
    expect(mockProvider.getSentMessages()).toHaveLength(0); // Provider was not triggered
  });
});
