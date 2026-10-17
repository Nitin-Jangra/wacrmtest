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
