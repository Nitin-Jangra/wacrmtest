# Data Model & Deterministic Seed Dictionary

This document details the simulated CRM data hierarchy, entity specifications, relational constraints, and deterministic fixtures used for testing and staging.

---

## 1. CRM Hierarchy Overview

```
                      +-------------------+
                      |    Super Admin    |
                      +-------------------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
    +------------------+                  +------------------+
    |   Tenant Alpha   |                  |   Tenant Beta    |
    +------------------+                  +------------------+
             |                                     |
     +-------+-------+                     +-------+-------+
     |               |                     |               |
     v               v                     v               v
+----------+   +----------+           +----------+   +----------+
| Branch 1 |   | Branch 2 |           | Branch 1 |   | Branch 2 |
| Greater  |   |  Noida   |           |  Jaipur  |   | Gurugram |
|  Noida   |   |          |           |          |   |          |
+----------+   +----------+           +----------+   +----------+
     |               |                     |               |
 4 Employees     4 Employees           4 Employees     4 Employees
```

---

## 2. Entities & Schema Definitions

### Tenant

- `id` (UUID, Primary Key)
- `name` (string)
- `status` (`active` | `inactive`)
- `createdAt` (ISO 8601 string)
- `updatedAt` (ISO 8601 string)
- `metadata` (JSON Record)

### Branch

- `id` (UUID, Primary Key)
- `tenantId` (UUID, Foreign Key -> Tenant)
- `name` (string)
- `city` (string)
- `status` (`active` | `inactive`)
- `createdAt` / `updatedAt`

### Employee

- `id` (UUID, Primary Key)
- `tenantId` (UUID, Foreign Key -> Tenant)
- `branchId` (UUID, Foreign Key -> Branch)
- `fullName` (string)
- `email` (string, fictional `@example.com`)
- `status` (`active` | `inactive`)
- `crmRole` (`super_admin` | `tenant_admin` | `branch_admin` | `employee`)
- `chatSupportEligible` (boolean)
- `designationId` (UUID or null, Foreign Key -> ChatDesignation)
- `createdAt` / `updatedAt`

### ChatDesignation

- `id` (UUID, Primary Key)
- `tenantId` (UUID, Foreign Key -> Tenant)
- `name` (string)
- `description` (string)
- `status` (`active` | `inactive`)
- `createdAt` / `updatedAt`

---

## 3. Relational Integrity Rules

The `IntegrityValidator` enforces the following rules at startup and during test assertions:

1. **Branch Ownership**: Every branch belongs to exactly one existing tenant.
2. **Employee Tenant Match**: Every employee's tenant must match their assigned branch's tenant.
3. **Designation Tenant Match**: If an employee is assigned a designation, the designation must belong to the employee's tenant. Cross-tenant designation assignments are strictly prohibited.
4. **Chat Support Eligibility**: An employee can only be considered for chat support if `status === 'active'`, `chatSupportEligible === true`, and their assigned designation is active.
5. **Inactive Designation Guard**: Inactive designations cannot be newly assigned to agents.

---

## 4. Deterministic Seed Identifiers Dictionary

| Entity      | Name                     | ID                                     | Tenant | Status   |
| ----------- | ------------------------ | -------------------------------------- | ------ | -------- |
| Tenant      | Tenant Alpha             | `11111111-1111-4000-8000-000000000001` | Self   | active   |
| Tenant      | Tenant Beta              | `22222222-2222-4000-8000-000000000002` | Self   | active   |
| Branch      | Alpha — Greater Noida    | `aaaaaaaa-0001-4000-8000-000000000001` | Alpha  | active   |
| Branch      | Alpha — Noida            | `aaaaaaaa-0002-4000-8000-000000000002` | Alpha  | active   |
| Branch      | Beta — Jaipur            | `bbbbbbbb-0001-4000-8000-000000000001` | Beta   | active   |
| Branch      | Beta — Gurugram          | `bbbbbbbb-0002-4000-8000-000000000002` | Beta   | active   |
| Designation | Chat Support Executive   | `d1111111-0001-4000-8000-000000000001` | Alpha  | active   |
| Designation | Senior Chat Executive    | `d1111111-0002-4000-8000-000000000002` | Alpha  | active   |
| Designation | Chat Support Manager     | `d1111111-0003-4000-8000-000000000003` | Alpha  | inactive |
| Designation | Customer Care Agent      | `d2222222-0001-4000-8000-000000000001` | Beta   | active   |
| Designation | Sales Support Executive  | `d2222222-0002-4000-8000-000000000002` | Beta   | active   |
| Designation | Customer Success Manager | `d2222222-0003-4000-8000-000000000003` | Beta   | active   |

### Predefined Mock Identities

- `super_admin`: Global platform access.
- `alpha_admin`: Full access to Tenant Alpha.
- `alpha_branch_admin`: Restricted to Alpha — Greater Noida branch.
- `alpha_employee`: Staff member at Alpha — Greater Noida branch.
- `beta_admin`: Full access to Tenant Beta.
- `beta_branch_admin`: Restricted to Beta — Jaipur branch.
- `beta_employee`: Staff member at Beta — Jaipur branch.
