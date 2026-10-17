---
milestone: "Milestone 2 — Supabase Staging Database & Persistent Helpdesk Foundation"
version: 2.0.0
updated: 2026-10-17T12:25:00+05:30
---

# Roadmap: Milestone 2 — Supabase Staging Database & Persistent Helpdesk Foundation

> **Current Phase:** Complete (Milestone 2 Verified & Audited)
> **Status:** verified

## Virtual Engineering Team
- **Dev 1: Alex (Database Architect & Schema Specialist)**: Supabase CLI configuration, PostgreSQL DDL migrations, composite constraints, indexes, RLS policies.
- **Dev 2: Maya (Data Engineer & Seeding Specialist)**: Deterministic `seed.sql`, 40 leads, channels, designations, agent settings, conversations, messages, audit, idempotent upserts.
- **Dev 3: Zara (Data Access Layer Specialist)**: Supabase client integration (`@supabase/supabase-js`), fail-fast client config, shared types and Zod schemas in `packages/shared-types`.
- **Dev 4: Ethan (Repository & CRM Validation Specialist)**: Helpdesk repositories in `apps/api/src/repositories/`, service layer cross-validating with `ICrmAdapter`.
- **Dev 5: Liam (Helpdesk REST API Developer)**: Express REST routes in `apps/api/src/modules/` for channels, leads, conversations, messages, follow-ups, and audit.
- **Dev 6: Sophia (QA, Security & Audit Specialist)**: Comprehensive test suites: migration validation, repository unit tests, relational integrity tests, and multi-tenant isolation tests.
- **Dev 7: Marcus (Technical Documentation & Release Lead)**: `docs/database-design.md`, root `README.md`, `.env.example`, build, lint, and clean-checkout verification.

---

## Must-Haves (from Phase 2 SPEC)
- [x] Version-controlled Supabase migrations for all 11 required tables
- [x] Composite constraints, check constraints, and performance indexes
- [x] Row Level Security (RLS) policies on all helpdesk tables
- [x] Deterministic, idempotent `seed.sql` populating realistic fictional data
- [x] Supabase client configuration with fail-fast validation
- [x] Shared domain interfaces and Zod validation schemas
- [x] Helpdesk repositories with CRM cross-validation before write
- [x] Express API endpoints for channels, agent settings, leads, conversations, messages, follow-ups, and audit
- [x] Automated tests: migration syntax, repository CRUD, integrity rules, tenant isolation, and fail-closed checks
- [x] Complete database documentation in `docs/database-design.md` and updated `README.md`

---

## Phases & Task Breakdown

### Phase 2.1: Database Schema & Versioned Migrations (Dev 1: Alex)
**Status:** ✅ Complete
**Objective:** Define the complete PostgreSQL schema in modular migrations with constraints, indexes, and RLS.
- [x] Task 2.1.1: Configure `supabase/config.toml`.
- [x] Task 2.1.2: Create migration `20261017000001_create_core_helpdesk_tables.sql` defining 11 tables.
- [x] Task 2.1.3: Create migration `20261017000002_add_constraints_and_indexes.sql` adding composite keys, indexes, and checks.
- [x] Task 2.1.4: Create migration `20261017000003_configure_rls_and_triggers.sql` enabling RLS and updated_at triggers.

### Phase 2.2: Deterministic Staging Seed Engine (Dev 2: Maya)
**Status:** ✅ Complete
**Objective:** Build deterministic, idempotent `supabase/seed.sql` populating full staging dataset.
- [x] Task 2.2.1: Seed 4 simulated WhatsApp channels referencing CRM tenants and branches.
- [x] Task 2.2.2: Seed 6 tenant-specific chat designations and chat agent settings.
- [x] Task 2.2.3: Seed assignment rules and assignment state keys.
- [x] Task 2.2.4: Seed 40 fictional leads (20 per tenant), conversations, messages, follow-ups, audit logs, and idempotency events.

### Phase 2.3: Shared Contracts & Supabase Client Layer (Dev 3: Zara)
**Status:** ✅ Complete
**Objective:** Install `@supabase/supabase-js`, expand `@gym-helpdesk/shared-types`, and configure client.
- [x] Task 2.3.1: Add `@supabase/supabase-js` to `apps/api`.
- [x] Task 2.3.2: Expand `packages/shared-types` with database entity types, insert schemas, and query filters.
- [x] Task 2.3.3: Implement `apps/api/src/database/supabase.client.ts` with fail-fast initialization and health check.

### Phase 2.4: Helpdesk Repositories & CRM Validation Layer (Dev 4: Ethan)
**Status:** ✅ Complete
**Objective:** Implement database repository and service layer enforcing relational and business constraints.
- [x] Task 2.4.1: Implement `apps/api/src/repositories/helpdesk.repository.ts` for all entities.
- [x] Task 2.4.2: Implement `apps/api/src/services/helpdesk.service.ts` cross-validating tenant/branch/employee relationships with `ICrmAdapter`.
- [x] Task 2.4.3: Implement fail-closed database errors (`DatabaseConfigurationError`, `DatabaseConstraintError`, `DatabaseNotFoundError`).

### Phase 2.5: Helpdesk API Endpoints (Dev 5: Liam)
**Status:** ✅ Complete
**Objective:** Build Express routers for helpdesk entities with input validation and error handling.
- [x] Task 2.5.1: Implement channels route (`/api/v1/channels`).
- [x] Task 2.5.2: Implement agent-settings route (`/api/v1/agent-settings`).
- [x] Task 2.5.3: Implement leads route (`/api/v1/leads`).
- [x] Task 2.5.4: Implement conversations and messages routes (`/api/v1/conversations`).
- [x] Task 2.5.5: Implement follow-ups route (`/api/v1/follow-ups`).
- [x] Task 2.5.6: Implement webhook-events route (`/api/v1/webhook-events`).
- [x] Task 2.5.7: Update `/health` endpoint to report database connectivity status.

### Phase 2.6: Verification & Multi-Tenant Security Auditing (Dev 6: Sophia)
**Status:** ✅ Complete
**Objective:** Comprehensive test suites covering schema syntax, repositories, fail-closed handling, integrity rules, and tenant isolation.
- [x] Task 2.6.1: Create `tests/unit/database-schema.test.ts` (11 tables, constraints, indexes, RLS, idempotent seed).
- [x] Task 2.6.2: Create `tests/unit/database-failclose.test.ts` (fail-closed check on missing credentials).
- [x] Task 2.6.3: Create `tests/unit/helpdesk-repositories.test.ts` (CRUD and query filtering).
- [x] Task 2.6.4: Create `tests/integration/helpdesk-integrity.test.ts` (10 integrity rules from Section 12.C).
- [x] Task 2.6.5: Create `tests/security/helpdesk-tenant-isolation.test.ts` (cross-tenant rejection and query isolation).

### Phase 2.7: Documentation, Runbooks & Quality Verification (Dev 7: Marcus)
**Status:** ✅ Complete
**Objective:** Finalize documentation, update environment variables, run clean typecheck, lint, and tests.
- [x] Task 2.7.1: Write `docs/database-design.md` with schema overview, ERD, indexes, RLS policies, and runbook.
- [x] Task 2.7.2: Update `.env.example`, `.env`, and `README.md`.
- [x] Task 2.7.3: Full monorepo verification: `npm run typecheck`, `npm test` (102 passing tests).
