---
milestone: 'Milestone 1 — Mock CRM API & Staging Foundation'
version: 1.0.0
updated: 2026-10-16T18:00:00+05:30
---

# Roadmap: Milestone 1 — Gym WhatsApp Helpdesk Foundation

> **Current Phase:** Phase 7 - Documentation, Verification & Release (Dev 7: Marcus)
> **Status:** ✅ Complete

## Virtual Engineering Team

- **Dev 1: Alex (Lead Architect & DevOps)**: Monorepo, TS config, Workspaces, Shared Types, Linter, Environment validation
- **Dev 2: Maya (Data Engineer & Fixture Specialist)**: Deterministic Seed Data, Relational Validation Rules, Mock Repositories
- **Dev 3: Liam (Mock CRM API Specialist)**: Mock CRM Express Server, Routes, Controllers, Authorization Middleware, Pagination
- **Dev 4: Zara (Integration & Adapter Specialist)**: CRM Adapter Interface, Mock Adapter, Resilient HTTP CRM Adapter
- **Dev 5: Ethan (Core Helpdesk API Developer)**: Main Helpdesk API Server, Module routing, CRM Proxy, Factory injection
- **Dev 6: Sophia (QA & Security Specialist)**: Unit, Integration, and Security Test Suites in Vitest
- **Dev 7: Marcus (Tech Lead / Documentation & Release Engineer)**: Technical Architecture, Contracts, README, Verifications

---

## Must-Haves (from SPEC)

- [x] Monorepo structure with npm workspaces (`apps/api`, `apps/mock-crm-api`, `packages/shared-types`, `tests/`, `docs/`)
- [x] Deterministic CRM hierarchy (1 Super Admin, 2 tenants, 4 branches, 16 employees, 6 chat designations, permissions)
- [x] Mock CRM API service with `/api/v1` routes and development mock identity authentication
- [x] Pluggable CRM integration layer (`ICrmAdapter`, `MockCrmAdapter`, `HttpCrmAdapter`)
- [x] Main Helpdesk API consuming CRM data exclusively via adapter
- [x] Strict multi-tenant security controls prohibiting cross-tenant data leakage and production mock auth
- [x] 100% automated test suite passing (67/67 tests passing across unit, integration, security)
- [x] Complete documentation and reproducible setup guide (`README.md`, `docs/*`)

---

## Phases & Task Breakdown

### Phase 1: Foundation & Shared Architecture (Dev 1: Alex)

**Status:** ✅ Complete
**Objective:** Set up the monorepo, npm workspaces, TypeScript strict configurations, shared types, linters, and environment schemas.

- [x] Task 1.1: Initialize root `package.json`, `.gitignore`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`.
- [x] Task 1.2: Scaffold `packages/shared-types` with domain interfaces (Tenant, Branch, Employee, Designation, Permission, Identity, API envelope, Error responses).
- [x] Task 1.3: Set up environment schema validator with Zod in shared/config.

### Phase 2: Deterministic Data Engine & Validation (Dev 2: Maya)

**Status:** ✅ Complete
**Objective:** Build high-fidelity deterministic fixtures and relational integrity guards.

- [x] Task 2.1: Implement fixture data with stable UUIDs, Super Admin, Tenants Alpha & Beta, 4 branches, 16 employees, and 6 designations.
- [x] Task 2.2: Implement relational validation functions (enforce branch/tenant pairing, designation/tenant pairing, chat eligibility rules).
- [x] Task 2.3: Implement in-memory deterministic Mock CRM Repository with pagination and filtering.

### Phase 3: Mock CRM API Service (Dev 3: Liam)

**Status:** ✅ Complete
**Objective:** Build standalone Express Mock CRM API with security headers, scoped auth, and REST endpoints.

- [x] Task 3.1: Configure Express app with Helmet, CORS allowlist, request limits, centralized error handler, and request logger.
- [x] Task 3.2: Implement mock identity provider middleware with dev header (`x-mock-identity`), role/branch scopes, and production lockout.
- [x] Task 3.3: Implement `/health`, `/api/v1/me`, `/api/v1/tenants`, `/api/v1/branches`, `/api/v1/employees`, `/api/v1/chat-designations`, `/api/v1/branches/:branchId/chat-agents`.

### Phase 4: CRM Integration Adapter Layer (Dev 4: Zara)

**Status:** ✅ Complete
**Objective:** Build decoupled CRM adapter interface and implementations.

- [x] Task 4.1: Implement `crm.interface.ts` defining all CRM query contracts with typed inputs/outputs.
- [x] Task 4.2: Implement `mock-crm.adapter.ts` for in-process fast simulation.
- [x] Task 4.3: Implement `http-crm.adapter.ts` for networked communication against the Mock CRM API with timeouts, retry safety, and error mapping.

### Phase 5: Core Helpdesk API & Adapter Proxy (Dev 5: Ethan)

**Status:** ✅ Complete
**Objective:** Build Main Helpdesk API consuming CRM data solely through the adapter.

- [x] Task 5.1: Scaffold `apps/api` with configuration, security middleware, and `/health`.
- [x] Task 5.2: Create adapter factory resolving `mock` or `http` adapter based on `CRM_ADAPTER` env var.
- [x] Task 5.3: Implement CRM proxy module in `apps/api` exposing CRM queries to helpdesk consumers.

### Phase 6: Automated Testing & Security Verification (Dev 6: Sophia)

**Status:** ✅ Complete
**Objective:** Comprehensive unit, integration, and security test suites.

- [x] Task 6.1: Write unit tests for repositories, eligibility logic, validators, and error mappers (24 tests passing).
- [x] Task 6.2: Write integration tests for API endpoints, pagination, and HTTP adapter roundtrips (33 tests passing).
- [x] Task 6.3: Write security tests: Tenant Alpha cannot read Tenant Beta data, branch admin scoping, malformed UUID rejection, mock auth production lockout (10 tests passing).

### Phase 7: Documentation, Verification & Release (Dev 7: Marcus)

**Status:** ✅ Complete
**Objective:** Comprehensive documentation, scripts validation, and release readiness.

- [x] Task 7.1: Write `docs/architecture.md`, `docs/api-contracts.md`, `docs/data-model.md`, `docs/testing.md`.
- [x] Task 7.2: Create `.env.example` and root `README.md`.
- [x] Task 7.3: Validate `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`, and dev server startup.

---

## Progress Summary

| Phase                                     | Lead          | Status      | Tasks | Completed |
| ----------------------------------------- | ------------- | ----------- | ----- | --------- |
| Phase 1: Foundation & Shared Architecture | Dev 1: Alex   | ✅ Complete | 3     | 3/3       |
| Phase 2: Deterministic Data Engine        | Dev 2: Maya   | ✅ Complete | 3     | 3/3       |
| Phase 3: Mock CRM API Service             | Dev 3: Liam   | ✅ Complete | 3     | 3/3       |
| Phase 4: CRM Integration Adapter          | Dev 4: Zara   | ✅ Complete | 3     | 3/3       |
| Phase 5: Core Helpdesk API                | Dev 5: Ethan  | ✅ Complete | 3     | 3/3       |
| Phase 6: Testing & Security               | Dev 6: Sophia | ✅ Complete | 3     | 3/3       |
| Phase 7: Documentation & Release          | Dev 7: Marcus | ✅ Complete | 3     | 3/3       |
