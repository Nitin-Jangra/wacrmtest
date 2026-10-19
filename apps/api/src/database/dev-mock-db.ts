import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { setSupabaseClient } from './supabase.client';
const TENANT_ALPHA_ID = '11111111-1111-4000-8000-000000000001';
const ALPHA_BRANCH_GREATER_NOIDA_ID = 'aaaaaaaa-0001-4000-8000-000000000001';
const TENANT_BETA_ID = '22222222-2222-4000-8000-000000000002';
const BETA_BRANCH_JAIPUR_ID = 'bbbbbbbb-0001-4000-8000-000000000001';

export function createInMemoryDevSupabaseClient(store: Record<string, any[]> = {}): SupabaseClient {
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
    'webhook_events',
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

export function initDevMockDb(): SupabaseClient {
  const store: Record<string, any[]> = {};

  const EMP_AARAV_ID = 'e1111111-0001-4000-8000-000000000001';
  const EMP_DIYA_ID = 'e1111111-0002-4000-8000-000000000002';
  const CHANNEL_ALPHA_ID = 'c1111111-0001-4000-8000-000000000001';
  const CHANNEL_BETA_ID = 'c2222222-0001-4000-8000-000000000002';

  // Seed WhatsApp Channels
  store['whatsapp_channels'] = [
    {
      id: CHANNEL_ALPHA_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      phone_number_id: 'dev_phone_number_alpha',
      business_account_id: 'dev_waba_alpha',
      phone_number: '+919876500001',
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: CHANNEL_BETA_ID,
      tenant_id: TENANT_BETA_ID,
      branch_id: BETA_BRANCH_JAIPUR_ID,
      phone_number_id: 'dev_phone_number_beta',
      business_account_id: 'dev_waba_beta',
      phone_number: '+919876500002',
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ];

  // Seed Agent Settings
  store['chat_agent_settings'] = [
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      employee_id: EMP_AARAV_ID,
      max_active_chats: 10,
      weight: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      employee_id: EMP_DIYA_ID,
      max_active_chats: 10,
      weight: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Seed Leads
  const LEAD_1_ID = 'l1111111-0001-4000-8000-000000000001';
  const LEAD_2_ID = 'l1111111-0002-4000-8000-000000000002';
  const LEAD_3_ID = 'l1111111-0003-4000-8000-000000000003';
  const LEAD_4_ID = 'l1111111-0004-4000-8000-000000000004';

  store['leads'] = [
    {
      id: LEAD_1_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      phone_number: '+919876543210',
      full_name: 'Rahul Verma',
      status: 'active',
      assigned_employee_id: EMP_DIYA_ID,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: LEAD_2_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      phone_number: '+919876543211',
      full_name: 'Priya Sharma',
      status: 'active',
      assigned_employee_id: EMP_AARAV_ID,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: LEAD_3_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      phone_number: '+919876543212',
      full_name: 'Vikram Patel',
      status: 'active',
      assigned_employee_id: EMP_DIYA_ID,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: LEAD_4_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      phone_number: '+919876543213',
      full_name: 'Neha Singh',
      status: 'active',
      assigned_employee_id: EMP_DIYA_ID,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  // Seed Conversations
  const CONV_1_ID = 'c0000001-0001-4000-8000-000000000001';
  const CONV_2_ID = 'c0000001-0002-4000-8000-000000000002';
  const CONV_3_ID = 'c0000001-0003-4000-8000-000000000003';
  const CONV_4_ID = 'c0000001-0004-4000-8000-000000000004';

  store['conversations'] = [
    {
      id: CONV_1_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      channel_id: CHANNEL_ALPHA_ID,
      lead_id: LEAD_1_ID,
      assigned_employee_id: EMP_DIYA_ID,
      status: 'open',
      last_message_at: new Date(Date.now() - 600000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: CONV_2_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      channel_id: CHANNEL_ALPHA_ID,
      lead_id: LEAD_2_ID,
      assigned_employee_id: EMP_AARAV_ID,
      status: 'open',
      last_message_at: new Date(Date.now() - 1200000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: CONV_3_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      channel_id: CHANNEL_ALPHA_ID,
      lead_id: LEAD_3_ID,
      assigned_employee_id: EMP_DIYA_ID,
      status: 'on_hold',
      last_message_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: CONV_4_ID,
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      channel_id: CHANNEL_ALPHA_ID,
      lead_id: LEAD_4_ID,
      assigned_employee_id: EMP_DIYA_ID,
      status: 'resolved',
      last_message_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  // Seed Messages
  store['messages'] = [
    // Messages for CONV_1
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_1_ID,
      sender_type: 'customer',
      sender_id: null,
      message_type: 'text',
      body: 'Hello! I would like to know the membership packages for gym + cardio.',
      payload: { text: 'Hello! I would like to know the membership packages for gym + cardio.' },
      delivery_status: 'read',
      direction: 'inbound',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_1_ID,
      sender_type: 'agent',
      sender_id: EMP_DIYA_ID,
      message_type: 'text',
      body: 'Hello Rahul! We have our Gold annual plan at ₹18,000 and 6-month plan at ₹11,000 including cardio and crossfit.',
      payload: { text: 'Hello Rahul! We have our Gold annual plan at ₹18,000 and 6-month plan at ₹11,000 including cardio and crossfit.' },
      delivery_status: 'read',
      direction: 'outbound',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_1_ID,
      sender_type: 'customer',
      sender_id: null,
      message_type: 'text',
      body: 'Can I get a 1-day free trial this Saturday?',
      payload: { text: 'Can I get a 1-day free trial this Saturday?' },
      delivery_status: 'delivered',
      direction: 'inbound',
      created_at: new Date(Date.now() - 600000).toISOString(),
      updated_at: new Date(Date.now() - 600000).toISOString(),
    },

    // Messages for CONV_2
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_2_ID,
      sender_type: 'customer',
      sender_id: null,
      message_type: 'text',
      body: 'Hi, are personal trainers available in the morning 6 AM - 8 AM slots?',
      payload: { text: 'Hi, are personal trainers available in the morning 6 AM - 8 AM slots?' },
      delivery_status: 'read',
      direction: 'inbound',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_2_ID,
      sender_type: 'agent',
      sender_id: EMP_AARAV_ID,
      message_type: 'text',
      body: 'Yes Priya! Coach Amit and Coach Neha are both available at 6 AM.',
      payload: { text: 'Yes Priya! Coach Amit and Coach Neha are both available at 6 AM.' },
      delivery_status: 'delivered',
      direction: 'outbound',
      created_at: new Date(Date.now() - 1200000).toISOString(),
      updated_at: new Date(Date.now() - 1200000).toISOString(),
    },

    // Messages for CONV_3
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_3_ID,
      sender_type: 'customer',
      sender_id: null,
      message_type: 'text',
      body: 'I am moving to Noida sector 62, can I transfer my membership?',
      payload: { text: 'I am moving to Noida sector 62, can I transfer my membership?' },
      delivery_status: 'read',
      direction: 'inbound',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_3_ID,
      sender_type: 'agent',
      sender_id: EMP_DIYA_ID,
      message_type: 'text',
      body: 'Holding your request while we check branch transfer policy with management.',
      payload: { text: 'Holding your request while we check branch transfer policy with management.' },
      delivery_status: 'sent',
      direction: 'outbound',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },

    // Messages for CONV_4
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_4_ID,
      sender_type: 'customer',
      sender_id: null,
      message_type: 'text',
      body: 'Thank you! The locker issue has been resolved.',
      payload: { text: 'Thank you! The locker issue has been resolved.' },
      delivery_status: 'read',
      direction: 'inbound',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  // Seed Follow-ups
  store['follow_ups'] = [
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_1_ID,
      assigned_employee_id: EMP_DIYA_ID,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'scheduled',
      note: 'Call back to confirm Saturday 1-day free trial visit.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: TENANT_ALPHA_ID,
      branch_id: ALPHA_BRANCH_GREATER_NOIDA_ID,
      conversation_id: CONV_2_ID,
      assigned_employee_id: EMP_AARAV_ID,
      scheduled_at: new Date(Date.now() + 18000000).toISOString(),
      status: 'scheduled',
      note: 'Follow up with Coach Amit slot schedule sheet.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const client = createInMemoryDevSupabaseClient(store);
  setSupabaseClient(client);
  return client;
}
