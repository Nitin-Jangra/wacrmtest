import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createHelpdeskApp } from '../../apps/api/src/app';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_NOIDA_ID,
  BETA_BRANCH_JAIPUR_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { helpdeskRepository } from '../../apps/api/src/repositories/helpdesk.repository';
import { helpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { crmAdapter } from '../../apps/api/src/integrations/crm/crm-adapter.factory';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { SupabaseClient } from '@supabase/supabase-js';

const BETA_EMP_ID = 'e2222222-0001-4000-8000-000000000001';
const ALPHA_EMP_ID = 'e1111111-0001-4000-8000-000000000001';

// In-memory mock client builder for repository interactions
function createMockSupabaseClient(): SupabaseClient {
  const store: Record<string, any[]> = {};

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
        upsert: (row: any) => {
          const item = {
            id: row.id || `id-${Math.random().toString(36).substring(7)}`,
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
        order: () => queryBuilder,
        single: async () => ({ data: currentData[0] || null, error: null }),
        maybeSingle: async () => ({ data: currentData[0] || null, error: null }),
        then: (resolve: any) => resolve({ data: currentData, error: null, count: currentData.length }),
      };

      return queryBuilder;
    },
  };

  return mock as unknown as SupabaseClient;
}

describe('Helpdesk Multi-Tenant Security & Isolation Tests', () => {
  const app = createHelpdeskApp();

  beforeAll(() => {
    helpdeskService.setCrmAdapter(new MockCrmAdapter());
  });

  afterAll(() => {
    helpdeskService.setCrmAdapter(crmAdapter);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setSupabaseClient(createMockSupabaseClient());
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  // 1. Cross-tenant branch association in Channel creation
  it('1. Rejects channel creation when branch belongs to a different tenant', async () => {
    const res = await request(app)
      .post('/api/v1/channels')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: BETA_BRANCH_JAIPUR_ID, // Jaipur belongs to Beta!
        provider: 'meta_cloud',
        displayName: 'Malicious Alpha Channel on Beta Branch',
        status: 'active',
        configuration: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Cross-tenant violation');
  });

  // 2. Cross-tenant employee in Agent Settings
  it('2. Rejects agent setting creation when employee belongs to a different tenant', async () => {
    const res = await request(app)
      .post('/api/v1/agent-settings')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_NOIDA_ID,
        employeeId: BETA_EMP_ID, // Vikram belongs to Beta!
        isEligible: true,
        assignmentWeight: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Cross-tenant violation');
  });

  // 3. Cross-tenant lead creation
  it('3. Rejects lead creation when branch belongs to a different tenant', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: BETA_BRANCH_JAIPUR_ID, // Beta branch
        phoneNumber: '+919999888877',
        name: 'Cross-Tenant Lead Test',
        source: 'whatsapp',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Cross-tenant violation');
  });

  // 4. Cross-tenant conversation creation (mismatched lead)
  it('4. Rejects conversation creation when lead belongs to a different tenant', async () => {
    // Stub lead belonging to Beta
    vi.spyOn(helpdeskRepository, 'getLeadById').mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000099',
      tenantId: TENANT_BETA_ID,
      branchId: BETA_BRANCH_JAIPUR_ID,
      externalContactId: null,
      name: 'Beta Lead',
      phoneNumber: '+919999888877',
      email: null,
      source: 'whatsapp',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/conversations')
      .send({
        tenantId: TENANT_ALPHA_ID, // Mismatched tenant
        branchId: ALPHA_BRANCH_NOIDA_ID,
        leadId: 'a0000000-0000-4000-8000-000000000099',
        channelId: 'b0000000-0000-4000-8000-000000000001',
        status: 'open',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Lead scope violation');
  });

  // 5. Cross-tenant conversation creation (mismatched channel)
  it('5. Rejects conversation creation when channel belongs to a different tenant', async () => {
    // Stub lead belonging to Alpha
    vi.spyOn(helpdeskRepository, 'getLeadById').mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      tenantId: TENANT_ALPHA_ID,
      branchId: ALPHA_BRANCH_NOIDA_ID,
      externalContactId: null,
      name: 'Alpha Lead',
      phoneNumber: '+919999888877',
      email: null,
      source: 'whatsapp',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Stub channel belonging to Beta
    vi.spyOn(helpdeskRepository, 'getChannelById').mockResolvedValue({
      id: 'b0000000-0000-4000-8000-000000000002',
      tenantId: TENANT_BETA_ID,
      branchId: BETA_BRANCH_JAIPUR_ID,
      provider: 'meta_cloud',
      phoneNumberId: '+919800000002',
      wabaId: 'waba-beta',
      displayName: 'Beta Channel',
      status: 'active',
      credentialReference: null,
      configuration: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/conversations')
      .send({
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_NOIDA_ID,
        leadId: 'a0000000-0000-4000-8000-000000000001',
        channelId: 'b0000000-0000-4000-8000-000000000002',
        status: 'open',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Channel scope violation');
  });

  // 6. Cross-tenant follow-up creation
  it('6. Rejects follow-up scheduling when conversation belongs to a different tenant', async () => {
    vi.spyOn(helpdeskRepository, 'getConversationById').mockResolvedValue({
      id: 'c0000000-0000-4000-8000-000000000001',
      tenantId: TENANT_BETA_ID, // Beta conversation
      branchId: BETA_BRANCH_JAIPUR_ID,
      leadId: 'a0000000-0000-4000-8000-000000000099',
      assignedEmployeeId: null,
      channelId: 'b0000000-0000-4000-8000-000000000002',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: null,
      closedAt: null,
    });

    const res = await request(app)
      .post('/api/v1/follow-ups')
      .send({
        tenantId: TENANT_ALPHA_ID, // Alpha trying to schedule on Beta conversation
        branchId: ALPHA_BRANCH_NOIDA_ID,
        conversationId: 'c0000000-0000-4000-8000-000000000001',
        assignedEmployeeId: ALPHA_EMP_ID,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        note: 'Follow-up cross-tenant test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(res.body.error.message).toContain('Follow-up tenant/branch does not match conversation scope');
  });

  // 7. Channel listing requires tenantId query parameter
  it('7. Channel listing rejects request without tenantId filter', async () => {
    const res = await request(app).get('/api/v1/channels');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_QUERY');
  });

  // 8. Lead listing requires tenantId query parameter
  it('8. Lead listing rejects request without tenantId filter', async () => {
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_QUERY');
  });

  // 9. Conversation listing requires tenantId query parameter
  it('9. Conversation listing rejects request without tenantId filter', async () => {
    const res = await request(app).get('/api/v1/conversations');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_QUERY');
  });

  // 10. Channel listing query-level isolation
  it('10. Channel listing filters by tenantId at repository level', async () => {
    const listSpy = vi.spyOn(helpdeskRepository, 'listChannels').mockResolvedValue([]);
    const res = await request(app).get(`/api/v1/channels?tenantId=${TENANT_ALPHA_ID}`);

    expect(res.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(TENANT_ALPHA_ID, undefined);
  });

  // 11. Lead listing query-level isolation
  it('11. Lead listing filters by tenantId and branchId', async () => {
    const listSpy = vi.spyOn(helpdeskRepository, 'listLeads').mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get(
      `/api/v1/leads?tenantId=${TENANT_ALPHA_ID}&branchId=${ALPHA_BRANCH_NOIDA_ID}&page=1&limit=20`,
    );

    expect(res.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(TENANT_ALPHA_ID, ALPHA_BRANCH_NOIDA_ID, 1, 20);
  });

  // 12. Conversation listing query-level isolation
  it('12. Conversation listing filters by tenantId and status', async () => {
    const listSpy = vi.spyOn(helpdeskRepository, 'listConversations').mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get(
      `/api/v1/conversations?tenantId=${TENANT_ALPHA_ID}&status=open&page=1&limit=10`,
    );

    expect(res.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(TENANT_ALPHA_ID, undefined, 'open', 1, 10);
  });
});
