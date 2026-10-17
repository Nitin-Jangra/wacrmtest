import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { helpdeskService } from '../../services/helpdesk.service';

export const webhookEventsRouter = Router();

const RecordWebhookEventSchema = z.object({
  provider: z.string().default('meta_whatsapp'),
  externalEventId: z.string().min(1),
  tenantId: z.string().uuid().nullable().optional(),
  channelId: z.string().uuid().nullable().optional(),
  eventType: z.string().min(1),
  processingStatus: z.enum(['received', 'processing', 'completed', 'failed', 'ignored']).default('received'),
  errorCode: z.string().nullable().optional(),
});

// POST /api/v1/webhook-events
webhookEventsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RecordWebhookEventSchema.parse(req.body);
    const event = await helpdeskService.recordWebhookEvent({
      provider: body.provider,
      externalEventId: body.externalEventId,
      tenantId: body.tenantId || null,
      channelId: body.channelId || null,
      eventType: body.eventType,
      processingStatus: body.processingStatus,
      errorCode: body.errorCode || null,
    });
    res.status(200).json({ data: event });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/webhook-events/:provider/:externalEventId
webhookEventsRouter.get('/:provider/:externalEventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, externalEventId } = req.params;
    const event = await helpdeskService.getWebhookEvent(provider!, externalEventId!);
    if (!event) {
      res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Webhook event not found' } });
      return;
    }
    res.status(200).json({ data: event });
  } catch (err) {
    next(err);
  }
});
