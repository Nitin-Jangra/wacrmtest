# System Architecture — Gym WhatsApp Helpdesk Foundation

## 1. Overview & Core Principles

The **Gym WhatsApp Helpdesk** is designed to provide automated and human-agent support to gym members across multiple fitness center tenants and geographic branches. 

### Fundamental Architectural Principle
- **The CRM is the single source of truth** for tenant configuration, branch locations, employee rosters, role designations, and access permissions.
- **The Helpdesk does NOT maintain a competing employee or tenant system**. In future milestones, it will maintain its own database (Supabase PostgreSQL) solely for WhatsApp conversations, customer leads, message history, agent shifts, and assignment logs.
- For this milestone, the **Mock CRM API** simulates the external CRM. The helpdesk application communicates with CRM data exclusively through a decoupled **CRM Integration Adapter layer (`ICrmAdapter`)**.

```
+-------------------------------------------------------------+
|                     Gym Helpdesk Core                       |
|                     (apps/api)                              |
|                                                             |
|   +-------------------+       +-------------------------+   |
|   |  CRM Proxy Route  | ----> |   ICrmAdapter Contract  |   |
|   +-------------------+       +-------------------------+   |
+--------------------------------------------|----------------+
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
                     v                                               v
        +-------------------------+                     +-------------------------+
        |     MockCrmAdapter      |                     |      HttpCrmAdapter     |
        |  (In-Memory Simulation) |                     |  (HTTP Network Client)  |
        +-------------------------+                     +-------------------------+
                                                                     | (HTTP /api/v1)
                                                                     v
                                                        +-------------------------+
                                                        |      Mock CRM API       |
                                                        |   (apps/mock-crm-api)   |
                                                        +-------------------------+
                                                                     |
                                                        +-------------------------+
                                                        | Deterministic In-Memory |
                                                        | Repository & Validation |
                                                        +-------------------------+
```

---

## 2. Monorepo Organization

The project is structured as an `npm` workspaces monorepo:

```
gym-whatsapp-helpdesk/
├── apps/
│   ├── api/                  # Main Helpdesk Express API & Adapter Proxy
│   └── mock-crm-api/         # Standalone Mock CRM REST API service
├── packages/
│   └── shared-types/         # Zero-dependency domain contracts & Zod schemas
├── tests/
│   ├── unit/                 # Unit tests (repository, validation, schemas)
│   ├── integration/          # Integration tests (HTTP adapter, API endpoints)
│   └── security/             # Security tests (isolation, RBAC, scope validation)
├── docs/                     # Comprehensive architectural documentation
└── .env.example              # Environment variable configuration template
```

---

## 3. The CRM Adapter Pattern

The integration layer enforces complete architectural decoupling between the Helpdesk application and external CRM implementations.

```typescript
export interface ICrmAdapter {
  checkHealth(): Promise<{ status: string; service: string; version: string }>;
  getTenantById(tenantId: string, identityKey?: string): Promise<Tenant>;
  listAccessibleTenants(filters?, page?, limit?, identityKey?): Promise<ApiResponse<Tenant[]>>;
  listBranchesByTenant(tenantId: string, filters?, page?, limit?, identityKey?): Promise<ApiResponse<Branch[]>>;
  getBranchById(branchId: string, identityKey?: string): Promise<Branch>;
  listEmployeesByTenant(tenantId: string, filters?, page?, limit?, identityKey?): Promise<ApiResponse<Employee[]>>;
  listEmployeesByBranch(branchId: string, filters?, page?, limit?, identityKey?): Promise<ApiResponse<Employee[]>>;
  getEmployeeById(employeeId: string, identityKey?: string): Promise<Employee>;
  listChatDesignations(tenantId: string, filters?, page?, limit?, identityKey?): Promise<ApiResponse<ChatDesignation[]>>;
  getChatDesignationById(designationId: string, identityKey?: string): Promise<ChatDesignation>;
  listEligibleChatAgents(branchId: string, identityKey?: string): Promise<EligibleChatAgent[]>;
  getCurrentIdentity(identityKey?: string): Promise<CurrentIdentityResponse>;
}
```

### Implementations:
1. **`MockCrmAdapter`**: Fast, lightweight in-memory implementation for unit testing and offline development.
2. **`HttpCrmAdapter`**: Resilient HTTP client that connects to `apps/mock-crm-api` (or a future real CRM API endpoint) with timeout management (`AbortController`), safe error mapping, and authentication header propagation.

### Swapping Adapters
Switching between adapters requires only toggling the `CRM_ADAPTER` environment variable (`mock` or `http`) without altering any helpdesk business logic.

---

## 4. Multi-Tenant Security & Isolation Model

1. **Super Admin Scope**: Global visibility across all tenants and branches; can access administrative simulation endpoints.
2. **Tenant Scoping**: All requests are tagged with the caller's tenant identity. Any request attempting to fetch branches, employees, or designations from a different tenant is rejected with `403 Forbidden` (`CROSS_TENANT_ACCESS_FORBIDDEN`).
3. **Branch Scoping**: Branch administrators and staff can only read records belonging to their assigned branch (`BRANCH_SCOPE_FORBIDDEN`).
4. **Development Auth Safety**: Mock identity headers (`x-mock-identity`) are strictly forbidden when `NODE_ENV=production`. If `MOCK_AUTH_ENABLED=true` is detected in a production build, the application aborts startup immediately.
