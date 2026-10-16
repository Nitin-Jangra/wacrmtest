import { Router, Request, Response, NextFunction } from 'express';
import {
  UuidSchema,
  PaginationQuerySchema,
  EmployeeFilterQuerySchema,
  BranchFilterQuerySchema,
  DesignationFilterQuerySchema,
} from '@gym-helpdesk/shared-types';
import { crmService } from '../services/crm.service';
import { requirePermission, enforceTenantScope } from '../middleware/authorize.middleware';

export const tenantsRouter = Router();

// GET /api/v1/tenants
tenantsRouter.get(
  '/',
  requirePermission('tenants:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = PaginationQuerySchema.parse(req.query);
      const result = await crmService.listTenants(
        req.identity!,
        undefined,
        query.page,
        query.limit,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/tenants/:tenantId
tenantsRouter.get(
  '/:tenantId',
  requirePermission('tenants:read'),
  enforceTenantScope((req) => req.params.tenantId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const tenant = await crmService.getTenantById(req.identity!, tenantId);
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/tenants/:tenantId/branches
tenantsRouter.get(
  '/:tenantId/branches',
  requirePermission('branches:read'),
  enforceTenantScope((req) => req.params.tenantId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = BranchFilterQuerySchema.parse(req.query);
      const result = await crmService.listBranchesByTenant(
        req.identity!,
        tenantId,
        { status: query.status },
        query.page,
        query.limit,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/tenants/:tenantId/employees
tenantsRouter.get(
  '/:tenantId/employees',
  requirePermission('employees:read'),
  enforceTenantScope((req) => req.params.tenantId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = EmployeeFilterQuerySchema.parse(req.query);
      const result = await crmService.listEmployeesByTenant(
        req.identity!,
        tenantId,
        {
          status: query.status,
          branchId: query.branchId,
          role: query.role,
          chatEligible: query.chatEligible,
        },
        query.page,
        query.limit,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/tenants/:tenantId/chat-designations
tenantsRouter.get(
  '/:tenantId/chat-designations',
  requirePermission('designations:read'),
  enforceTenantScope((req) => req.params.tenantId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = DesignationFilterQuerySchema.parse(req.query);
      const result = await crmService.listDesignationsByTenant(
        req.identity!,
        tenantId,
        { status: query.status },
        query.page,
        query.limit,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
