# SPEC.md — Project Specification: Gym WhatsApp Helpdesk (Phase 2: Supabase Staging Persistence)

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: Phase 2 Spec is finalized and verified against project requirements.

---

## Vision
Build the second milestone of the Gym WhatsApp Helpdesk: establishing the PostgreSQL persistence foundation on Supabase. This persistent staging database stores all helpdesk-owned data (WhatsApp channel registry, tenant-specific chat designations, chat agent settings, assignment rules & state, leads, conversations, messages, follow-ups, assignment audit, and webhook idempotency events) while strictly honoring the external CRM as the immutable source of truth for tenants, branches, employees, roles, and permissions. All helpdesk database operations enforce multi-tenant isolation, composite constraints, and relational validation via the CRM adapter.

---

## Virtual Development Team Structure (Phase 2)
The engineering work is divided across a specialized virtual team:

1. **Dev 1: Alex (Database Architect & Schema Specialist)**
   - Supabase CLI project configuration (`supabase/config.toml`)
   - Version-controlled SQL migrations (`supabase/migrations/`)
   - Composite foreign keys, check constraints, indexes, and Row Level Security (RLS) policies

2. **Dev 2: Maya (Data Engineer & Seeding Specialist)**
   - Deterministic seed dataset (`supabase/seed.sql`)
   - 4 simulated WhatsApp channels, 6+ designations, agent settings, 40 leads (20 per tenant), conversations, messages, follow-ups, audit, and idempotency test records
   - Repeatable upsert / idempotent seeding scripts

3. **Dev 3: Zara (Data Access Layer & Supabase Client Specialist)**
   - Supabase client integration (`@supabase/supabase-js`)
   - Database client configuration with fail-fast validation when Supabase is missing/unreachable
   - Domain TypeScript interfaces and Zod schemas in `packages/shared-types`

4. **Dev 4: Ethan (Repository & CRM Validation Specialist)**
   - Helpdesk repository layer in `apps/api/src/repositories/`
   - Business service layer validating tenant/branch/employee references against `ICrmAdapter` before database persistence
   - Safe transaction and atomic operation handling

5. **Dev 5: Liam (Helpdesk REST API Developer)**
   - REST API modules in `apps/api/src/modules/` for channels, designations, agent settings, leads, conversations, messages, follow-ups, audit, and idempotency checks
   - Multi-tenant request authorization and parameter validation

6. **Dev 6: Sophia (QA, Security & Audit Specialist)**
   - Vitest test suites:
     - Migration & DDL schema constraint verification
     - Repository unit tests
     - Helpdesk cross-tenant & cross-branch integrity tests
     - Multi-tenant data isolation and RLS verification
     - Database fail-closed / fail-fast verification

7. **Dev 7: Marcus (Technical Documentation & Release Lead)**
   - Comprehensive `docs/database-design.md` detailing architecture, schema, indexes, RLS, and staging setup
   - Updated root `README.md` and `.env.example`
   - End-to-end verification of build, lint, typecheck, and test commands

---

## Goals
1. **Supabase Staging Database**: 11 helpdesk-owned tables with versioned migrations in `supabase/migrations/`.
2. **Relational Integrity & Indexes**: Composite constraints ensuring channel/lead/conversation branch and tenant alignment; non-negative weights; explicit enum checks.
3. **Deterministic Staging Seed**: Repeatable seed script populating 40 leads, simulated channels, agent settings, conversations, messages, follow-ups, and audit entries.
4. **CRM-Aware Persistence Layer**: Helpdesk API validates tenant/branch/employee relationships through the `ICrmAdapter` before writing.
5. **Multi-Tenant Security & Isolation**: Tenant Alpha cannot query or manipulate Tenant Beta conversations or channels; RLS enabled on all exposed tables.
6. **100% Automated Testing**: Unit, repository, integration, integrity, and security test coverage in Vitest.

---

## Non-Goals (Out of Scope for Phase 2)
- Live WhatsApp Cloud API or Meta webhook network integration.
- Sending or receiving real WhatsApp messages or voice calls.
- Weighted lead distribution execution engine (tables and state exist, but automated distribution is Phase 3).
- React Agent Inbox frontend UI.
- Local duplicate employee master data system.

---

## Constraints
- **Database**: Supabase PostgreSQL with version-controlled migrations.
- **Language & Runtime**: Node.js >= 18, TypeScript strict mode, Express.js.
- **CRM Source of Truth**: External CRM remains the sole authority for tenants, branches, and employees.
- **Fail-Fast**: The API must fail clearly if Supabase is misconfigured or unavailable, rather than silently falling back to in-memory mocks.

---

## Success Criteria
- [ ] Supabase migrations apply cleanly and define all 11 tables with composite constraints and indexes.
- [ ] Deterministic seed data applies idempotently without duplicate records.
- [ ] Database client and repositories persist helpdesk data with CRM relationship validation.
- [ ] Cross-tenant and cross-branch violations are rejected at database and API layers.
- [ ] All automated tests pass with 100% success rate.
- [ ] Complete documentation provided in `docs/database-design.md` and updated `README.md`.

---

*Last updated: 2026-10-17*
