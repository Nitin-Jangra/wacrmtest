import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateConversationSchema,
  CreateMessageSchema,
  PaginationQuerySchema,
  UuidSchema,
} from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';

export const conversationsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/conversations
conversationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateConversationSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);
    const conversation = await helpdeskService.createConversation(
      {
        tenantId: body.tenantId,
        branchId: body.branchId,
        leadId: body.leadId,
        channelId: body.channelId,
        assignedEmployeeId: body.assignedEmployeeId ?? null,
        status: body.status,
      },
      identityKey,
    );
    res.status(201).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations
conversationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;
    const status = req.query.status as string | undefined;
    const query = PaginationQuerySchema.parse(req.query);

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    const result = await helpdeskService.listConversations(tenantId, branchId, status, query.page, query.limit);
    res.status(200).json({
      data: result.data,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:id
conversationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const conversation = await helpdeskService.getConversationById(id);
    res.status(200).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/conversations/:id/messages
conversationsRouter.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = UuidSchema.parse(req.params.id);
    const body = CreateMessageSchema.parse(req.body);
    const message = await helpdeskService.addMessage(conversationId, {
      externalMessageId: body.externalMessageId ?? null,
      direction: body.direction,
      messageType: body.messageType,
      body: body.body ?? null,
      payload: body.payload,
      deliveryStatus: body.deliveryStatus,
    });
    res.status(201).json({ data: message });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:id/messages
conversationsRouter.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = UuidSchema.parse(req.params.id);
    const query = PaginationQuerySchema.parse(req.query);
    const result = await helpdeskService.listMessages(conversationId, query.page, query.limit);
    res.status(200).json({
      data: result.data,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:id/audit
conversationsRouter.get('/:id/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = UuidSchema.parse(req.params.id);
    const auditLogs = await helpdeskService.listAssignmentAudit(conversationId);
    res.status(200).json({ data: auditLogs });
  } catch (err) {
    next(err);
  }
});
