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
