import { Router, Request, Response, NextFunction } from 'express';
import {
  UuidSchema,
  PaginationQuerySchema,
  EmployeeFilterQuerySchema,
  BranchFilterQuerySchema,
  DesignationFilterQuerySchema,
} from '@gym-helpdesk/shared-types';
import { crmAdapter } from '../../integrations/crm/crm-adapter.factory';

export const crmProxyRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const headerVal = req.headers['x-mock-identity'];
  return typeof headerVal === 'string' ? headerVal.trim() : undefined;
}

// GET /api/v1/crm/me
crmProxyRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identityKey = getCallerIdentityKey(req);
    const data = await crmAdapter.getCurrentIdentity(identityKey);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/crm/tenants
crmProxyRouter.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    const identityKey = getCallerIdentityKey(req);
    const result = await crmAdapter.listAccessibleTenants(
      undefined,
      query.page,
      query.limit,
      identityKey,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/crm/tenants/:tenantId
crmProxyRouter.get(
  '/tenants/:tenantId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const identityKey = getCallerIdentityKey(req);
      const tenant = await crmAdapter.getTenantById(tenantId, identityKey);
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/tenants/:tenantId/branches
crmProxyRouter.get(
  '/tenants/:tenantId/branches',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = BranchFilterQuerySchema.parse(req.query);
      const identityKey = getCallerIdentityKey(req);
      const result = await crmAdapter.listBranchesByTenant(
        tenantId,
        { status: query.status },
        query.page,
        query.limit,
        identityKey,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/branches/:branchId
crmProxyRouter.get(
  '/branches/:branchId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const identityKey = getCallerIdentityKey(req);
      const branch = await crmAdapter.getBranchById(branchId, identityKey);
      res.status(200).json({ data: branch });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/tenants/:tenantId/employees
crmProxyRouter.get(
  '/tenants/:tenantId/employees',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = EmployeeFilterQuerySchema.parse(req.query);
      const identityKey = getCallerIdentityKey(req);
      const result = await crmAdapter.listEmployeesByTenant(
        tenantId,
        {
          status: query.status,
          branchId: query.branchId,
          role: query.role,
          chatEligible: query.chatEligible,
        },
        query.page,
        query.limit,
        identityKey,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/branches/:branchId/employees
crmProxyRouter.get(
  '/branches/:branchId/employees',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const query = EmployeeFilterQuerySchema.parse(req.query);
      const identityKey = getCallerIdentityKey(req);
      const result = await crmAdapter.listEmployeesByBranch(
        branchId,
        {
          status: query.status,
          role: query.role,
          chatEligible: query.chatEligible,
        },
        query.page,
        query.limit,
        identityKey,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/employees/:employeeId
crmProxyRouter.get(
  '/employees/:employeeId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employeeId = UuidSchema.parse(req.params.employeeId);
      const identityKey = getCallerIdentityKey(req);
      const employee = await crmAdapter.getEmployeeById(employeeId, identityKey);
      res.status(200).json({ data: employee });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/tenants/:tenantId/chat-designations
crmProxyRouter.get(
  '/tenants/:tenantId/chat-designations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = UuidSchema.parse(req.params.tenantId);
      const query = DesignationFilterQuerySchema.parse(req.query);
      const identityKey = getCallerIdentityKey(req);
      const result = await crmAdapter.listChatDesignations(
        tenantId,
        { status: query.status },
        query.page,
        query.limit,
        identityKey,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/chat-designations/:designationId
crmProxyRouter.get(
  '/chat-designations/:designationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const designationId = UuidSchema.parse(req.params.designationId);
      const identityKey = getCallerIdentityKey(req);
      const desig = await crmAdapter.getChatDesignationById(designationId, identityKey);
      res.status(200).json({ data: desig });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/crm/branches/:branchId/chat-agents
crmProxyRouter.get(
  '/branches/:branchId/chat-agents',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const identityKey = getCallerIdentityKey(req);
      const agents = await crmAdapter.listEligibleChatAgents(branchId, identityKey);
      res.status(200).json({ data: agents });
    } catch (err) {
      next(err);
    }
  },
);
