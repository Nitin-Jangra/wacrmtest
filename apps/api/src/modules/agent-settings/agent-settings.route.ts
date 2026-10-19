import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateAgentSettingSchema,
  UpdateAgentSettingSchema,
  UuidSchema,
} from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';
import { assignmentService } from '../../services/assignment/assignment.service';
import { eligibleAgentResolver } from '../../services/assignment/resolvers/eligible-agent.resolver';
import { assignmentRepository } from '../../repositories/assignment.repository';
import {
  AssignmentAuthorizationError,
  AssignmentTenantScopeError,
  AssignmentBranchScopeError,
} from '../../services/assignment/assignment.errors';

export const agentSettingsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

async function verifyAdminCaller(
  tenantId: string,
  branchId: string,
  identityKey?: string,
): Promise<void> {
  if (!identityKey) return;

  const crm = assignmentService.getCrmAdapter();
  const { identity } = await crm.getCurrentIdentity(identityKey);

  // Employees cannot modify branch-wide settings
  if (identity.role === 'employee') {
    throw new AssignmentAuthorizationError(
      'Ordinary employees are not authorized to configure or modify branch assignment settings',
    );
  }

  // Super Admin has global access
  if (identity.role === 'super_admin' || identity.tenantId === null) {
    return;
  }

  // Cross-tenant check
  if (identity.tenantId !== tenantId) {
    throw new AssignmentTenantScopeError(
      `Access denied: Caller tenant ${identity.tenantId} does not match entity tenant ${tenantId}`,
    );
  }

  // Branch admin check
  if (
    identity.role === 'branch_admin' &&
    identity.branchId !== null &&
    identity.branchId !== branchId
  ) {
    throw new AssignmentBranchScopeError(
      `Access denied: Caller branch ${identity.branchId} does not match entity branch ${branchId}`,
    );
  }
}

// GET /api/v1/agent-settings/eligible
agentSettingsRouter.get('/eligible', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;
    const identityKey = getCallerIdentityKey(req);

    if (!tenantId || !branchId) {
      res.status(400).json({
        error: {
          code: 'MISSING_QUERY',
          message: 'Both tenantId and branchId query parameters are required',
        },
      });
      return;
    }

    await verifyAdminCaller(tenantId, branchId, identityKey);

    const rule = await assignmentRepository.getActiveRule(tenantId, branchId);
    const excludedIds = (rule?.configuration?.excludedEmployeeIds as string[]) || [];

    const agents = await eligibleAgentResolver.resolveEligibleAgents(tenantId, branchId, {
      identityKey,
      excludedEmployeeIds: excludedIds,
    });

    res.status(200).json({ data: agents });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/agent-settings
agentSettingsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateAgentSettingSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);

    await verifyAdminCaller(body.tenantId, body.branchId, identityKey);

    const setting = await helpdeskService.configureAgentSetting(
      {
        tenantId: body.tenantId,
        branchId: body.branchId,
        employeeId: body.employeeId,
        designationId: body.designationId ?? null,
        isEligible: body.isEligible,
        assignmentWeight: body.assignmentWeight,
      },
      identityKey,
    );
    res.status(200).json({ data: setting });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/agent-settings
agentSettingsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;
    const identityKey = getCallerIdentityKey(req);

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    if (branchId) {
      await verifyAdminCaller(tenantId, branchId, identityKey);
    } else if (identityKey) {
      const { identity } = await assignmentService.getCrmAdapter().getCurrentIdentity(identityKey);
      if (identity.role !== 'super_admin' && identity.tenantId && identity.tenantId !== tenantId) {
        throw new AssignmentTenantScopeError(
          `Access denied: Caller tenant ${identity.tenantId} does not match requested tenant ${tenantId}`,
        );
      }
    }

    const settings = await helpdeskService.listAgentSettings(tenantId, branchId);
    res.status(200).json({ data: settings });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/agent-settings/:id
agentSettingsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const body = UpdateAgentSettingSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);

    const existing = await helpdeskService.getAgentSettingById(id);
    await verifyAdminCaller(existing.tenantId, existing.branchId, identityKey);

    const updated = await helpdeskService.updateAgentSetting(id, body, identityKey);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});
