-- ==============================================================================
-- M Square Professionals WhatsApp Helpdesk — Complete Database Setup Script
-- Run this single script in Supabase SQL Editor
-- ==============================================================================

-- ==============================================================================
-- Migration 1: Create Core Helpdesk Tables
-- Version: 20261017000001
-- Description: Creates 11 helpdesk-owned domain tables for Gym WhatsApp Helpdesk
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WhatsApp Channel Registry
CREATE TABLE IF NOT EXISTS whatsapp_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'meta_cloud',
    phone_number_id VARCHAR(100),
    waba_id VARCHAR(100),
    display_name VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'disconnected')),
    credential_reference VARCHAR(255),
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenant-Specific Chat Designations
CREATE TABLE IF NOT EXISTS chat_designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Chat Agent Settings (Helpdesk-specific agent configuration)
CREATE TABLE IF NOT EXISTS chat_agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    designation_id UUID,
    is_eligible BOOLEAN NOT NULL DEFAULT true,
    assignment_weight INTEGER NOT NULL DEFAULT 10 CHECK (assignment_weight >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Chat Assignment Rules
CREATE TABLE IF NOT EXISTS chat_assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID, -- nullable for tenant-wide fallback rule
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('round_robin', 'weighted_round_robin', 'least_active', 'manual')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Persistent Chat Assignment State
CREATE TABLE IF NOT EXISTS chat_assignment_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Leads / Customer Contacts
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    external_contact_id VARCHAR(150),
    name VARCHAR(150),
    phone_number VARCHAR(50),
    email VARCHAR(150),
    source VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    channel_id UUID NOT NULL,
    assigned_employee_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'on_hold', 'resolved', 'closed')),
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- 8. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    external_message_id VARCHAR(150),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template')),
    body TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- 9. Follow-Up Reminders
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    assigned_employee_id UUID NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'overdue')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Assignment Audit Trail (Append-only)
CREATE TABLE IF NOT EXISTS assignment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    previous_employee_id UUID,
    new_employee_id UUID,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('initial_assignment', 'reassignment', 'manual_transfer', 'agent_unassigned')),
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Webhook Idempotency Events
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'meta_whatsapp',
    external_event_id VARCHAR(150) NOT NULL,
    tenant_id UUID,
    channel_id UUID,
    event_type VARCHAR(100) NOT NULL,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_code VARCHAR(100)
);


-- ==============================================================================
-- Migration 2: Add Constraints and Indexes
-- Version: 20261017000002
-- Description: Adds composite keys, relational foreign keys, check constraints,
--              and query performance indexes.
-- ==============================================================================

-- 1. Composite Unique Keys (prerequisites for composite foreign keys)
ALTER TABLE whatsapp_channels
    ADD CONSTRAINT uq_channels_tenant_branch_id UNIQUE (tenant_id, branch_id, id);

ALTER TABLE leads
    ADD CONSTRAINT uq_leads_tenant_branch_id UNIQUE (tenant_id, branch_id, id);

ALTER TABLE conversations
    ADD CONSTRAINT uq_conversations_tenant_branch_id UNIQUE (tenant_id, branch_id, id);

ALTER TABLE chat_designations
    ADD CONSTRAINT uq_designations_tenant_id UNIQUE (tenant_id, id),
    ADD CONSTRAINT uq_designations_tenant_name UNIQUE (tenant_id, name);

ALTER TABLE chat_agent_settings
    ADD CONSTRAINT uq_agent_settings_employee_branch UNIQUE (tenant_id, branch_id, employee_id);

ALTER TABLE chat_assignment_state
    ADD CONSTRAINT uq_assignment_state_key UNIQUE (tenant_id, branch_id, strategy);

ALTER TABLE webhook_events
    ADD CONSTRAINT uq_webhook_provider_event UNIQUE (provider, external_event_id);

-- 2. Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_channel_provider_phone
    ON whatsapp_channels (provider, phone_number_id)
    WHERE phone_number_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_messages_tenant_external_id
    ON messages (tenant_id, external_message_id)
    WHERE external_message_id IS NOT NULL;

-- 3. Composite Foreign Keys (Cross-Tenant & Cross-Branch Integrity Enforcers)

-- Enforce that an agent's designation belongs to the exact same tenant
ALTER TABLE chat_agent_settings
    ADD CONSTRAINT fk_agent_settings_designation_tenant
    FOREIGN KEY (tenant_id, designation_id)
    REFERENCES chat_designations (tenant_id, id)
    ON DELETE SET NULL;

-- Enforce that a conversation's lead belongs to the exact same tenant and branch
ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_lead_tenant_branch
    FOREIGN KEY (tenant_id, branch_id, lead_id)
    REFERENCES leads (tenant_id, branch_id, id)
    ON DELETE CASCADE;

-- Enforce that a conversation's channel belongs to the exact same tenant and branch
ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_channel_tenant_branch
    FOREIGN KEY (tenant_id, branch_id, channel_id)
    REFERENCES whatsapp_channels (tenant_id, branch_id, id)
    ON DELETE CASCADE;

-- Enforce that messages belong to a conversation in the same tenant and branch
ALTER TABLE messages
    ADD CONSTRAINT fk_messages_conversation_tenant_branch
    FOREIGN KEY (tenant_id, branch_id, conversation_id)
    REFERENCES conversations (tenant_id, branch_id, id)
    ON DELETE CASCADE;

-- Enforce that follow-ups belong to a conversation in the same tenant and branch
ALTER TABLE follow_ups
    ADD CONSTRAINT fk_follow_ups_conversation_tenant_branch
    FOREIGN KEY (tenant_id, branch_id, conversation_id)
    REFERENCES conversations (tenant_id, branch_id, id)
    ON DELETE CASCADE;

-- Enforce that assignment audits belong to a conversation in the same tenant and branch
ALTER TABLE assignment_audit
    ADD CONSTRAINT fk_assignment_audit_conversation_tenant_branch
    FOREIGN KEY (tenant_id, branch_id, conversation_id)
    REFERENCES conversations (tenant_id, branch_id, id)
    ON DELETE CASCADE;

-- 4. High-Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_lookup
    ON conversations (tenant_id, branch_id, status, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_timeline
    ON messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_branch_phone
    ON leads (tenant_id, branch_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_leads_external_contact
    ON leads (tenant_id, external_contact_id)
    WHERE external_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_settings_eligibility
    ON chat_agent_settings (tenant_id, branch_id, is_eligible)
    WHERE is_eligible = true;

CREATE INDEX IF NOT EXISTS idx_follow_ups_queue
    ON follow_ups (tenant_id, branch_id, status, scheduled_at ASC)
    WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_audit_conversation
    ON assignment_audit (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_status
    ON webhook_events (processing_status, received_at ASC);


-- ==============================================================================
-- Migration 3: Configure Row Level Security (RLS) and Triggers
-- Version: 20261017000003
-- Description: Enables RLS on all tables, defines tenant-scoped policies,
--              and configures updated_at timestamp management triggers.
-- ==============================================================================

-- 1. Automated updated_at Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to tables with updated_at column
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'whatsapp_channels',
            'chat_designations',
            'chat_agent_settings',
            'chat_assignment_rules',
            'chat_assignment_state',
            'leads',
            'conversations',
            'follow_ups'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
            CREATE TRIGGER trg_set_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION set_updated_at_timestamp();
        ', tbl, tbl);
    END LOOP;
END;
$$;

-- 2. Prevent Mutation or Deletion on Append-Only Audit Trail
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_audit ON assignment_audit;
CREATE TRIGGER trg_protect_audit
    BEFORE UPDATE OR DELETE ON assignment_audit
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_tampering();

-- 3. Enable Row Level Security (RLS) on all 11 tables
ALTER TABLE whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_assignment_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies

-- Helper function to extract tenant_id from current session JWT
CREATE OR REPLACE FUNCTION current_session_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if caller is super_admin in JWT
CREATE OR REPLACE FUNCTION is_session_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN coalesce(current_setting('request.jwt.claim.role', true) = 'super_admin', false);
EXCEPTION
    WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Service Role Full Access Policies (Server-side operations with service_role key)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
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
            'webhook_events'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS service_role_all ON %I;
            CREATE POLICY service_role_all ON %I
                FOR ALL
                TO service_role
                USING (true)
                WITH CHECK (true);
        ', tbl, tbl);
    END LOOP;
END;
$$;

-- Tenant-Scoped Policies for Authenticated End-User JWTs
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'whatsapp_channels',
            'chat_designations',
            'chat_agent_settings',
            'chat_assignment_rules',
            'chat_assignment_state',
            'leads',
            'conversations',
            'messages',
            'follow_ups',
            'assignment_audit'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS tenant_isolation_select ON %I;
            CREATE POLICY tenant_isolation_select ON %I
                FOR SELECT
                TO authenticated
                USING (
                    is_session_super_admin() OR
                    tenant_id = current_session_tenant_id()
                );

            DROP POLICY IF EXISTS tenant_isolation_insert ON %I;
            CREATE POLICY tenant_isolation_insert ON %I
                FOR INSERT
                TO authenticated
                WITH CHECK (
                    is_session_super_admin() OR
                    tenant_id = current_session_tenant_id()
                );

            DROP POLICY IF EXISTS tenant_isolation_update ON %I;
            CREATE POLICY tenant_isolation_update ON %I
                FOR UPDATE
                TO authenticated
                USING (
                    is_session_super_admin() OR
                    tenant_id = current_session_tenant_id()
                )
                WITH CHECK (
                    is_session_super_admin() OR
                    tenant_id = current_session_tenant_id()
                );
        ', tbl, tbl, tbl);
    END LOOP;
END;
$$;


-- ==============================================================================
-- Supabase Deterministic Staging Seed Script
-- Gym WhatsApp Helpdesk Foundation
-- Idempotent: Can be executed multiple times without duplicates or errors.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Chat Designations
-- ------------------------------------------------------------------------------
INSERT INTO chat_designations (id, tenant_id, name, description, is_active, created_at, updated_at)
VALUES
    -- Tenant Alpha Designations
    ('d1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'Chat Support Executive', 'Frontline chat handling for inquiries and memberships', true, now(), now()),
    ('d1111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'Senior Chat Executive', 'Escalations and complex customer support handling', true, now(), now()),
    ('d1111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'Chat Support Manager', 'Team lead and queue supervisor (inactive)', false, now(), now()),

    -- Tenant Beta Designations
    ('d2222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'Customer Care Agent', 'Primary customer support and live query resolution', true, now(), now()),
    ('d2222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'Sales Support Executive', 'Inbound trial booking and sales chat management', true, now(), now()),
    ('d2222222-0003-4000-8000-000000000003', '22222222-2222-4000-8000-000000000002', 'Customer Success Manager', 'Retention and VIP member relationship management', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. WhatsApp Channel Registry (Simulated Test Channels)
-- ------------------------------------------------------------------------------
INSERT INTO whatsapp_channels (id, tenant_id, branch_id, provider, phone_number_id, waba_id, display_name, status, credential_reference, configuration, created_at, updated_at)
VALUES
    -- Tenant Alpha Channels
    ('c1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'meta_cloud', 'sim_phone_alpha_gn_01', 'sim_waba_alpha_01', 'Alpha — Greater Noida Support', 'active', 'env:SIM_CRED_ALPHA_GN', '{"simulated": true, "environment": "staging"}'::jsonb, now(), now()),
    ('c1111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'meta_cloud', 'sim_phone_alpha_nd_02', 'sim_waba_alpha_01', 'Alpha — Noida Support', 'active', 'env:SIM_CRED_ALPHA_ND', '{"simulated": true, "environment": "staging"}'::jsonb, now(), now()),

    -- Tenant Beta Channels
    ('c2222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'meta_cloud', 'sim_phone_beta_jp_01', 'sim_waba_beta_01', 'Beta — Jaipur Care Line', 'active', 'env:SIM_CRED_BETA_JP', '{"simulated": true, "environment": "staging"}'::jsonb, now(), now()),
    ('c2222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'meta_cloud', 'sim_phone_beta_gg_02', 'sim_waba_beta_01', 'Beta — Gurugram Care Line', 'active', 'env:SIM_CRED_BETA_GG', '{"simulated": true, "environment": "staging"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Chat Agent Settings (References Mock CRM Employees)
-- ------------------------------------------------------------------------------
INSERT INTO chat_agent_settings (id, tenant_id, branch_id, employee_id, designation_id, is_eligible, assignment_weight, created_at, updated_at)
VALUES
    -- Alpha Greater Noida Agents
    ('s1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', 'd1111111-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('s1111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0002-4000-8000-000000000002', 'd1111111-0001-4000-8000-000000000001', true, 10, now(), now()),
    ('s1111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0003-4000-8000-000000000003', null, false, 0, now(), now()),
    ('s1111111-0004-4000-8000-000000000004', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0004-4000-8000-000000000004', 'd1111111-0001-4000-8000-000000000001', false, 0, now(), now()),

    -- Alpha Noida Agents
    ('s1111111-0005-4000-8000-000000000005', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'e1111111-0006-4000-8000-000000000006', 'd1111111-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('s1111111-0006-4000-8000-000000000006', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'e1111111-0007-4000-8000-000000000007', 'd1111111-0001-4000-8000-000000000001', true, 10, now(), now()),

    -- Beta Jaipur Agents
    ('s2222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'e2222222-0002-4000-8000-000000000002', 'd2222222-0003-4000-8000-000000000003', true, 15, now(), now()),
    ('s2222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'e2222222-0003-4000-8000-000000000003', 'd2222222-0001-4000-8000-000000000001', true, 10, now(), now()),

    -- Beta Gurugram Agents
    ('s2222222-0003-4000-8000-000000000003', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'e2222222-0005-4000-8000-000000000005', 'd2222222-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('s2222222-0004-4000-8000-000000000004', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'e2222222-0006-4000-8000-000000000006', 'd2222222-0001-4000-8000-000000000001', true, 10, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Assignment Rules & State
-- ------------------------------------------------------------------------------
INSERT INTO chat_assignment_rules (id, tenant_id, branch_id, strategy, is_enabled, configuration, created_at, updated_at)
VALUES
    ('r1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'weighted_round_robin', true, '{"max_concurrency_per_agent": 5}'::jsonb, now(), now()),
    ('r1111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'weighted_round_robin', true, '{"max_concurrency_per_agent": 5}'::jsonb, now(), now()),
    ('r2222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'round_robin', true, '{"max_concurrency_per_agent": 4}'::jsonb, now(), now()),
    ('r2222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'round_robin', true, '{"max_concurrency_per_agent": 4}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_assignment_state (id, tenant_id, branch_id, strategy, state, updated_at)
VALUES
    ('st111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'weighted_round_robin', '{"last_assigned_index": 0, "current_weight_counter": 15}'::jsonb, now()),
    ('st111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'weighted_round_robin', '{"last_assigned_index": 0, "current_weight_counter": 15}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. 40 Deterministic Fictional Leads (20 per Tenant: 10 per Branch)
-- ------------------------------------------------------------------------------
INSERT INTO leads (id, tenant_id, branch_id, external_contact_id, name, phone_number, email, source, metadata, created_at, updated_at)
SELECT
    -- Deterministic UUID pattern: l<tenant><branch>-00<seq>
    (CASE 
        WHEN s.idx <= 10 THEN format('11111111-0001-4000-a000-%012d', s.idx)::uuid
        WHEN s.idx <= 20 THEN format('11111111-0002-4000-a000-%012d', s.idx)::uuid
        WHEN s.idx <= 30 THEN format('22222222-0001-4000-a000-%012d', s.idx)::uuid
        ELSE format('22222222-0002-4000-a000-%012d', s.idx)::uuid
    END),
    (CASE WHEN s.idx <= 20 THEN '11111111-1111-4000-8000-000000000001'::uuid ELSE '22222222-2222-4000-8000-000000000002'::uuid END),
    (CASE 
        WHEN s.idx <= 10 THEN 'aaaaaaaa-0001-4000-8000-000000000001'::uuid
        WHEN s.idx <= 20 THEN 'aaaaaaaa-0002-4000-8000-000000000002'::uuid
        WHEN s.idx <= 30 THEN 'bbbbbbbb-0001-4000-8000-000000000001'::uuid
        ELSE 'bbbbbbbb-0002-4000-8000-000000000002'::uuid
    END),
    format('crm_lead_ref_%03d', s.idx),
    format('Fictional Member %02d', s.idx),
    format('+91980000%04d', s.idx),
    format('lead%02d@example.com', s.idx),
    'whatsapp',
    '{"simulated": true, "fitness_goal": "weight_training"}'::jsonb,
    now() - (s.idx || ' hours')::interval,
    now() - (s.idx || ' hours')::interval
FROM generate_series(1, 40) AS s(idx)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. Sample Conversations
-- ------------------------------------------------------------------------------
INSERT INTO conversations (id, tenant_id, branch_id, lead_id, channel_id, assigned_employee_id, status, last_message_at, created_at, updated_at)
VALUES
    -- Conv 1: Alpha Greater Noida (Open, assigned to Aarav Sharma)
    ('cv111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', '11111111-0001-4000-a000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', 'open', now() - interval '10 minutes', now() - interval '2 hours', now()),
    -- Conv 2: Alpha Greater Noida (On Hold, assigned to Diya Patel)
    ('cv111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', '11111111-0002-4000-a000-000000000002', 'c1111111-0001-4000-8000-000000000001', 'e1111111-0002-4000-8000-000000000002', 'on_hold', now() - interval '30 minutes', now() - interval '4 hours', now()),
    -- Conv 3: Alpha Noida (Resolved, assigned to Sneha Rao)
    ('cv111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', '11111111-0002-4000-a000-000000000011', 'c1111111-0002-4000-8000-000000000002', 'e1111111-0006-4000-8000-000000000006', 'resolved', now() - interval '1 day', now() - interval '2 days', now()),
    -- Conv 4: Beta Jaipur (Closed, assigned to Meera Joshi)
    ('cv222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', '22222222-0001-4000-a000-000000000021', 'c2222222-0001-4000-8000-000000000001', 'e2222222-0002-4000-8000-000000000002', 'closed', now() - interval '3 days', now() - interval '5 days', now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. Messages
-- ------------------------------------------------------------------------------
INSERT INTO messages (id, tenant_id, branch_id, conversation_id, external_message_id, direction, message_type, body, delivery_status, created_at, sent_at, delivered_at, read_at)
VALUES
    ('m1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'cv111111-0001-4000-8000-000000000001', 'wamid.sim.001', 'inbound', 'text', 'Hi, I would like to know the membership packages at Greater Noida branch.', 'read', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours'),
    ('m1111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'cv111111-0001-4000-8000-000000000001', 'wamid.sim.002', 'outbound', 'text', 'Hello! Thank you for reaching out. We offer Annual Platinum and Quarterly Gold plans. Would you like a trial session?', 'read', now() - interval '1 hour 50 minutes', now() - interval '1 hour 50 minutes', now() - interval '1 hour 50 minutes', now() - interval '1 hour 45 minutes'),
    ('m1111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'cv111111-0001-4000-8000-000000000001', 'wamid.sim.003', 'inbound', 'text', 'Yes please! Can I visit tomorrow morning around 10 AM?', 'delivered', now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '10 minutes', null)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. Scheduled Follow-Ups
-- ------------------------------------------------------------------------------
INSERT INTO follow_ups (id, tenant_id, branch_id, conversation_id, assigned_employee_id, scheduled_at, status, note, created_at, updated_at)
VALUES
    ('f1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'cv111111-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', now() + interval '1 day', 'scheduled', 'Follow up on tomorrow trial attendance at 10 AM', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Assignment Audit Records
-- ------------------------------------------------------------------------------
INSERT INTO assignment_audit (id, tenant_id, branch_id, conversation_id, previous_employee_id, new_employee_id, event_type, reason, metadata, created_at)
VALUES
    ('a1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'cv111111-0001-4000-8000-000000000001', null, 'e1111111-0001-4000-8000-000000000001', 'initial_assignment', 'Simulated test assignment event', '{"strategy": "weighted_round_robin"}'::jsonb, now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. Webhook Idempotency Event Test Records
-- ------------------------------------------------------------------------------
INSERT INTO webhook_events (id, provider, external_event_id, tenant_id, channel_id, event_type, processing_status, received_at, processed_at, error_code)
VALUES
    ('w1111111-0001-4000-8000-000000000001', 'meta_whatsapp', 'evt_meta_sim_0001', '11111111-1111-4000-8000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'messages', 'completed', now() - interval '2 hours', now() - interval '2 hours', null),
    ('w1111111-0002-4000-8000-000000000002', 'meta_whatsapp', 'evt_meta_sim_0002', '11111111-1111-4000-8000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'message_status', 'completed', now() - interval '1 hour', now() - interval '1 hour', null)
ON CONFLICT (id) DO NOTHING;
