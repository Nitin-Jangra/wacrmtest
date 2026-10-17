import { Router, Request, Response, NextFunction } from 'express';
import { CreateAgentSettingSchema, UuidSchema } from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';

export const agentSettingsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/agent-settings
agentSettingsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateAgentSettingSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);
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

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    const settings = await helpdeskService.listAgentSettings(tenantId, branchId);
    res.status(200).json({ data: settings });
  } catch (err) {
    next(err);
  }
});
