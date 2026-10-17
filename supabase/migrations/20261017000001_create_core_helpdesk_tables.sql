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
