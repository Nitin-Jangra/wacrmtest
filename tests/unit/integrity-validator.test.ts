import { describe, it, expect } from 'vitest';
import { IntegrityValidator } from '../../apps/mock-crm-api/src/repositories/integrity.validator';
import {
  FIXTURE_TENANTS,
  FIXTURE_BRANCHES,
  FIXTURE_EMPLOYEES,
  FIXTURE_DESIGNATIONS,
  TENANT_BETA_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { Employee } from '@gym-helpdesk/shared-types';

describe('IntegrityValidator Unit Tests', () => {
  it('should validate standard fixtures without errors', () => {
    const result = IntegrityValidator.validateDataset(
      FIXTURE_TENANTS,
      FIXTURE_BRANCHES,
      FIXTURE_EMPLOYEES,
      FIXTURE_DESIGNATIONS,
    );
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject when an employee is in a branch belonging to another tenant', () => {
    const corruptedEmployees: Employee[] = [
      {
        ...FIXTURE_EMPLOYEES[0]!,
        tenantId: TENANT_BETA_ID, // Employee is set to Beta, but their branch belongs to Alpha
      },
    ];

    const result = IntegrityValidator.validateDataset(
      FIXTURE_TENANTS,
      FIXTURE_BRANCHES,
      corruptedEmployees,
      FIXTURE_DESIGNATIONS,
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Cross-tenant violation'))).toBe(true);
  });

  it('should reject when an employee is assigned a designation from another tenant', () => {
    // Tenant Alpha employee assigned a Beta designation
    const betaDesignation = FIXTURE_DESIGNATIONS.find((d) => d.tenantId === TENANT_BETA_ID)!;
    const corruptedEmployees: Employee[] = [
      {
        ...FIXTURE_EMPLOYEES[0]!,
        designationId: betaDesignation.id,
      },
    ];

    const result = IntegrityValidator.validateDataset(
      FIXTURE_TENANTS,
      FIXTURE_BRANCHES,
      corruptedEmployees,
      FIXTURE_DESIGNATIONS,
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Cross-tenant designation violation'))).toBe(true);
  });

  it('should forbid assigning inactive designations to employees', () => {
    const employee = FIXTURE_EMPLOYEES[0]!;
    const inactiveDesignation = FIXTURE_DESIGNATIONS.find(
      (d) => d.tenantId === employee.tenantId && d.status === 'inactive',
    )!;

    const check = IntegrityValidator.canAssignDesignation(employee, inactiveDesignation);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Inactive designations cannot be newly assigned');
  });

  it('should forbid assigning cross-tenant designations in canAssignDesignation', () => {
    const employee = FIXTURE_EMPLOYEES[0]!; // Tenant Alpha
    const betaDesignation = FIXTURE_DESIGNATIONS.find((d) => d.tenantId === TENANT_BETA_ID)!;

    const check = IntegrityValidator.canAssignDesignation(employee, betaDesignation);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Designation belongs to a different tenant');
  });
});
