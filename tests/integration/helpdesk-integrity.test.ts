import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HelpdeskService } from '../../apps/api/src/services/helpdesk.service';
import { HelpdeskRepository } from '../../apps/api/src/repositories/helpdesk.repository';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { DatabaseConstraintError } from '../../apps/api/src/database/database.errors';
import {
  CreateAgentSettingSchema,
  CreateConversationSchema,
} from '@gym-helpdesk/shared-types';
import { SupabaseClient } from '@supabase/supabase-js';

// In-memory mock client builder
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

describe('Helpdesk Relational Integrity Tests (Phase 2)', () => {
  let service: HelpdeskService;
  let repo: HelpdeskRepository;
  let crm: MockCrmAdapter;

  const TENANT_ALPHA = '11111111-1111-4000-8000-000000000001';
  const ALPHA_BRANCH_1 = 'aaaaaaaa-0001-4000-8000-000000000001';
  const ALPHA_BRANCH_2 = 'aaaaaaaa-0002-4000-8000-000000000002';
  const BETA_BRANCH_1 = 'bbbbbbbb-0001-4000-8000-000000000001';

  beforeEach(() => {
    setSupabaseClient(createMockSupabaseClient());
    repo = new HelpdeskRepository();
    crm = new MockCrmAdapter();
    service = new HelpdeskService(repo, crm);
  });

  afterEach(() => {
    setSupabaseClient(null);
  });

  // Rule 1: A branch cannot be associated with a different tenant's channel
  it('1. A branch cannot be associated with a different tenant channel', async () => {
    // Attempting to create channel for Tenant Alpha using Beta's branch
    await expect(
      service.createChannel({
        tenantId: TENANT_ALPHA,
        branchId: BETA_BRANCH_1, // Beta branch
        provider: 'meta_cloud',
        phoneNumberId: null,
        wabaId: null,
        displayName: 'Corrupted Channel',
        status: 'draft',
        credentialReference: null,
        configuration: {},
      }),
    ).rejects.toThrow(DatabaseConstraintError);
  });

  // Rule 2: A designation from Tenant Beta cannot be associated with Tenant Alpha chat-agent settings
  it('2. A designation from Tenant Beta cannot be associated with Tenant Alpha agent setting', async () => {
    const betaDesigId = 'd2222222-0001-4000-8000-000000000001'; // Tenant Beta designation
    const alphaEmployeeId = 'e1111111-0001-4000-8000-000000000001'; // Tenant Alpha employee

    await expect(
      service.configureAgentSetting({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        employeeId: alphaEmployeeId,
        designationId: betaDesigId,
        isEligible: true,
        assignmentWeight: 10,
      }),
    ).rejects.toThrow(/Cross-tenant designation violation/);
  });

  // Rule 3: An employee from branch 2 cannot be configured for branch 1
  it('3. An employee from branch 2 cannot be configured for branch 1', async () => {
    const alphaEmpBranch2 = 'e1111111-0002-4000-8000-000000000002'; // Actually in branch 1 in mock
    // Attempting to configure with wrong branch
    await expect(
      service.configureAgentSetting({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_2, // Mismatched branch
        employeeId: alphaEmpBranch2,
        designationId: null,
        isEligible: true,
        assignmentWeight: 10,
      }),
    ).rejects.toThrow(/Cross-branch violation/);
  });

  // Rule 4: A lead from one branch cannot be attached to a conversation for another branch
  it('4. A lead from branch 1 cannot be attached to a conversation for branch 2', async () => {
    // Create lead in branch 1
    const lead = await repo.createLead({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      externalContactId: null,
      name: 'Alice',
      phoneNumber: '+919800000010',
      email: null,
      source: 'whatsapp',
      metadata: {},
    });

    // Create channel in branch 2
    const channel = await repo.createChannel({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_2,
      provider: 'meta_cloud',
      phoneNumberId: null,
      wabaId: null,
      displayName: 'Channel B2',
      status: 'active',
      credentialReference: null,
      configuration: {},
    });

    // Attempt to create conversation with lead from branch 1 in branch 2
    await expect(
      service.createConversation({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_2, // Conversation for branch 2
        leadId: lead.id,          // Lead is in branch 1!
        channelId: channel.id,
        assignedEmployeeId: null,
        status: 'open',
      }),
    ).rejects.toThrow(/Lead scope violation/);
  });

  // Rule 5: A conversation cannot use a channel from a different branch
  it('5. A conversation cannot use a channel from a different branch', async () => {
    const lead = await repo.createLead({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      externalContactId: null,
      name: 'Bob',
      phoneNumber: '+919800000011',
      email: null,
      source: 'whatsapp',
      metadata: {},
    });

    const channelB2 = await repo.createChannel({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_2, // Channel in Branch 2
      provider: 'meta_cloud',
      phoneNumberId: null,
      wabaId: null,
      displayName: 'Channel B2',
      status: 'active',
      credentialReference: null,
      configuration: {},
    });

    // Attempt conversation in Branch 1 with Channel from Branch 2
    await expect(
      service.createConversation({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        leadId: lead.id,
        channelId: channelB2.id,
        assignedEmployeeId: null,
        status: 'open',
      }),
    ).rejects.toThrow(/Channel scope violation/);
  });

  // Rule 6: Negative assignment weights are rejected
  it('6. Negative assignment weights are rejected by Zod schema', () => {
    expect(() =>
      CreateAgentSettingSchema.parse({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        isEligible: true,
        assignmentWeight: -5, // Negative
      }),
    ).toThrow();
  });

  // Rule 7: Invalid status values are rejected
  it('7. Invalid conversation status values are rejected by schema', () => {
    expect(() =>
      CreateConversationSchema.parse({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        leadId: '11111111-0001-4000-a000-000000000001',
        channelId: 'c1111111-0001-4000-8000-000000000001',
        status: 'invalid_status_xyz',
      }),
    ).toThrow();
  });

  // Rule 8: Duplicate idempotency keys do not create duplicate event records
  it('8. Duplicate idempotency keys do not create duplicate event records', async () => {
    const evt1 = await service.recordWebhookEvent({
      provider: 'meta_whatsapp',
      externalEventId: 'evt_idempotency_test_01',
      tenantId: TENANT_ALPHA,
      channelId: null,
      eventType: 'messages',
      processingStatus: 'received',
      errorCode: null,
    });

    const evt2 = await service.recordWebhookEvent({
      provider: 'meta_whatsapp',
      externalEventId: 'evt_idempotency_test_01',
      tenantId: TENANT_ALPHA,
      channelId: null,
      eventType: 'messages',
      processingStatus: 'received',
      errorCode: null,
    });

    expect(evt1.id).toBe(evt2.id);
  });

  // Rule 9: An inactive employee cannot be newly configured as eligible
  it('9. An inactive employee cannot be newly configured as eligible', async () => {
    // In CRM fixtures, Ananya Verma is inactive
    // In our MockCrmAdapter, let's test with an inactive employee
    const mockEmployee = {
      id: 'e1111111-0004-4000-8000-000000000004',
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      fullName: 'Ananya Verma',
      email: 'ananya@example.com',
      status: 'inactive' as const,
      crmRole: 'employee' as const,
      chatSupportEligible: true,
      designationId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Override crm.getEmployeeById to return inactive employee
    crm.getEmployeeById = async () => mockEmployee;

    await expect(
      service.configureAgentSetting({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        employeeId: mockEmployee.id,
        designationId: null,
        isEligible: true,
        assignmentWeight: 10,
      }),
    ).rejects.toThrow(/Eligibility violation: Employee .* is inactive/);
  });

  // Rule 10: Inactive employees cannot be assigned to new conversations
  it('10. Inactive employees cannot be assigned to new conversations', async () => {
    const lead = await repo.createLead({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      externalContactId: null,
      name: 'Charlie',
      phoneNumber: '+919800000012',
      email: null,
      source: 'whatsapp',
      metadata: {},
    });

    const channel = await repo.createChannel({
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      provider: 'meta_cloud',
      phoneNumberId: null,
      wabaId: null,
      displayName: 'Channel B1',
      status: 'active',
      credentialReference: null,
      configuration: {},
    });

    crm.getEmployeeById = async () => ({
      id: 'e1111111-0004-4000-8000-000000000004',
      tenantId: TENANT_ALPHA,
      branchId: ALPHA_BRANCH_1,
      fullName: 'Inactive Emp',
      email: 'inactive@example.com',
      status: 'inactive',
      crmRole: 'employee',
      chatSupportEligible: false,
      designationId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      service.createConversation({
        tenantId: TENANT_ALPHA,
        branchId: ALPHA_BRANCH_1,
        leadId: lead.id,
        channelId: channel.id,
        assignedEmployeeId: 'e1111111-0004-4000-8000-000000000004',
        status: 'open',
      }),
    ).rejects.toThrow(/is inactive and cannot be assigned/);
  });
});
