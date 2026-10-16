# API Contracts — Mock CRM API & Helpdesk CRM Proxy

All Mock CRM API routes are mounted under `/api/v1` and require development authentication (`x-mock-identity` header or service token Bearer header). The Helpdesk CRM Proxy endpoints are mounted under `/api/v1/crm` and forward the caller identity to the configured CRM adapter.

---

## 1. Request & Response Envelopes

### Standard Success Collection Envelope

```json
{
  "data": [{ "id": "11111111-1111-4000-8000-000000000001", "name": "Tenant Alpha" }],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Standard Single Entity Envelope

```json
{
  "data": {
    "id": "11111111-1111-4000-8000-000000000001",
    "name": "Tenant Alpha",
    "status": "active",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Standard Error Response Envelope

```json
{
  "error": {
    "code": "CROSS_TENANT_ACCESS_FORBIDDEN",
    "message": "Access denied: You are not authorized to view or access data belonging to another tenant."
  }
}
```

---

## 2. Endpoints Reference

### Health Check (Public)

- **`GET /health`**
  - **Auth**: None
  - **Response**: `{ "status": "ok", "service": "mock-crm-api", "version": "1.0.0" }`

### Current Identity Scope

- **`GET /api/v1/me`**
  - **Headers**: `x-mock-identity: <identity_key>`
  - **Response**:
    ```json
    {
      "data": {
        "identity": {
          "key": "alpha_admin",
          "userId": "e1111111-0005-4000-8000-000000000005",
          "name": "Rohan Mehta (Alpha Admin)",
          "role": "tenant_admin",
          "tenantId": "11111111-1111-4000-8000-000000000001",
          "branchId": null,
          "permissions": ["tenants:read", "branches:read", "employees:read", "designations:read"]
        },
        "scope": {
          "isSuperAdmin": false,
          "authorizedTenantId": "11111111-1111-4000-8000-000000000001",
          "authorizedBranchId": null,
          "allowedPermissions": [
            "tenants:read",
            "branches:read",
            "employees:read",
            "designations:read"
          ]
        }
      }
    }
    ```

### Tenants

- **`GET /api/v1/tenants`**
  - **Query**: `page` (default: 1), `limit` (default: 20)
  - **Scope**: Super Admin views all tenants; Tenant Admin / Branch Admin / Employee views only their authorized tenant.
- **`GET /api/v1/tenants/:tenantId`**
  - **Params**: `tenantId` (UUID)
  - **Errors**: `400 VALIDATION_ERROR` (malformed UUID), `403 CROSS_TENANT_ACCESS_FORBIDDEN` (different tenant), `404 NOT_FOUND` (unknown ID).

### Branches

- **`GET /api/v1/tenants/:tenantId/branches`**
  - **Params**: `tenantId` (UUID)
  - **Query**: `page`, `limit`, `status` (`active` | `inactive`)
- **`GET /api/v1/branches/:branchId`**
  - **Params**: `branchId` (UUID)
  - **Scope**: Must belong to caller's tenant; branch admins and employees can only access their assigned branch.

### Employees

- **`GET /api/v1/tenants/:tenantId/employees`**
  - **Params**: `tenantId` (UUID)
  - **Query**: `page`, `limit`, `status`, `branchId`, `role`, `chatEligible`
- **`GET /api/v1/branches/:branchId/employees`**
  - **Params**: `branchId` (UUID)
  - **Query**: `page`, `limit`, `status`, `role`, `chatEligible`
- **`GET /api/v1/employees/:employeeId`**
  - **Params**: `employeeId` (UUID)

### Chat Designations

- **`GET /api/v1/tenants/:tenantId/chat-designations`**
  - **Params**: `tenantId` (UUID)
  - **Query**: `page`, `limit`, `status`
- **`GET /api/v1/chat-designations/:designationId`**
  - **Params**: `designationId` (UUID)

### Eligible Chat Agents

- **`GET /api/v1/branches/:branchId/chat-agents`**
  - **Params**: `branchId` (UUID)
  - **Response**: Array of employees in that branch where `status === 'active'`, `chatSupportEligible === true`, and designation is active.
  ```json
  {
    "data": [
      {
        "employeeId": "e1111111-0001-4000-8000-000000000001",
        "tenantId": "11111111-1111-4000-8000-000000000001",
        "branchId": "aaaaaaaa-0001-4000-8000-000000000001",
        "fullName": "Aarav Sharma",
        "email": "aarav.sharma@example.com",
        "designationId": "d1111111-0002-4000-8000-000000000002",
        "designationName": "Senior Chat Executive",
        "eligibilityStatus": true,
        "employeeStatus": "active",
        "exampleAssignmentWeight": 10
      }
    ]
  }
  ```
