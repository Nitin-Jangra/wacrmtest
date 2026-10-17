import { Router, Request, Response, NextFunction } from 'express';
import { CreateLeadSchema, PaginationQuerySchema, UuidSchema } from '@gym-helpdesk/shared-types';
import { helpdeskService } from '../../services/helpdesk.service';

export const leadsRouter = Router();

function getCallerIdentityKey(req: Request): string | undefined {
  const header = req.headers['x-mock-identity'];
  return typeof header === 'string' ? header.trim() : undefined;
}

// POST /api/v1/leads
leadsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateLeadSchema.parse(req.body);
    const identityKey = getCallerIdentityKey(req);
    const lead = await helpdeskService.createLead(
      {
        tenantId: body.tenantId,
        branchId: body.branchId,
        externalContactId: body.externalContactId ?? null,
        name: body.name ?? null,
        phoneNumber: body.phoneNumber ?? null,
        email: body.email ?? null,
        source: body.source,
        metadata: body.metadata,
      },
      identityKey,
    );
    res.status(201).json({ data: lead });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leads
leadsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId ? UuidSchema.parse(req.query.tenantId) : undefined;
    const branchId = req.query.branchId ? UuidSchema.parse(req.query.branchId) : undefined;
    const query = PaginationQuerySchema.parse(req.query);

    if (!tenantId) {
      res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'tenantId query parameter is required' } });
      return;
    }

    const result = await helpdeskService.listLeads(tenantId, branchId, query.page, query.limit);
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

// GET /api/v1/leads/:id
leadsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const lead = await helpdeskService.getLeadById(id);
    res.status(200).json({ data: lead });
  } catch (err) {
    next(err);
  }
});
