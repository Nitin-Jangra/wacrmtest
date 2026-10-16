# Gym WhatsApp Helpdesk — Mock CRM API & Staging Foundation

[![Tests](https://img.shields.io/badge/tests-67%2F67%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)]()
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)]()

Production-oriented, multi-tenant foundation for the **Gym WhatsApp Helpdesk** system. This milestone delivers a standalone **Mock CRM API** simulating an external multi-tenant gym CRM hierarchy, alongside the main **Helpdesk API** communicating exclusively through a pluggable **CRM Integration Adapter**.

---

## 1. Architectural Highlights

- **External CRM as Source of Truth**: The CRM owns tenants, branches, employees, designations, and permissions. The helpdesk application will maintain its own database (Supabase) in subsequent milestones for conversations, leads, and assignment rules without duplicating CRM management.
- **Pluggable CRM Adapter Pattern**: The Helpdesk core interacts with CRM entities solely through the `ICrmAdapter` interface (`apps/api/src/integrations/crm/crm.interface.ts`). Switch between in-memory simulation (`MockCrmAdapter`) and networked HTTP calls (`HttpCrmAdapter`) via configuration.
- **Strict Multi-Tenant Isolation**: Tenant Alpha users cannot access Tenant Beta data; branch admins cannot query branches outside their branch scope.
- **Zero Production Risk**: Mock authentication strictly rejects execution if `NODE_ENV=production`.

---

## 2. Monorepo Repository Structure

```
gym-whatsapp-helpdesk/
├── apps/
│   ├── api/                          # Main Helpdesk Express API & Adapter Proxy
│   │   └── src/
│   │       ├── config/               # Zod environment configuration
│   │       ├── middleware/           # Centralized error handling
│   │       ├── modules/
│   │       │   ├── health/           # Public service & downstream health check
│   │       │   └── crm-proxy/        # Endpoints proxying CRM data via adapter
│   │       ├── integrations/
│   │       │   └── crm/              # Adapter interface, mock adapter, and HTTP adapter
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
│   └── shared-types/                 # Shared domain contracts, enums & Zod schemas
│
├── tests/
│   ├── unit/                         # Unit tests (repository, validation, schemas)
│   ├── integration/                  # Integration tests (mock-crm-api, http adapter, proxy)
│   └── security/                     # Security isolation & RBAC enforcement tests
│
├── docs/
│   ├── architecture.md               # Detailed system architecture and sequence flows
│   ├── api-contracts.md              # Full endpoint contracts, request/response formats
│   ├── data-model.md                 # Entity definitions and deterministic seed dictionary
│   └── testing.md                    # Test execution strategy and security test catalog
│
├── .env.example                      # Environment variables template
├── .gitignore
├── package.json                      # Workspaces configuration and root scripts
├── tsconfig.base.json                # Shared strict TypeScript configuration
├── eslint.config.js                  # ESLint 9 flat configuration
├── .prettierrc.json                  # Prettier formatting rules
└── README.md
```

---

## 3. Quickstart & Reproducible Setup

### Prerequisites
- **Node.js** >= 18.0.0 (Tested on Node.js v24.21.0)
- **npm** >= 9.0.0

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Default `.env` configuration:
```ini
NODE_ENV=development
API_PORT=4000
MOCK_CRM_PORT=4001
CORS_ORIGIN=http://localhost:3000,http://localhost:4000,http://localhost:4001
MOCK_AUTH_ENABLED=true
CRM_ADAPTER=http
MOCK_CRM_BASE_URL=http://localhost:4001
MOCK_CRM_SERVICE_TOKEN=dev-service-token-secret-change-in-prod
```

### Step 3: Compile Packages
```bash
npm run build
```

---

## 4. Running the Applications

### Run Both Services Concurrently
Starts both Mock CRM API (`:4001`) and Helpdesk API (`:4000`) simultaneously:
```bash
npm run dev
```

### Run Services Independently
Run Mock CRM API only:
```bash
npm run dev:mock-crm
```

Run Helpdesk API only:
```bash
npm run dev:api
```

---

## 5. Development Test Identities

Use the `x-mock-identity` header in API requests:

| Header Value | Role | Tenant | Branch Scope | Permissions |
|---|---|---|---|---|
| `super_admin` | Super Admin | Global | All branches | Full platform permissions |
| `alpha_admin` | Tenant Admin | Tenant Alpha | All Alpha branches | Manage Tenant Alpha |
| `alpha_branch_admin` | Branch Admin | Tenant Alpha | Greater Noida branch | Read Alpha, manage branch |
| `alpha_employee` | Employee | Tenant Alpha | Greater Noida branch | Read assigned branch & agents |
| `beta_admin` | Tenant Admin | Tenant Beta | All Beta branches | Manage Tenant Beta |
| `beta_branch_admin` | Branch Admin | Tenant Beta | Jaipur branch | Read Beta, manage branch |
| `beta_employee` | Employee | Tenant Beta | Jaipur branch | Read assigned branch & agents |

Alternatively, automated service requests can pass:
`Authorization: Bearer dev-service-token-secret-change-in-prod`

---

## 6. Example API Requests

### 1. Public Health Check
```bash
curl http://localhost:4001/health
```

### 2. Inspect Current Identity & Scope
```bash
curl -H "x-mock-identity: alpha_admin" http://localhost:4001/api/v1/me
```

### 3. List Branches for Tenant Alpha
```bash
curl -H "x-mock-identity: alpha_admin" \
  http://localhost:4001/api/v1/tenants/11111111-1111-4000-8000-000000000001/branches
```

### 4. Fetch Eligible Chat Agents for Branch
```bash
curl -H "x-mock-identity: alpha_branch_admin" \
  http://localhost:4001/api/v1/branches/aaaaaaaa-0001-4000-8000-000000000001/chat-agents
```

### 5. Access via Helpdesk API CRM Proxy
```bash
curl -H "x-mock-identity: super_admin" \
  http://localhost:4000/api/v1/crm/tenants
```

### 6. Verify Cross-Tenant Isolation Enforcement
Attempting to access Tenant Alpha data with `beta_admin` identity:
```bash
curl -H "x-mock-identity: beta_admin" \
  http://localhost:4001/api/v1/tenants/11111111-1111-4000-8000-000000000001
```
Response:
```json
{
  "error": {
    "code": "CROSS_TENANT_ACCESS_FORBIDDEN",
    "message": "Access denied: You are not authorized to access this tenant."
  }
}
```

---

## 7. Automated Testing Suite

All tests are implemented with Vitest and Supertest:

```bash
# Run all tests
npm test

# Run unit tests (repository, validation, domain logic)
npm run test:unit

# Run integration tests (REST endpoints, HTTP adapter roundtrip, CRM proxy)
npm run test:integration

# Run security tests (tenant isolation, RBAC, UUID validation, production safety)
npm run test:security
```

---

## 8. Code Quality & Verification Commands

```bash
# Typecheck all packages with TypeScript strict mode
npm run typecheck

# Lint codebase with ESLint
npm run lint

# Check formatting with Prettier
npm run format:check

# Auto-format all files
npm run format
```

---

## 9. Security Limitations of the Mock Environment

1. **Development Header Auth**: The `x-mock-identity` header is designed strictly for local development and integration testing. It does not replace real JWT, OAuth2, or Mutual TLS authentication.
2. **In-Memory Fixtures**: The mock CRM repository stores data in memory. Changes during runtime are not persisted across server restarts.
3. **No Real Customer Data**: All names, email addresses (`@example.com`), and phone records are fictional test data.

---

## 10. Recommended Next Milestone

**Milestone 2 — Supabase Staging Persistence & WhatsApp Helpdesk Schema**
- Initialize Supabase PostgreSQL database schemas.
- Implement helpdesk-specific tables (Conversations, Messages, Leads, Agent Routing Configurations).
- Implement database migration scripts and seed scripts.
- Integrate the real helpdesk persistence layer alongside the `HttpCrmAdapter`.
