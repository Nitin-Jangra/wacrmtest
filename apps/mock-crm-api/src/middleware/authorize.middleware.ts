import { Request, Response, NextFunction } from 'express';
import { Permission } from '@gym-helpdesk/shared-types';
import { ForbiddenError, UnauthorizedError } from '../errors/app.errors';
import { mockCrmRepository } from '../repositories/crm.repository';

export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.identity) {
      throw new UnauthorizedError('Identity required for permission evaluation');
    }

    const userPermissions = new Set(req.identity.permissions);
    const hasAll = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      throw new ForbiddenError(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    next();
  };
}

export function enforceTenantScope(getTenantId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.identity) {
      throw new UnauthorizedError('Identity required for tenant scope verification');
    }

    // Super Admin has global tenant visibility
    if (req.identity.role === 'super_admin' || req.identity.tenantId === null) {
      next();
      return;
    }

    const targetTenantId = getTenantId(req);
    if (!targetTenantId) {
      next();
      return;
    }

    if (req.identity.tenantId !== targetTenantId) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to view or access data belonging to another tenant.',
        'CROSS_TENANT_ACCESS_FORBIDDEN',
      );
    }

    next();
  };
}

export function enforceBranchScope(getBranchId: (req: Request) => string | undefined) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.identity) {
        throw new UnauthorizedError('Identity required for branch scope verification');
      }

      // Super Admin has global branch access
      if (req.identity.role === 'super_admin' || req.identity.tenantId === null) {
        next();
        return;
      }

      const branchId = getBranchId(req);
      if (!branchId) {
        next();
        return;
      }

      const branch = await mockCrmRepository.getBranchById(branchId);
      if (!branch) {
        // We let the service handle 404 so we don't leak, or pass to service
        next();
        return;
      }

      // 1. Must belong to identity's tenant
      if (branch.tenantId !== req.identity.tenantId) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to view or access branches from another tenant.',
          'CROSS_TENANT_ACCESS_FORBIDDEN',
        );
      }

      // 2. If user is branch_admin or employee, they can only access their assigned branch
      if (
        (req.identity.role === 'branch_admin' || req.identity.role === 'employee') &&
        req.identity.branchId !== null &&
        req.identity.branchId !== branchId
      ) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to access branches outside your assigned branch scope.',
          'BRANCH_SCOPE_FORBIDDEN',
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
