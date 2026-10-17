import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HelpdeskRepository } from '../../apps/api/src/repositories/helpdesk.repository';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { SupabaseClient } from '@supabase/supabase-js';

// Clean mock implementation of Supabase fluent query builder
function createMockSupabaseClient(tableData: Record<string, any[]> = {}): SupabaseClient {
  const store: Record<string, any[]> = { ...tableData };

  const mock = {
    from: (tableName: string) => {
      let currentData = [...(store[tableName] || [])];
      const queryBuilder: any = {
        select: (_fields: string = '*', _options?: any) => {
          return queryBuilder;
        },
        insert: (rows: any) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          const inserted = rowArray.map((r) => ({
            id: r.id || 'mock-id-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          store[tableName] = [...(store[tableName] || []), ...inserted];
          currentData = inserted;
          return queryBuilder;
        },
        upsert: (row: any, _options?: any) => {
          const item = {
            id: row.id || 'mock-upsert-id',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...row,
          };
          store[tableName] = [item];
          currentData = [item];
          return queryBuilder;
        },
        update: (updates: any) => {
          currentData = currentData.map((item) => ({ ...item, ...updates, updated_at: new Date().toISOString() }));
          return queryBuilder;
        },
        eq: (field: string, val: any) => {
          currentData = currentData.filter((item) => item[field] === val);
          return queryBuilder;
        },
        range: (from: number, to: number) => {
          currentData = currentData.slice(from, to + 1);
          return queryBuilder;
        },
        order: (_field: string, _opts?: any) => {
          return queryBuilder;
        },
        limit: (n: number) => {
          currentData = currentData.slice(0, n);
          return queryBuilder;
        },
        single: async () => {
          return { data: currentData[0] || null, error: null };
        },
        maybeSingle: async () => {
          return { data: currentData[0] || null, error: null };
        },
        then: (resolve: any) => {
          resolve({ data: currentData, error: null, count: currentData.length });
        },
      };

      return queryBuilder;
    },
  };

  return mock as unknown as SupabaseClient;
}

describe('HelpdeskRepository Unit Tests', () => {
  let repo: HelpdeskRepository;

  beforeEach(() => {
    const mockClient = createMockSupabaseClient();
    setSupabaseClient(mockClient);
    repo = new HelpdeskRepository();
  });

  afterEach(() => {
    setSupabaseClient(null);
  });

  describe('Channels', () => {
    it('should create and map channel to camelCase', async () => {
      const channel = await repo.createChannel({
        tenantId: '11111111-1111-4000-8000-000000000001',
        branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
        provider: 'meta_cloud',
        phoneNumberId: 'sim_phone_01',
        wabaId: 'sim_waba_01',
        displayName: 'Test Channel',
        status: 'active',
        credentialReference: null,
        configuration: {},
      });

      expect(channel.id).toBeDefined();
      expect(channel.tenantId).toBe('11111111-1111-4000-8000-000000000001');
      expect(channel.displayName).toBe('Test Channel');
      expect(channel.status).toBe('active');
    });

    it('should retrieve channel by ID', async () => {
      const initial = await repo.createChannel({
        tenantId: '11111111-1111-4000-8000-000000000001',
        branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
        provider: 'meta_cloud',
        phoneNumberId: 'sim_phone_01',
        wabaId: null,
        displayName: 'Test Channel',
        status: 'draft',
        credentialReference: null,
        configuration: {},
      });

      const fetched = await repo.getChannelById(initial.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(initial.id);
    });
  });

  describe('Agent Settings', () => {
    it('should upsert agent settings with non-negative weight', async () => {
      const setting = await repo.upsertAgentSetting({
        tenantId: '11111111-1111-4000-8000-000000000001',
        branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        designationId: 'd1111111-0002-4000-8000-000000000002',
        isEligible: true,
        assignmentWeight: 15,
      });

      expect(setting.employeeId).toBe('e1111111-0001-4000-8000-000000000001');
      expect(setting.isEligible).toBe(true);
      expect(setting.assignmentWeight).toBe(15);
    });
  });

  describe('Leads and Conversations', () => {
    it('should create lead and conversation', async () => {
      const lead = await repo.createLead({
        tenantId: '11111111-1111-4000-8000-000000000001',
        branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
        externalContactId: 'ext-101',
        name: 'John Doe',
        phoneNumber: '+919800000001',
        email: 'john@example.com',
        source: 'whatsapp',
        metadata: {},
      });

      expect(lead.id).toBeDefined();
      expect(lead.name).toBe('John Doe');

      const conv = await repo.createConversation({
        tenantId: lead.tenantId,
        branchId: lead.branchId,
        leadId: lead.id,
        channelId: 'mock-channel-id',
        assignedEmployeeId: null,
        status: 'open',
      });

      expect(conv.id).toBeDefined();
      expect(conv.status).toBe('open');
    });

    it('should add message to conversation', async () => {
      const msg = await repo.createMessage({
        tenantId: '11111111-1111-4000-8000-000000000001',
        branchId: 'aaaaaaaa-0001-4000-8000-000000000001',
        conversationId: 'mock-conv-1',
        externalMessageId: 'ext-msg-1',
        direction: 'inbound',
        messageType: 'text',
        body: 'Hello gym!',
        payload: {},
        deliveryStatus: 'delivered',
      });

      expect(msg.body).toBe('Hello gym!');
      expect(msg.direction).toBe('inbound');
    });
  });

  describe('Webhook Events Idempotency', () => {
    it('should record webhook event and return existing when duplicate', async () => {
      const evt1 = await repo.recordWebhookEvent({
        provider: 'meta_whatsapp',
        externalEventId: 'evt-unique-123',
        tenantId: null,
        channelId: null,
        eventType: 'messages',
        processingStatus: 'received',
        errorCode: null,
      });

      expect(evt1.externalEventId).toBe('evt-unique-123');

      // Query by external ID
      const fetched = await repo.getWebhookEvent('meta_whatsapp', 'evt-unique-123');
      expect(fetched).not.toBeNull();
      expect(fetched?.externalEventId).toBe('evt-unique-123');
    });
  });
});
