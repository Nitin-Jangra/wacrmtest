import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Schema & Migrations Validation Tests', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  const seedFile = path.resolve(__dirname, '../../supabase/seed.sql');

  it('should find 3 version-controlled SQL migration files', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBe(3);
    expect(files[0]).toContain('create_core_helpdesk_tables');
    expect(files[1]).toContain('add_constraints_and_indexes');
    expect(files[2]).toContain('configure_rls_and_triggers');
  });

  it('Migration 1 should define all 11 core helpdesk tables', () => {
    const migration1 = fs.readFileSync(
      path.join(migrationsDir, '20261017000001_create_core_helpdesk_tables.sql'),
      'utf-8',
    );

    const requiredTables = [
      'whatsapp_channels',
      'chat_designations',
      'chat_agent_settings',
      'chat_assignment_rules',
      'chat_assignment_state',
      'leads',
      'conversations',
      'messages',
      'follow_ups',
      'assignment_audit',
      'webhook_events',
    ];

    for (const table of requiredTables) {
      expect(migration1).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('Migration 2 should define composite keys, composite foreign keys, and indexes', () => {
    const migration2 = fs.readFileSync(
      path.join(migrationsDir, '20261017000002_add_constraints_and_indexes.sql'),
      'utf-8',
    );

    // Composite unique constraints
    expect(migration2).toContain('uq_channels_tenant_branch_id');
    expect(migration2).toContain('uq_leads_tenant_branch_id');
    expect(migration2).toContain('uq_conversations_tenant_branch_id');
    expect(migration2).toContain('uq_designations_tenant_id');
    expect(migration2).toContain('uq_agent_settings_employee_branch');
    expect(migration2).toContain('uq_assignment_state_key');
    expect(migration2).toContain('uq_webhook_provider_event');

    // Composite foreign keys enforcing cross-tenant & cross-branch integrity
    expect(migration2).toContain('fk_conversations_lead_tenant_branch');
    expect(migration2).toContain('fk_conversations_channel_tenant_branch');
    expect(migration2).toContain('fk_messages_conversation_tenant_branch');
    expect(migration2).toContain('fk_agent_settings_designation_tenant');

    // Indexes
    expect(migration2).toContain('idx_conversations_lookup');
    expect(migration2).toContain('idx_messages_conversation_timeline');
    expect(migration2).toContain('idx_leads_tenant_branch_phone');
  });

  it('Migration 3 should enable RLS on all 11 tables and attach updated_at triggers', () => {
    const migration3 = fs.readFileSync(
      path.join(migrationsDir, '20261017000003_configure_rls_and_triggers.sql'),
      'utf-8',
    );

    const requiredTables = [
      'whatsapp_channels',
      'chat_designations',
      'chat_agent_settings',
      'chat_assignment_rules',
      'chat_assignment_state',
      'leads',
      'conversations',
      'messages',
      'follow_ups',
      'assignment_audit',
      'webhook_events',
    ];

    for (const table of requiredTables) {
      expect(migration3).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }

    expect(migration3).toContain('set_updated_at_timestamp()');
    expect(migration3).toContain('prevent_audit_tampering()');
    expect(migration3).toContain('tenant_isolation_select');
  });

  it('seed.sql should be deterministic and idempotent with ON CONFLICT DO NOTHING', () => {
    expect(fs.existsSync(seedFile)).toBe(true);
    const seed = fs.readFileSync(seedFile, 'utf-8');

    expect(seed).toContain('ON CONFLICT (id) DO NOTHING;');
    expect(seed).toContain('Chat Support Executive');
    expect(seed).toContain('generate_series(1, 40)'); // 40 leads
    expect(seed).toContain('sim_phone_alpha_gn_01');
    expect(seed).toContain('wamid.sim.001');
    expect(seed).toContain('evt_meta_sim_0001');
  });
});
