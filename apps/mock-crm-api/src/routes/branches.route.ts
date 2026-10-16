import { Router, Request, Response, NextFunction } from 'express';
import { UuidSchema, EmployeeFilterQuerySchema } from '@gym-helpdesk/shared-types';
import { crmService } from '../services/crm.service';
import { requirePermission, enforceBranchScope } from '../middleware/authorize.middleware';

export const branchesRouter = Router();

// GET /api/v1/branches/:branchId
branchesRouter.get(
  '/:branchId',
  requirePermission('branches:read'),
  enforceBranchScope((req) => req.params.branchId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const branch = await crmService.getBranchById(req.identity!, branchId);
      res.status(200).json({ data: branch });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/branches/:branchId/employees
branchesRouter.get(
  '/:branchId/employees',
  requirePermission('employees:read'),
  enforceBranchScope((req) => req.params.branchId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const query = EmployeeFilterQuerySchema.parse(req.query);
      const result = await crmService.listEmployeesByBranch(
        req.identity!,
        branchId,
        {
          status: query.status,
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

// GET /api/v1/branches/:branchId/chat-agents
branchesRouter.get(
  '/:branchId/chat-agents',
  requirePermission('chat_agents:read'),
  enforceBranchScope((req) => req.params.branchId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const agents = await crmService.listEligibleChatAgents(req.identity!, branchId);
      res.status(200).json({ data: agents });
    } catch (err) {
      next(err);
    }
  },
);
