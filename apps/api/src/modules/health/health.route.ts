import { Router, Request, Response } from 'express';
import { crmAdapter } from '../../integrations/crm/crm-adapter.factory';
import { checkDatabaseHealth } from '../../database/supabase.client';
import { config } from '../../config';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  let crmStatus: unknown = 'unreachable';
  try {
    crmStatus = await crmAdapter.checkHealth();
  } catch (err) {
    crmStatus = {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const databaseStatus = await checkDatabaseHealth();

  res.status(200).json({
    status: 'ok',
    service: 'gym-whatsapp-helpdesk-api',
    version: '1.0.0',
    crmAdapter: config.CRM_ADAPTER,
    downstreamCrm: crmStatus,
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});
