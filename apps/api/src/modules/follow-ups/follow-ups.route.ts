import { Router, Request, Response, NextFunction } from 'express';
import { CreateFollowUpSchema, UpdateFollowUpSchema, UuidSchema } from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';

export const followUpsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/follow-ups
followUpsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateFollowUpSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);
    const followUp = await helpdeskService.scheduleFollowUp(
      {
        tenantId: body.tenantId,
        branchId: body.branchId,
        conversationId: body.conversationId,
        assignedEmployeeId: body.assignedEmployeeId,
        scheduledAt: body.scheduledAt,
        status: body.status,
        note: body.note ?? null,
      },
      identityKey,
    );
    res.status(201).json({ data: followUp });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/follow-ups
followUpsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;
    const conversationId = req.query.conversationId ? UuidSchema.parse(req.query.conversationId) : undefined;
    const assignedEmployeeId = req.query.assignedEmployeeId
      ? UuidSchema.parse(req.query.assignedEmployeeId)
      : undefined;
    const status = req.query.status as string | undefined;

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    const followUps = await helpdeskService.listFollowUps(
      tenantId,
      branchId,
      status,
      conversationId,
      assignedEmployeeId,
    );
    res.status(200).json({ data: followUps });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/follow-ups/:id
followUpsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const body = UpdateFollowUpSchema.parse(req.body);
    const updated = await helpdeskService.updateFollowUp(id, body);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});
