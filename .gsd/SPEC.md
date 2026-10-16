# SPEC.md — Project Specification: Gym WhatsApp Helpdesk Mock CRM & Staging Foundation

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: Spec is finalized and verified against project requirements.

---

## Vision

Build the first milestone of a production-oriented, multi-tenant Gym WhatsApp Helpdesk application: establishing a robust project foundation, strict domain contracts, and a fully functional Mock CRM API simulating a real external CRM hierarchy (Tenants, Branches, Employees, Chat Designations, and Permissions). The Helpdesk API communicates exclusively via an interchangeable CRM Adapter layer (in-memory mock adapter and HTTP adapter), enabling seamless future transition to the actual CRM without rewriting helpdesk business logic.

---

## Virtual Development Team Structure

To ensure separation of concerns, high velocity, and rigorous quality standards, the work is divided across a dedicated virtual engineering team:

1. **Dev 1: Alex (Lead Architect & DevOps)**
   - Monorepo architecture (`npm` workspaces)
   - TypeScript strict configuration (`tsconfig.base.json`, per-package configs)
   - Linters and formatters (ESLint, Prettier)
   - Root configuration, scripts, and environment variable schema (`zod`)
   - Shared domain contracts (`packages/shared-types`)

2. **Dev 2: Maya (Data Engineer & Fixture Specialist)**
   - Deterministic dummy dataset generation (UUIDs, timestamps, strict relationships)
   - Seed data: 1 Super Admin, 2 Tenants (Alpha, Beta), 4 Branches, 16 Employees, 6+ Chat Designations, Permissions
   - Relationship integrity validation rules (anti-leakage, cross-tenant association guards)
   - Mock CRM repository layer with pagination & filtering

3. **Dev 3: Liam (Mock CRM API Specialist)**
   - Express application for `apps/mock-crm-api`
   - Security middleware: Helmet, CORS allowlist, request size limits, centralized error handling
   - Mock Identity Provider & Authorization Middleware (scoped by Super Admin, Tenant Admin, Branch Admin, Employee)
   - Production mode guard (forbids mock auth when `NODE_ENV=production`)
   - REST endpoints under `/api/v1` for tenants, branches, employees, chat-designations, chat-agents, `/me`, `/health`

4. **Dev 4: Zara (Integration & Adapter Specialist)**
   - CRM Adapter interface contract (`crm.interface.ts`)
   - Direct In-Memory Mock CRM Adapter (`mock-crm.adapter.ts`)
   - Robust HTTP CRM Adapter (`http-crm.adapter.ts`) with timeout, error mapping, and validation
   - Error classification: Auth, Authorization, Timeout, Upstream Service Error

5. **Dev 5: Ethan (Core Helpdesk API Developer)**
   - Express application for `apps/api`
   - Config & Environment loading
   - CRM proxy / consumer modules consuming data solely via the CRM adapter
   - Health check endpoints (`/health`)
   - Dynamic adapter instantiation via factory (`CRM_ADAPTER=mock` or `http`)

6. **Dev 6: Sophia (QA & Security Specialist)**
   - Comprehensive Vitest test runner configuration
   - Unit tests (lookups, calculations, validators, error mappers)
   - Integration tests (endpoint contracts, pagination, HTTP adapter roundtrip)
   - Security tests (cross-tenant data leakage prevention, branch scoping, malformed UUID rejection, auth headers, production lockdown)

7. **Dev 7: Marcus (Tech Lead / Documentation & Release Engineer)**
   - Project documentation (`docs/architecture.md`, `docs/api-contracts.md`, `docs/data-model.md`, `docs/testing.md`)
   - Root `README.md` with reproducible setup guide, test commands, and security notices
   - `.env.example` validation and audit
   - Build, lint, and typecheck validation across the monorepo

---

## Goals

1. **Deterministic CRM Hierarchy**: Complete data simulation with 1 Super Admin, 2 tenants, 4 branches, 16 employees, 6 chat designations, and granular permissions.
2. **Mock CRM API Service (`apps/mock-crm-api`)**: Fully functional Express REST API with strict Zod validation, pagination, JSON envelope formatting, and role/tenant/branch-scoped authorization.
3. **Pluggable CRM Integration Layer**: Generic `ICrmAdapter` interface with both `MockCrmAdapter` and `HttpCrmAdapter` implementations ensuring zero coupling between helpdesk core and CRM internals.
4. **Main Helpdesk API (`apps/api`)**: Service consuming CRM data via adapter proxy endpoints and exposing system health.
5. **Strict Security Controls**: Enforce tenant isolation, branch isolation, mock auth safety guards prohibiting production activation, and sanitized error outputs.
6. **100% Automated Testing**: Extensive unit, integration, and security test coverage in Vitest.

---

## Non-Goals (Out of Scope for Milestone 1)

- Real WhatsApp Business API / Meta Cloud API integrations or webhooks.
- Supabase PostgreSQL persistence (reserved for Milestone 2).
- Full React/Bootstrap frontend UI (only minimal health/status endpoints).
- Lead assignment algorithms, message queuing, or customer chat routing.
- Real production authentication (OAuth2/JWT); only simulated development identity header auth.

---

## Constraints

- **Runtime**: Node.js >= 18 (Current: v24.21.0), npm workspaces.
- **Language**: TypeScript with strict mode enabled.
- **Architectural Principle**: Helpdesk must NOT query mock CRM data files directly; access must traverse the CRM Adapter.
- **Safety**: Mock authentication must refuse to start if `NODE_ENV=production`.

---

## Success Criteria

- [ ] Monorepo installs cleanly via `npm install` and compiles with `npm run build` and `npm run typecheck`.
- [ ] Linting and formatting pass with `npm run lint` and `npm run format:check`.
- [ ] Mock CRM API starts on `MOCK_CRM_PORT` (default: 4001) and responds to `/health` and `/api/v1/*`.
- [ ] Main Helpdesk API starts on `API_PORT` (default: 4000) and communicates with Mock CRM via `HttpCrmAdapter`.
- [ ] All unit, integration, and security tests pass with `npm run test`.
- [ ] Zero cross-tenant data leakage is verified by automated security test cases.
- [ ] Complete documentation is delivered in `docs/` and `README.md`.

---

_Last updated: 2026-10-16_
