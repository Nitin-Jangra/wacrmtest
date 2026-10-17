import { Router, Request, Response, NextFunction } from 'express';
import { CreateChannelSchema, UuidSchema } from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';

export const channelsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/channels
channelsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateChannelSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);
    const channel = await helpdeskService.createChannel(
      {
        tenantId: body.tenantId,
        branchId: body.branchId,
        provider: body.provider,
        phoneNumberId: body.phoneNumberId ?? null,
        wabaId: body.wabaId ?? null,
        displayName: body.displayName,
        status: body.status,
        credentialReference: body.credentialReference ?? null,
        configuration: body.configuration,
      },
      identityKey,
    );
    res.status(201).json({ data: channel });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/channels
channelsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    const channels = await helpdeskService.listChannels(tenantId, branchId);
    res.status(200).json({ data: channels });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/channels/:id
channelsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const channel = await helpdeskService.getChannelById(id);
    res.status(200).json({ data: channel });
  } catch (err) {
    next(err);
  }
});
