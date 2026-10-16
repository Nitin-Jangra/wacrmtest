import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/mock-crm-api/src/app';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  ALPHA_BRANCH_NOIDA_ID,
  FIXTURE_EMPLOYEES,
  FIXTURE_DESIGNATIONS,
  FIXTURE_BRANCHES,
  FIXTURE_TENANTS,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { IntegrityValidator } from '../../apps/mock-crm-api/src/repositories/integrity.validator';
import { mockAuthMiddleware } from '../../apps/mock-crm-api/src/middleware/auth.middleware';
import { Request, Response } from 'express';

describe('Security & Multi-Tenant Isolation Tests', () => {
  // Test 1: Tenant Alpha cannot read Tenant Beta's employees
  it('1. Tenant Alpha cannot read Tenant Beta employees', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${TENANT_BETA_ID}/employees`)
      .set('x-mock-identity', 'alpha_admin');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
    expect(res.body.data).toBeUndefined(); // no record leakage
  });

  // Test 2: Tenant Alpha cannot read Tenant Beta's branches
  it('2. Tenant Alpha cannot read Tenant Beta branches', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${TENANT_BETA_ID}/branches`)
      .set('x-mock-identity', 'alpha_admin');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
    expect(res.body.data).toBeUndefined();
  });

  // Test 3: A branch admin cannot access another branch without authorization
  it('3. A branch admin cannot access another branch outside their assigned branch', async () => {
    // alpha_branch_admin is assigned to ALPHA_BRANCH_GREATER_NOIDA_ID
    // Attempts to access ALPHA_BRANCH_NOIDA_ID
    const res = await request(app)
      .get(`/api/v1/branches/${ALPHA_BRANCH_NOIDA_ID}`)
      .set('x-mock-identity', 'alpha_branch_admin');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_SCOPE_FORBIDDEN');
  });

  // Test 4: An employee cannot access unauthorized administrative endpoints
  it('4. An employee cannot access endpoints requiring employees:manage permission', async () => {
    // alpha_employee lacks tenants:read (can only read branch/employees for their branch)
    const res = await request(app).get('/api/v1/tenants').set('x-mock-identity', 'alpha_employee');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  // Test 5: A designation from Tenant Beta cannot be associated with a Tenant Alpha employee
  it('5. A designation from Tenant Beta cannot be associated with a Tenant Alpha employee', () => {
    const alphaEmployee = FIXTURE_EMPLOYEES.find((e) => e.tenantId === TENANT_ALPHA_ID)!;
    const betaDesignation = FIXTURE_DESIGNATIONS.find((d) => d.tenantId === TENANT_BETA_ID)!;

    // Check validator rejection
    const check = IntegrityValidator.canAssignDesignation(alphaEmployee, betaDesignation);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Designation belongs to a different tenant');

    // Check full dataset integrity rejection
    const corruptedEmployees = [
      {
        ...alphaEmployee,
        designationId: betaDesignation.id,
      },
    ];
    const datasetCheck = IntegrityValidator.validateDataset(
      FIXTURE_TENANTS,
      FIXTURE_BRANCHES,
      corruptedEmployees,
      FIXTURE_DESIGNATIONS,
    );
    expect(datasetCheck.isValid).toBe(false);
    expect(datasetCheck.errors.some((e) => e.includes('Cross-tenant designation violation'))).toBe(
      true,
    );
  });

  // Test 6: Malformed IDs are rejected
  it('6. Malformed IDs are rejected with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/tenants/invalid-uuid-1234')
      .set('x-mock-identity', 'super_admin');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  // Test 7: Missing identities are rejected
  it('7. Missing identities are rejected with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/tenants');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_IDENTITY');
  });

  // Test 8: Invalid development identity headers are rejected
  it('8. Invalid development identity headers are rejected with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/tenants').set('x-mock-identity', 'hacker_role');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_IDENTITY');
  });

  // Test 9: Production mode refuses to enable mock authentication
  it('9. Production mode refuses to enable mock authentication', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req = {
      headers: { 'x-mock-identity': 'super_admin' },
    } as unknown as Request;
    const res = {} as Response;
    const next = () => {};

    // Mock config check or authMiddleware guard
    expect(() => {
      // Simulate production guard in middleware
      mockAuthMiddleware(req, res, next);
    }).toThrow();

    process.env.NODE_ENV = origEnv;
  });

  // Test 10: Unauthorized requests do not leak record details
  it('10. Unauthorized requests do not leak record details', async () => {
    // Beta admin attempts to access Alpha employee
    const alphaEmployeeId = 'e1111111-0001-4000-8000-000000000001';
    const res = await request(app)
      .get(`/api/v1/employees/${alphaEmployeeId}`)
      .set('x-mock-identity', 'beta_admin');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS_FORBIDDEN');
    // Ensure no employee data is leaked in body
    expect(res.body.data).toBeUndefined();
    expect(res.body.error.details).toBeUndefined();
  });
});
