# Phase 3: Lead Assignment Engine — Technical Specification & Architecture

## 1. Overview

The **Lead Assignment Engine** automatically assigns incoming leads and conversations to eligible gym employees within the correct branch using a persistent, deterministic **Smooth Weighted Round-Robin (SWRR)** or cyclic **Round-Robin** distribution strategy.

The engine integrates helpdesk operational state stored in Supabase with master employee, branch, tenant, and designation records owned by the external CRM.

---

## 2. Architecture & Component Separation

```
[ Inbound Lead / Conversation ]
             │
             ▼
┌────────────────────────────────────────────────────────┐
│               REST API Controller Layer                │
│ (leads.route, conversations.route, branches.route)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Caller Context (Identity Key)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   AssignmentService                    │
│  - Caller Tenant/Branch Scope Validation               │
│  - Ownership Retention Evaluation                      │
│  - Idempotency & Repeat Detection                     │
│  - Audit Log Event Dispatch                            │
└────────┬──────────────────┬───────────────────┬────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌──────────────────┐┌──────────────────┐┌──────────────────┐
│  EligibleAgent   ││  AssignmentRepo  ││ AssignmentState- │
│     Resolver     ││ (Branch Lock     ││   gies (SWRR &   │
│  - CRM Adapter   ││  Promise Mutex)  ││   Round-Robin)   │
│  - AgentSettings ││  - Active Rules  ││  - Smooth WRR    │
│  - Designations  ││  - State Storage ││  - Deterministic │
└──────────────────┘│  - Audit Ledger  ││  - Reconcile     │
                    └──────────────────┘└──────────────────┘
```

### Component Responsibilities:
1. **AssignmentService (`apps/api/src/services/assignment/assignment.service.ts`)**:
   Coordinates the assignment lifecycle, checks caller authority, retains existing eligible owners, handles fallbacks, records audit history, and manages idempotent responses.
2. **EligibleAgentResolver (`apps/api/src/services/assignment/resolvers/eligible-agent.resolver.ts`)**:
   Queries branch employees and designations from the CRM adapter, queries agent settings from Supabase, and filters candidates according to strict eligibility rules.
3. **SmoothWeightedRoundRobinStrategy (`apps/api/src/services/assignment/strategies/weighted-round-robin.strategy.ts`)**:
   Pure deterministic algorithm implementing Nginx-style Smooth Weighted Round-Robin with dynamic candidate reconciliation and deterministic tie-breaking.
4. **AssignmentRepository (`apps/api/src/repositories/assignment.repository.ts`)**:
   Handles Supabase persistence for `chat_assignment_rules`, `chat_assignment_state`, and `assignment_audit`, wrapped in an atomic in-process promise-chaining FIFO mutex (`BranchAssignmentMutex`).

---

## 3. Weighted Round-Robin Algorithm (SWRR)

The system implements the **Smooth Weighted Round-Robin (SWRR)** algorithm (popularized by Nginx) rather than naive modulus or randomized selection.

### 3.1 Algorithm Mechanics
Each agent $i$ has:
- `weight` ($w_i > 0$): Configured integer assignment weight.
- `currentWeight` ($cw_i$): Dynamic state tracking accumulated eligibility.
- $W = \sum w_i$: Total weight of all eligible agents.

For each assignment selection step:
1. **State Reconciliation**: If the set of eligible agents has changed (agents added, removed, or weights altered), existing `currentWeight` values are preserved for retained agents, initialized to 0 for new agents, and pruned for removed agents.
2. **Current Weight Increment**: Every agent's `currentWeight` is incremented by their configured `weight`:
   $$cw_i \leftarrow cw_i + w_i$$
3. **Maximum Selection**: The agent with the highest `currentWeight` is chosen.
   - *Deterministic Tie-Breaking*: If two agents have identical `currentWeight`, the candidate with the lexicographically smaller `employeeId` wins.
4. **Selected Weight Decrement**: The selected agent's `currentWeight` is reduced by the total weight $W$:
   $$cw_{\text{selected}} \leftarrow cw_{\text{selected}} - W$$
5. **Persistence**: The updated `currentWeights` and `totalWeight` are persisted to `chat_assignment_state`.

### 3.2 Concrete Example: Weights 1, 2, 1
Consider three eligible agents:
- **Agent A**: Weight = 1 (25% expected share)
- **Agent B**: Weight = 2 (50% expected share)
- **Agent C**: Weight = 1 (25% expected share)
- Total Weight $W = 4$

Initial state: $cw = \{A: 0, B: 0, C: 0\}$.

| Round | Add Weights ($cw + w$) | Highest $cw$ (Selected) | Deduct Total ($cw - 4$) | End-of-Round State |
|:---:|:---|:---:|:---|:---|
| **1** | A: 1, **B: 2**, C: 1 | **Agent B** (cw=2) | B: $2 - 4 = -2$ | `{A: 1, B: -2, C: 1}` |
| **2** | **A: 2**, B: 0, C: 2 | **Agent A** (tie cw=2, smaller ID) | A: $2 - 4 = -2$ | `{A: -2, B: 0, C: 2}` |
| **3** | A: -1, **B: 2**, C: 3 | **Agent C** (cw=3) | C: $3 - 4 = -1$ | `{A: -1, B: 2, C: -1}` |
| **4** | A: 0, **B: 4**, C: 0 | **Agent B** (cw=4) | B: $4 - 4 = 0$ | `{A: 0, B: 0, C: 0}` |

**Result over 4 assignments**:
- Agent A: 1 assignment (25%)
- Agent B: 2 assignments (50%)
- Agent C: 1 assignment (25%)
- State smoothly resets to `{0, 0, 0}`, ensuring seamless continuity over infinite cycles without grouping or clustering.

---

## 4. Agent Eligibility Criteria

An employee is eligible to receive assignments **only** if all seven criteria are met simultaneously:

1. **CRM Branch Alignment**: Employee exists and belongs to the exact `tenantId` and `branchId` in the CRM.
2. **CRM Chat Support Flag**: Employee record in CRM has `chatSupportEligible: true`.
3. **CRM Active Status**: Employee status in CRM is `'active'`.
4. **Helpdesk Setting Enabled**: Employee has a corresponding `chat_agent_settings` record in Supabase with `is_eligible = true`.
5. **Positive Assignment Weight**: `assignment_weight > 0` (agents with weight 0 never receive assignments).
6. **Valid Active Designation**: Employee's CRM designation belongs to the tenant and is not marked inactive.
7. **Rule Exclusion Check**: Employee ID is not listed in `chat_assignment_rules.configuration.excludedEmployeeIds`.

---

## 5. State Persistence Schema

State is stored in the Supabase PostgreSQL table `chat_assignment_state`:

| Column | Type | Description |
|:---|:---|:---|
| `id` | `uuid` (PK) | Unique record identifier |
| `tenant_id` | `uuid` | Scoped tenant ID |
| `branch_id` | `uuid` | Scoped branch ID |
| `rule_id` | `uuid` | Foreign key referencing `chat_assignment_rules` |
| `strategy` | `text` | Strategy name (`weighted_round_robin` or `round_robin`) |
| `last_assigned_employee_id` | `uuid` | ID of the agent selected in the previous assignment |
| `cursor_state` | `jsonb` | Persistent state dictionary (`currentWeights`, `weights`, `totalWeight`, `currentIndex`) |
| `updated_at` | `timestamptz` | Timestamp of last assignment operation |

Unique constraint `chat_assignment_state_tenant_branch_unique` guarantees exactly one state row per branch.

---

## 6. Ownership Retention & Reassignment Rules

### 6.1 New Leads
When a lead has no existing assignment:
- Selected via branch active assignment rule.
- Lead metadata updated: `assignedEmployeeId = selectedAgent.id`.
- Audit event recorded: `reason = 'NEW_LEAD_ASSIGNMENT'`.

### 6.2 Returning Leads
When a lead is submitted for assignment again:
- **Owner Retained**: If the lead already has an assigned employee and that employee is **still eligible** in the branch:
  - The existing owner is retained.
  - The SWRR state is **NOT** advanced (does not consume another turn).
  - Audit event recorded: `reason = 'OWNER_RETAINED'`, `isRetained = true`.
- **Owner Ineligible**: If the existing owner is no longer active or eligible:
  - Reassignment occurs through the branch assignment rule.
  - Audit event recorded: `reason = 'OWNER_INELIGIBLE'`, `previousEmployeeId = oldOwnerId`.
- **Manual Force Reassign**: If requested with `{ forceReassign: true }`:
  - Existing owner is replaced via current distribution.
  - Audit event recorded: `reason = 'MANUAL_REASSIGNMENT'`.

### 6.3 Conversations
- If the conversation's parent lead has an eligible owner, that owner is assigned to the conversation.
- If unassigned, the conversation is assigned via branch rule.
- Duplicate assignment requests return the existing assignment idempotently.

### 6.4 No Eligible Agents
If no agents in the branch meet all eligibility criteria:
- Lead/conversation remains unassigned (`assignedEmployeeId = null`).
- Status set to `unassigned`, `unassignedReason = 'NO_ELIGIBLE_AGENTS'`.
- No artificial, fallback, or cross-branch employee is assigned.
- Authorized administrators can update agent eligibility and call the assign endpoint again (`reason = 'RETRY_ASSIGNMENT'`).

---

## 7. Concurrency Safety & Mutex Locking

To prevent race conditions where simultaneous incoming webhooks corrupt the round-robin distribution:
- **`BranchAssignmentMutex`**: An in-process, promise-chaining FIFO lock keyed on `${tenantId}:${branchId}` guarantees sequential, serialized execution of:
  1. Reading persistent assignment state.
  2. Resolving eligible candidates.
  3. Executing strategy selection.
  4. Updating database state.
  5. Writing the audit record.
- If any step fails, subsequent requests in the queue execute cleanly without deadlock.

---

## 8. API Endpoints

### 8.1 Assign a Lead
`POST /api/v1/leads/:id/assign`
- **Request Body**:
  ```json
  {
    "forceReassign": false
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "data": {
      "leadId": "11111111-0001-4000-a000-000000000001",
      "tenantId": "11111111-1111-4000-8000-000000000001",
      "branchId": "11111111-2222-4000-8000-000000000001",
      "assigned": true,
      "assignedEmployeeId": "e1111111-0001-4000-8000-000000000001",
      "assignedEmployeeName": "Aarav Sharma",
      "strategy": "weighted_round_robin",
      "reason": "NEW_LEAD_ASSIGNMENT",
      "weightsSnapshot": {
        "e1111111-0001-4000-8000-000000000001": 15,
        "e1111111-0002-4000-8000-000000000002": 10
      },
      "isRetained": false
    }
  }
  ```

### 8.2 Assign a Conversation
`POST /api/v1/conversations/:id/assign`
- **Request Body**:
  ```json
  {
    "forceReassign": false
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "data": {
      "conversationId": "c0000000-0000-4000-8000-000000000001",
      "leadId": "11111111-0001-4000-a000-000000000001",
      "tenantId": "11111111-1111-4000-8000-000000000001",
      "branchId": "11111111-2222-4000-8000-000000000001",
      "assigned": true,
      "assignedEmployeeId": "e1111111-0001-4000-8000-000000000001",
      "assignedEmployeeName": "Aarav Sharma",
      "strategy": "weighted_round_robin",
      "reason": "OWNER_RETAINED",
      "isRetained": true
    }
  }
  ```

### 8.3 Preview Branch Assignment
`POST /api/v1/branches/:branchId/assignment/preview`
- Non-destructive prediction of the next agent without mutating persistent state.
- **Response** (HTTP 200):
  ```json
  {
    "data": {
      "tenantId": "11111111-1111-4000-8000-000000000001",
      "branchId": "11111111-2222-4000-8000-000000000001",
      "strategy": "weighted_round_robin",
      "ruleConfiguration": {},
      "eligibleAgents": [
        {
          "employeeId": "e1111111-0001-4000-8000-000000000001",
          "fullName": "Aarav Sharma",
          "email": "aarav.sharma@tenantalpha.example.com",
          "designationId": "11111111-4444-4000-8000-000000000001",
          "designationName": "Senior Sales Executive",
          "assignmentWeight": 15
        }
      ],
      "predictedEmployeeId": "e1111111-0001-4000-8000-000000000001",
      "predictedEmployeeName": "Aarav Sharma"
    }
  }
  ```

### 8.4 Extended Agent Settings Endpoints
- `GET /api/v1/branches/:branchId/agent-settings/eligible`: Lists currently resolved eligible agents for a branch.
- `GET /api/v1/branches/:branchId/assignment/rule`: Returns active rule details.
- `PATCH /api/v1/agent-settings/:id`: Updates agent assignment weight and eligibility (restricted to Tenant/Branch Admin and Super Admin).

---

## 9. Security & Authorization

All assignment actions enforce caller boundaries:
- **Super Admin**: Global access across all tenants and branches.
- **Tenant Admin**: Restricted to their own `tenantId`; cannot read or assign entities in other tenants.
- **Branch Admin**: Restricted to their own `tenantId` and authorized `branchId`; cannot assign entities in other branches.
- **Employee**: Cannot view or modify branch assignment settings or weights.
- Attempts to cross boundaries throw `AssignmentTenantScopeError` (403) or `AssignmentBranchScopeError` (403).

---

## 10. Automated Test Results

| Test Suite | Total Tests | Passed | Failed |
|:---|:---:|:---:|:---:|
| Unit: `weighted-round-robin.test.ts` | 11 | 11 | 0 |
| Unit: `eligible-agent-resolver.test.ts` | 4 | 4 | 0 |
| Integration: `lead-assignment.test.ts` | 9 | 9 | 0 |
| Integration: `assignment-concurrency.test.ts` | 2 | 2 | 0 |
| Integration: `phase1-3-e2e.test.ts` | 7 | 7 | 0 |
| Security: `assignment-security.test.ts` | 8 | 8 | 0 |
| Phase 1 & 2 Existing Suites | 102 | 102 | 0 |
| **Monorepo Total** | **143** | **143** | **0** |
