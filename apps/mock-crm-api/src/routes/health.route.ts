import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'mock-crm-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
