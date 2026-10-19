import { Router, Request, Response, NextFunction } from 'express';
import { UuidSchema } from '@gym-helpdesk/shared-types';
import { assignmentService } from '../../services/assignment/assignment.service';
import { assignmentRepository } from '../../repositories/assignment.repository';
import { eligibleAgentResolver } from '../../services/assignment/resolvers/eligible-agent.resolver';
import { AssignmentRuleNotFoundError } from '../../services/assignment/assignment.errors';

export const branchesRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/branches/:branchId/assignment/preview
branchesRouter.post(
  '/:branchId/assignment/preview',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const identityKey = getCallerIdentityKey(req);
      const preview = await assignmentService.previewAssignment(branchId, identityKey);
      res.status(200).json({ data: preview });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/branches/:branchId/assignment/rule
branchesRouter.get(
  '/:branchId/assignment/rule',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const identityKey = getCallerIdentityKey(req);

      const crm = assignmentService.getCrmAdapter();
      const branch = await crm.getBranchById(branchId, identityKey);
      await assignmentService.validateCallerScope(branch.tenantId, branch.id, identityKey);

      const rule = await assignmentRepository.getActiveRule(branch.tenantId, branch.id);
      if (!rule) {
        throw new AssignmentRuleNotFoundError(
          `No active assignment rule configured for branch "${branchId}" or tenant fallback`,
        );
      }

      res.status(200).json({ data: rule });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/branches/:branchId/agent-settings/eligible
branchesRouter.get(
  '/:branchId/agent-settings/eligible',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = UuidSchema.parse(req.params.branchId);
      const identityKey = getCallerIdentityKey(req);

      const crm = assignmentService.getCrmAdapter();
      const branch = await crm.getBranchById(branchId, identityKey);
      await assignmentService.validateCallerScope(branch.tenantId, branch.id, identityKey);

      const rule = await assignmentRepository.getActiveRule(branch.tenantId, branch.id);
      const excludedIds = (rule?.configuration?.excludedEmployeeIds as string[]) || [];

      const eligibleAgents = await eligibleAgentResolver.resolveEligibleAgents(
        branch.tenantId,
        branch.id,
        { identityKey, excludedEmployeeIds: excludedIds },
      );

      res.status(200).json({ data: eligibleAgents });
    } catch (err) {
      next(err);
    }
  },
);
