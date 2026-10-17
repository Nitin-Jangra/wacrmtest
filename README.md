# Gym WhatsApp Helpdesk — Mock CRM API & Persistent Staging Foundation

[![Tests](https://img.shields.io/badge/tests-102%2F102%20passing-brightgreen.svg)](<>)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)](<>)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](<>)
[![Database](https://img.shields.io/badge/database-Supabase%20PostgreSQL-3ECF8E.svg)](<>)

Production-oriented, multi-tenant foundation for the **Gym WhatsApp Helpdesk** system. This milestone delivers a standalone **Mock CRM API** simulating an external multi-tenant gym CRM hierarchy, alongside the main **Helpdesk API** backed by a **Supabase PostgreSQL** staging database and communicating with the CRM exclusively through a pluggable **CRM Integration Adapter**.

---

## 1. Architectural Highlights

- **External CRM as Sole Source of Truth**: The CRM exclusively owns tenants, branches, employees, designations, and permissions. The helpdesk application maintains its own operational database (Supabase) for channels, leads, conversations, messages, follow-ups, agent settings, and audit logs without duplicating CRM master records.
- **Fail-Closed Database Architecture**: In-memory database fallback is strictly forbidden. If Supabase credentials are missing or the connection fails, the API throws an explicit `DatabaseConfigurationError` (HTTP 503), preventing silent data loss or phantom state.
- **Multi-Tenant Composite Keys & Integrity**: Relationships enforce cross-tenant and cross-branch alignment at both the application layer (`helpdesk.service.ts`) and the database layer (PostgreSQL composite foreign keys and check constraints).
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
│   │       │   ├── leads/            # Inbound prospect/lead management
│   │       │   ├── conversations/    # Threads and conversation messaging
│   │       │   ├── follow-ups/       # Agent reminders and task follow-ups
│   │       │   └── webhook-events/   # Idempotent webhook event ledger
│   │       ├── repositories/         # Supabase PostgreSQL repository implementations
│   │       ├── services/             # Domain logic & CRM integrity validation
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
│   ├── unit/                         # Unit tests (schema, fail-close, repositories, CRM)
│   ├── integration/                  # Integration tests (integrity, adapters, mock CRM API)
│   └── security/                     # Security isolation & multi-tenant boundary tests
│
├── docs/
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
# Start both Mock CRM API (port 4001) and Helpdesk API (port 4000) concurrently:
npm run dev

# Or start services individually:
npm run dev:crm       # Mock CRM API on http://localhost:4001
npm run dev:api       # Helpdesk API on http://localhost:4000
```

---

## 4. Automated Test Suite

Run the full automated test suite (102 tests across 12 test files):
```bash
npm test
```

### Test Catalog
| Suite | File | Tests | Coverage Scope |
|:---|:---|:---:|:---|
| **Unit** | `database-schema.test.ts` | 5 | Validates all 11 tables, constraints, indexes, RLS, seed idempotence |
| **Unit** | `database-failclose.test.ts` | 2 | Validates fail-closed behavior when Supabase credentials are missing |
| **Unit** | `helpdesk-repositories.test.ts` | 6 | Repository CRUD and pagination queries |
| **Unit** | `crm-repository.test.ts` | 11 | In-memory CRM repository data operations |
| **Unit** | `uuid-validation.test.ts` | 8 | UUID string format and injection validation |
| **Unit** | `integrity-validator.test.ts` | 5 | CRM relationship integrity checks |
| **Integration** | `helpdesk-integrity.test.ts` | 10 | Validates all 10 integrity rules from Section 12.C |
| **Integration** | `mock-crm-api.test.ts` | 15 | REST endpoints of standalone Mock CRM |
| **Integration** | `http-crm-adapter.test.ts` | 13 | Networked adapter against Mock CRM API |
| **Integration** | `api-crm-proxy.test.ts` | 5 | Helpdesk API CRM proxy routes |
| **Security** | `security-tenant-isolation.test.ts` | 10 | Mock CRM multi-tenant and branch boundaries |
| **Security** | `helpdesk-tenant-isolation.test.ts` | 12 | Helpdesk persistence cross-tenant isolation and query filtering |
| **Total** | **12 test suites** | **102** | **100% Passing** |

---

## 5. Next Milestone: Phase 3
- Lead distribution & routing engine (round-robin, weighted, least-active)
- WhatsApp Cloud API webhook ingestion and status notifications
- Inbound chat session state transitions and conversation lifecycle
