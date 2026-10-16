import { Tenant, Branch, Employee, ChatDesignation } from '@gym-helpdesk/shared-types';

export interface IntegrityValidationResult {
  isValid: boolean;
  errors: string[];
}

export class IntegrityValidator {
  /**
   * Validates relational integrity across the entire CRM fixture dataset.
   */
  public static validateDataset(
    tenants: Tenant[],
    branches: Branch[],
    employees: Employee[],
    designations: ChatDesignation[],
  ): IntegrityValidationResult {
    const errors: string[] = [];

    const tenantMap = new Map<string, Tenant>(tenants.map((t) => [t.id, t]));
    const branchMap = new Map<string, Branch>(branches.map((b) => [b.id, b]));
    const designationMap = new Map<string, ChatDesignation>(designations.map((d) => [d.id, d]));

    // 1. Every branch belongs to exactly one existing tenant
    for (const branch of branches) {
      if (!branch.tenantId || !tenantMap.has(branch.tenantId)) {
        errors.push(
          `Branch ${branch.id} (${branch.name}) references non-existent tenant ${branch.tenantId}`,
        );
      }
    }

    // 2. Every designation belongs to exactly one existing tenant
    for (const desig of designations) {
      if (!desig.tenantId || !tenantMap.has(desig.tenantId)) {
        errors.push(
          `Designation ${desig.id} (${desig.name}) references non-existent tenant ${desig.tenantId}`,
        );
      }
    }

    // 3. Every employee belongs to exactly one existing tenant
    // 4. Employee's branch must exist and belong to the same tenant
    // 5. If employee has designation, it must exist and belong to the same tenant
    for (const emp of employees) {
      if (!emp.tenantId || !tenantMap.has(emp.tenantId)) {
        errors.push(
          `Employee ${emp.id} (${emp.fullName}) references non-existent tenant ${emp.tenantId}`,
        );
        continue;
      }

      const branch = branchMap.get(emp.branchId);
      if (!branch) {
        errors.push(`Employee ${emp.id} references non-existent branch ${emp.branchId}`);
      } else if (branch.tenantId !== emp.tenantId) {
        errors.push(
          `Cross-tenant violation: Employee ${emp.id} belongs to tenant ${emp.tenantId} but branch ${branch.id} belongs to tenant ${branch.tenantId}`,
        );
      }

      if (emp.designationId) {
        const desig = designationMap.get(emp.designationId);
        if (!desig) {
          errors.push(
            `Employee ${emp.id} references non-existent designation ${emp.designationId}`,
          );
        } else if (desig.tenantId !== emp.tenantId) {
          errors.push(
            `Cross-tenant designation violation: Employee ${emp.id} (tenant ${emp.tenantId}) is assigned designation ${desig.id} belonging to tenant ${desig.tenantId}`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates whether an employee can be assigned a specific designation.
   */
  public static canAssignDesignation(
    employee: Employee,
    designation: ChatDesignation,
  ): { allowed: boolean; reason?: string } {
    if (employee.tenantId !== designation.tenantId) {
      return {
        allowed: false,
        reason: 'Designation belongs to a different tenant',
      };
    }
    if (designation.status !== 'active') {
      return {
        allowed: false,
        reason: 'Inactive designations cannot be newly assigned',
      };
    }
    return { allowed: true };
  }
}
