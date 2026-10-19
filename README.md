# M Square Professionals — WhatsApp Helpdesk & CRM Foundation
[https://msquareprofessionals.com/](https://msquareprofessionals.com/)

[![Tests](https://img.shields.io/badge/tests-205%2F205%20passing-brightgreen.svg)](<>)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)](<>)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](<>)
[![React](https://img.shields.io/badge/frontend-React%2018%20%2B%20Bootstrap%205-61DAFB.svg)](<>)
[![Database](https://img.shields.io/badge/database-Supabase%20PostgreSQL-3ECF8E.svg)](<>)

Production-oriented, multi-tenant ecosystem for **M Square Professionals** ([msquareprofessionals.com](https://msquareprofessionals.com/)). This system powers the **WhatsApp Helpdesk & CRM**, featuring the **M Square Professionals React Dashboard** (designed to match the official website theme, colors, typography, and dark/light modes), a standalone **Mock CRM API**, the main **Helpdesk API** backed by **Supabase PostgreSQL**, the **Phase 3 Lead Assignment Engine** (Smooth Weighted Round-Robin distribution and atomic concurrency locking), the **Phase 4 Official Meta WhatsApp Cloud API Integration**, and the **Phase 5 Helpdesk Dashboard** (conversations, WhatsApp messaging, transfers, and scheduled follow-ups).

---

## 1. Architectural Highlights

- **External CRM as Sole Source of Truth**: The CRM exclusively owns tenants, branches, employees, designations, and permissions. The helpdesk application maintains its own operational database (Supabase) for channels, leads, conversations, messages, follow-ups, agent settings, and audit logs without duplicating CRM master records.
- **Persistent Lead Assignment Engine (Phase 3)**: Automatically assigns incoming leads and conversations using Nginx-style Smooth Weighted Round-Robin (SWRR) or cyclic Round-Robin. Fully reconciles dynamic weights, prunes inactive agents, and retains existing eligible owners without consuming distribution state.
- **Fail-Closed Database Architecture**: In-memory database fallback is strictly forbidden. If Supabase credentials are missing or the connection fails, the API throws an explicit `DatabaseConfigurationError` (HTTP 503), preventing silent data loss or phantom state.
- **Multi-Tenant Composite Keys & Integrity**: Relationships enforce cross-tenant and cross-branch alignment at both the application layer (`helpdesk.service.ts`, `assignment.service.ts`) and the database layer (PostgreSQL composite foreign keys and check constraints).
- **Branch Concurrency Mutex**: Promise-chaining FIFO mutex (`BranchAssignmentMutex`) guarantees atomic sequential execution of round-robin state reads, candidate resolution, selection, and audit ledger recording per `(tenantId, branchId)`.
- **Row-Level Security (RLS)**: Enabled across all 11 helpdesk tables with tenant-scoped policies and immutable triggers on audit tables.
- **Pluggable CRM Adapter Pattern**: The Helpdesk core interacts with CRM entities solely through the `ICrmAdapter` interface. Switch between in-memory simulation (`MockCrmAdapter`) and networked HTTP calls (`HttpCrmAdapter`) via configuration.
- **Zero Production Risk**: Mock authentication strictly rejects execution if `NODE_ENV=production`.

---

## 2. Monorepo Repository Structure

```
gym-whatsapp-helpdesk/
├── apps/
│   ├── api/                          # Main Helpdesk Express API & Persistence Layer
│   │   └── src/
│   │       ├── config/               # Zod environment configuration (includes Supabase)
│   │       ├── database/             # Supabase client, fail-fast checks, custom errors
│   │       ├── middleware/           # Centralized error handling (DatabaseError, CrmError, Zod)
│   │       ├── modules/              # REST Endpoints
│   │       │   ├── health/           # Service & database connectivity health checks
│   │       │   ├── crm-proxy/        # Endpoints proxying CRM data via adapter
│   │       │   ├── channels/         # WhatsApp Channel provisioning
│   │       │   ├── agent-settings/   # Agent chat eligibility and routing settings
│   │       │   ├── branches/         # Branch assignment preview & active rule routes
│   │       │   ├── leads/            # Inbound prospect/lead management & assignment
│   │       │   ├── conversations/    # Threads, conversation messaging & assignment
│   │       │   ├── follow-ups/       # Agent reminders and task follow-ups
│   │       │   └── webhook-events/   # Idempotent webhook event ledger
│   │       ├── repositories/         # Supabase PostgreSQL repository implementations
│   │       ├── services/             # Domain logic & CRM integrity validation
│   │       │   └── assignment/       # Phase 3 Lead Assignment Engine (SWRR, Resolvers)
│   │       ├── integrations/crm/     # Adapter interface, mock adapter, and HTTP adapter
│   │       ├── app.ts                # Express app factory
│   │       └── server.ts             # Helpdesk server entrypoint (port 4000)
│   │
│   └── mock-crm-api/                 # Standalone Mock CRM REST API service
│       └── src/
│           ├── config/               # Zod validation & production safety locks
│           ├── data/                 # Deterministic fixtures & test identities
│           ├── middleware/           # Mock identity auth, RBAC & tenant scoping
│           ├── repositories/         # In-memory repository & integrity validator
│           ├── routes/               # /api/v1 REST endpoints
│           ├── services/             # CRM domain business logic
│           ├── app.ts                # Express app factory
│           └── server.ts             # Mock CRM server entrypoint (port 4001)
│
├── packages/
│   └── shared-types/                 # Shared domain contracts, enums & Zod DTO schemas
│
├── supabase/
│   ├── config.toml                   # Supabase configuration
│   ├── seed.sql                      # Repeatable deterministic test fixtures (ON CONFLICT DO NOTHING)
│   └── migrations/
│       ├── 20261017000001_create_core_helpdesk_tables.sql  # 11 core tables
│       ├── 20261017000002_add_constraints_and_indexes.sql  # Composite FKs, checks, indexes
│       └── 20261017000003_configure_rls_and_triggers.sql   # RLS policies & immutable audit trigger
│
├── tests/
│   ├── unit/                         # Unit tests (SWRR, schema, fail-close, repositories, CRM)
│   ├── integration/                  # Integration tests (leads, concurrency, adapters, mock CRM API)
│   └── security/                     # Security isolation & multi-tenant boundary tests
│
├── docs/
│   ├── phase3-lead-assignment.md     # Detailed Phase 3 assignment engine documentation
│   ├── database-design.md            # Schema, ERD, indexes, RLS policies, and staging runbook
│   ├── architecture.md               # Detailed system architecture and sequence flows
│   ├── api-contracts.md              # Full endpoint contracts, request/response formats
│   ├── data-model.md                 # Entity definitions and deterministic seed dictionary
│   └── testing.md                    # Test execution strategy and security test catalog
```

---

## 3. Quick Start & Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- (Optional) Supabase staging project or Supabase CLI

### 1. Installation & Build
```bash
# Install root dependencies and workspaces
npm install

# Build shared types package
npm run build --workspace=@gym-helpdesk/shared-types

# Typecheck all workspaces
npm run typecheck
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are populated with your staging credentials.

### 3. Apply Migrations & Seed Staging Database
```bash
# Push migrations to Supabase
supabase db push

# Or apply manually using psql:
psql "$DATABASE_URL" -f supabase/migrations/20261017000001_create_core_helpdesk_tables.sql
psql "$DATABASE_URL" -f supabase/migrations/20261017000002_add_constraints_and_indexes.sql
psql "$DATABASE_URL" -f supabase/migrations/20261017000003_configure_rls_and_triggers.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

### 4. Running Services Locally
```bash
# Start Mock CRM API (port 4001), Helpdesk API (port 4000), and React Dashboard (port 3000) concurrently:
npm run dev:all

# Or start services individually:
npm run dev:mock-crm   # Mock CRM API on http://localhost:4001
npm run dev:api        # Helpdesk API on http://localhost:4000
npm run dev:dashboard  # Helpdesk React Dashboard on http://localhost:3000
```

---

## 4. Automated Test Suite

Run the full automated test suite (205 tests across 27 test files):
```bash
npm test
```

### Test Catalog
| Suite | File | Tests | Coverage Scope |
|:---|:---|:---:|:---|
| **Unit** | `weighted-round-robin.test.ts` | 11 | Smooth Weighted Round-Robin algorithm, weights, single agent, tie-breaking |
| **Unit** | `eligible-agent-resolver.test.ts` | 4 | CRM status, Helpdesk settings, designation validity, exclusion lists |
| **Unit** | `database-schema.test.ts` | 5 | Validates all 11 tables, constraints, indexes, RLS, seed idempotence |
| **Unit** | `database-failclose.test.ts` | 2 | Validates fail-closed behavior when Supabase credentials are missing |
| **Unit** | `helpdesk-repositories.test.ts` | 6 | Repository CRUD and pagination queries |
| **Unit** | `crm-repository.test.ts` | 11 | In-memory CRM repository data operations |
| **Unit** | `uuid-validation.test.ts` | 8 | UUID string format and injection validation |
| **Unit** | `integrity-validator.test.ts` | 5 | CRM relationship integrity checks |
| **Unit** | `whatsapp-provider.test.ts` | 10 | Meta Cloud API client, HMAC-SHA256 signature verification, Mock provider modes |
| **Unit** | `delivery-status-mapper.test.ts` | 6 | Meta delivery status mapping, monotonic progression rules, regression prevention |
| **Unit** | `whatsapp-channel-resolver.test.ts` | 5 | Phone number ID to channel mapping, active vs inactive channel validation |
| **Integration** | `lead-assignment.test.ts` | 9 | Lead/conversation assignment, ownership retention, audit, idempotent repeats |
| **Integration** | `assignment-concurrency.test.ts` | 2 | Concurrent simultaneous assignments, state persistence across requests |
| **Integration** | `helpdesk-integrity.test.ts` | 10 | Validates all 10 integrity rules from Section 12.C |
| **Integration** | `mock-crm-api.test.ts` | 15 | REST endpoints of standalone Mock CRM |
| **Integration** | `http-crm-adapter.test.ts` | 13 | Networked adapter against Mock CRM API |
| **Integration** | `api-crm-proxy.test.ts` | 5 | Helpdesk API CRM proxy routes |
| **Integration** | `phase1-3-e2e.test.ts` | 7 | End-to-end integration scenarios A-E, failure safety, cross-restart persistence |
| **Integration** | `whatsapp-webhook.test.ts` | 12 | Meta webhook verification handshake, inbound messaging, Phase 3 assignment, returning lead retention, delivery status updates |
| **Integration** | `whatsapp-outbound.test.ts` | 6 | Outbound text messaging via provider, branch/tenant scope enforcement, pending-to-sent persistence, provider failure tracking |
| **Integration** | `phase1-4-full-lifecycle-e2e.test.ts` | 5 | Comprehensive Phase 1-4 full lifecycle: inbound WhatsApp to SWRR assignment, outbound agent replies with delivery receipts, returning contact retention, cross-tenant isolation, concurrent idempotency |
| **Integration** | `phase5-dashboard-endpoints.test.ts` | 6 | Phase 5 status lifecycle updates, conversation transfers with eligibility, follow-ups scheduling, and employee conversation filtering |
| **Integration** | `phase5-dashboard-workflow.test.ts` | 8 | End-to-end Helpdesk Dashboard API client workflow: authentication, inbox, message delivery status, transfers, and security scoping |
| **Security** | `assignment-security.test.ts` | 8 | Cross-tenant isolation, branch scoping, admin role enforcement on settings |
| **Security** | `security-tenant-isolation.test.ts` | 10 | Mock CRM multi-tenant and branch boundaries |
| **Security** | `helpdesk-tenant-isolation.test.ts` | 12 | Helpdesk persistence cross-tenant isolation and query filtering |
| **Security** | `whatsapp-security.test.ts` | 4 | Cross-tenant messaging isolation, safe webhook failure retries, concurrent duplicate event safety |
| **Total** | **27 test suites** | **205** | **100% Passing** |

---

## 5. Completed Milestones
- **Phase 1**: Mock CRM API, adapter abstraction, RBAC, tenant/branch isolation.
- **Phase 2**: Supabase PostgreSQL database integration, RLS policies, core domain tables.
- **Phase 3**: Lead Assignment Engine (Smooth Weighted Round-Robin, concurrency mutex, audit history).
- **Phase 4**: Official WhatsApp Cloud API integration, webhooks, HMAC verification, outgoing messaging.
- **Phase 5**: Helpdesk React Dashboard, WhatsApp chat inbox, status lifecycle, transfers, and follow-ups.

