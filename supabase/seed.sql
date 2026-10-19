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
    ('51111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', 'd1111111-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('51111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0002-4000-8000-000000000002', 'd1111111-0001-4000-8000-000000000001', true, 10, now(), now()),
    ('51111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0003-4000-8000-000000000003', null, false, 0, now(), now()),
    ('51111111-0004-4000-8000-000000000004', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'e1111111-0004-4000-8000-000000000004', 'd1111111-0001-4000-8000-000000000001', false, 0, now(), now()),

    -- Alpha Noida Agents
    ('51111111-0005-4000-8000-000000000005', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'e1111111-0006-4000-8000-000000000006', 'd1111111-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('51111111-0006-4000-8000-000000000006', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'e1111111-0007-4000-8000-000000000007', 'd1111111-0001-4000-8000-000000000001', true, 10, now(), now()),

    -- Beta Jaipur Agents
    ('52222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'e2222222-0002-4000-8000-000000000002', 'd2222222-0003-4000-8000-000000000003', true, 15, now(), now()),
    ('52222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'e2222222-0003-4000-8000-000000000003', 'd2222222-0001-4000-8000-000000000001', true, 10, now(), now()),

    -- Beta Gurugram Agents
    ('52222222-0003-4000-8000-000000000003', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'e2222222-0005-4000-8000-000000000005', 'd2222222-0002-4000-8000-000000000002', true, 15, now(), now()),
    ('52222222-0004-4000-8000-000000000004', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'e2222222-0006-4000-8000-000000000006', 'd2222222-0001-4000-8000-000000000001', true, 10, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Assignment Rules & State
-- ------------------------------------------------------------------------------
INSERT INTO chat_assignment_rules (id, tenant_id, branch_id, strategy, is_enabled, configuration, created_at, updated_at)
VALUES
    ('41111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'weighted_round_robin', true, '{"max_concurrency_per_agent": 5}'::jsonb, now(), now()),
    ('41111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'weighted_round_robin', true, '{"max_concurrency_per_agent": 5}'::jsonb, now(), now()),
    ('42222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', 'round_robin', true, '{"max_concurrency_per_agent": 4}'::jsonb, now(), now()),
    ('42222222-0002-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0002-4000-8000-000000000002', 'round_robin', true, '{"max_concurrency_per_agent": 4}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_assignment_state (id, tenant_id, branch_id, strategy, state, updated_at)
VALUES
    ('50111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'weighted_round_robin', '{"last_assigned_index": 0, "current_weight_counter": 15}'::jsonb, now()),
    ('50111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', 'weighted_round_robin', '{"last_assigned_index": 0, "current_weight_counter": 15}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. 40 Deterministic Fictional Leads (20 per Tenant: 10 per Branch)
-- ------------------------------------------------------------------------------
INSERT INTO leads (id, tenant_id, branch_id, external_contact_id, name, phone_number, email, source, metadata, created_at, updated_at)
SELECT
    -- Deterministic UUID pattern: l<tenant><branch>-00<seq>
    (CASE 
        WHEN s.idx <= 10 THEN ('11111111-0001-4000-a000-' || lpad(s.idx::text, 12, '0'))::uuid
        WHEN s.idx <= 20 THEN ('11111111-0002-4000-a000-' || lpad(s.idx::text, 12, '0'))::uuid
        WHEN s.idx <= 30 THEN ('22222222-0001-4000-a000-' || lpad(s.idx::text, 12, '0'))::uuid
        ELSE ('22222222-0002-4000-a000-' || lpad(s.idx::text, 12, '0'))::uuid
    END),
    (CASE WHEN s.idx <= 20 THEN '11111111-1111-4000-8000-000000000001'::uuid ELSE '22222222-2222-4000-8000-000000000002'::uuid END),
    (CASE 
        WHEN s.idx <= 10 THEN 'aaaaaaaa-0001-4000-8000-000000000001'::uuid
        WHEN s.idx <= 20 THEN 'aaaaaaaa-0002-4000-8000-000000000002'::uuid
        WHEN s.idx <= 30 THEN 'bbbbbbbb-0001-4000-8000-000000000001'::uuid
        ELSE 'bbbbbbbb-0002-4000-8000-000000000002'::uuid
    END),
    ('crm_lead_ref_' || lpad(s.idx::text, 3, '0')),
    ('Fictional Member ' || lpad(s.idx::text, 2, '0')),
    ('+91980000' || lpad(s.idx::text, 4, '0')),
    ('lead' || lpad(s.idx::text, 2, '0') || '@example.com'),
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
    ('c0111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', '11111111-0001-4000-a000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', 'open', now() - interval '10 minutes', now() - interval '2 hours', now()),
    -- Conv 2: Alpha Greater Noida (On Hold, assigned to Diya Patel)
    ('c0111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', '11111111-0001-4000-a000-000000000002', 'c1111111-0001-4000-8000-000000000001', 'e1111111-0002-4000-8000-000000000002', 'on_hold', now() - interval '30 minutes', now() - interval '4 hours', now()),
    -- Conv 3: Alpha Noida (Resolved, assigned to Sneha Rao)
    ('c0111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0002-4000-8000-000000000002', '11111111-0002-4000-a000-000000000011', 'c1111111-0002-4000-8000-000000000002', 'e1111111-0006-4000-8000-000000000006', 'resolved', now() - interval '1 day', now() - interval '2 days', now()),
    -- Conv 4: Beta Jaipur (Closed, assigned to Meera Joshi)
    ('c0222222-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002', 'bbbbbbbb-0001-4000-8000-000000000001', '22222222-0001-4000-a000-000000000021', 'c2222222-0001-4000-8000-000000000001', 'e2222222-0002-4000-8000-000000000002', 'closed', now() - interval '3 days', now() - interval '5 days', now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. Messages
-- ------------------------------------------------------------------------------
INSERT INTO messages (id, tenant_id, branch_id, conversation_id, external_message_id, direction, message_type, body, delivery_status, created_at, sent_at, delivered_at, read_at)
VALUES
    ('e0111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'c0111111-0001-4000-8000-000000000001', 'wamid.sim.001', 'inbound', 'text', 'Hi, I would like to know the membership packages at Greater Noida branch.', 'read', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours'),
    ('e0111111-0002-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'c0111111-0001-4000-8000-000000000001', 'wamid.sim.002', 'outbound', 'text', 'Hello! Thank you for reaching out. We offer Annual Platinum and Quarterly Gold plans. Would you like a trial session?', 'read', now() - interval '1 hour 50 minutes', now() - interval '1 hour 50 minutes', now() - interval '1 hour 50 minutes', now() - interval '1 hour 45 minutes'),
    ('e0111111-0003-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'c0111111-0001-4000-8000-000000000001', 'wamid.sim.003', 'inbound', 'text', 'Yes please! Can I visit tomorrow morning around 10 AM?', 'delivered', now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '10 minutes', null)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. Scheduled Follow-Ups
-- ------------------------------------------------------------------------------
INSERT INTO follow_ups (id, tenant_id, branch_id, conversation_id, assigned_employee_id, scheduled_at, status, note, created_at, updated_at)
VALUES
    ('f1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'c0111111-0001-4000-8000-000000000001', 'e1111111-0001-4000-8000-000000000001', now() + interval '1 day', 'scheduled', 'Follow up on tomorrow trial attendance at 10 AM', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Assignment Audit Records
-- ------------------------------------------------------------------------------
INSERT INTO assignment_audit (id, tenant_id, branch_id, conversation_id, previous_employee_id, new_employee_id, event_type, reason, metadata, created_at)
VALUES
    ('a1111111-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'c0111111-0001-4000-8000-000000000001', null, 'e1111111-0001-4000-8000-000000000001', 'initial_assignment', 'Simulated test assignment event', '{"strategy": "weighted_round_robin"}'::jsonb, now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. Webhook Idempotency Event Test Records
-- ------------------------------------------------------------------------------
INSERT INTO webhook_events (id, provider, external_event_id, tenant_id, channel_id, event_type, processing_status, received_at, processed_at, error_code)
VALUES
    ('00111111-0001-4000-8000-000000000001', 'meta_whatsapp', 'evt_meta_sim_0001', '11111111-1111-4000-8000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'messages', 'completed', now() - interval '2 hours', now() - interval '2 hours', null),
    ('00111111-0002-4000-8000-000000000002', 'meta_whatsapp', 'evt_meta_sim_0002', '11111111-1111-4000-8000-000000000001', 'c1111111-0001-4000-8000-000000000001', 'message_status', 'completed', now() - interval '1 hour', now() - interval '1 hour', null)
ON CONFLICT (id) DO NOTHING;
