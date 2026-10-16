# Testing Strategy & Verification Report

The test suite is built with [Vitest](https://vitest.dev) and [Supertest](https://github.com/ladjs/supertest). It verifies unit business logic, network roundtrips, and critical multi-tenant security guarantees.

---

## 1. Test Architecture

The tests are organized into three dedicated tiers:

```
tests/
├── unit/
│   ├── crm-repository.test.ts          # Deterministic data querying, pagination, role filtering
│   ├── uuid-validation.test.ts         # Zod parameter and query parsing
│   └── integrity-validator.test.ts     # Relational constraints and anti-corruption rules
├── integration/
│   ├── mock-crm-api.test.ts            # REST endpoints, error envelopes, and identity scopes
│   ├── http-crm-adapter.test.ts        # Network roundtrips, HTTP serialization, timeout & error mapping
│   └── api-crm-proxy.test.ts           # Main Helpdesk API consuming CRM data exclusively via adapter
└── security/
    └── security-tenant-isolation.test.ts # The 10 mandatory multi-tenant isolation tests
```

---

## 2. Test Execution Commands

Run all tests:
```bash
npm test
```

Run unit tests only:
```bash
npm run test:unit
```

Run integration tests only:
```bash
npm run test:integration
```

Run security tests only:
```bash
npm run test:security
```

---

## 3. The 10 Mandatory Security Tests

All 10 required security test scenarios are verified with automated tests:

1. **Cross-Tenant Employee Isolation**: Verified that `alpha_admin` cannot read employees from Tenant Beta (`CROSS_TENANT_ACCESS_FORBIDDEN`, HTTP 403).
2. **Cross-Tenant Branch Isolation**: Verified that `alpha_admin` cannot read branches from Tenant Beta (`CROSS_TENANT_ACCESS_FORBIDDEN`, HTTP 403).
3. **Branch Admin Scoping**: Verified that `alpha_branch_admin` (assigned to Greater Noida) cannot access Noida branch details (`BRANCH_SCOPE_FORBIDDEN`, HTTP 403).
4. **Administrative Endpoint Restriction**: Verified that `alpha_employee` cannot access global tenant listings (`INSUFFICIENT_PERMISSIONS`, HTTP 403).
5. **Cross-Tenant Designation Guard**: Verified that an employee cannot be assigned a designation from another tenant.
6. **Malformed Identifier Rejection**: Verified that non-UUID strings are rejected with HTTP 400 (`VALIDATION_ERROR`).
7. **Missing Identity Rejection**: Verified that requests missing authentication credentials return HTTP 401 (`MISSING_IDENTITY`).
8. **Invalid Mock Identity Rejection**: Verified that bogus identity keys (e.g., `hacker_role`) return HTTP 401 (`INVALID_IDENTITY`).
9. **Production Mode Safety Guard**: Verified that mock authentication refuses to activate when `NODE_ENV=production`.
10. **Data Leakage Prevention**: Verified that 401/403/404 responses do not leak data fields or stack traces.
