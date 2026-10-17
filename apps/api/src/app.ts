import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { corsOrigins } from './config';
import { healthRouter } from './modules/health/health.route';
import { crmProxyRouter } from './modules/crm-proxy/crm-proxy.route';
import { channelsRouter } from './modules/channels/channels.route';
import { agentSettingsRouter } from './modules/agent-settings/agent-settings.route';
import { leadsRouter } from './modules/leads/leads.route';
import { conversationsRouter } from './modules/conversations/conversations.route';
import { followUpsRouter } from './modules/follow-ups/follow-ups.route';
import { webhookEventsRouter } from './modules/webhook-events/webhook-events.route';
import { errorHandler } from './middleware/error.middleware';

export function createHelpdeskApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. Restrictive CORS Allowlist
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin "${origin}" not allowed by policy`));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-mock-identity'],
    }),
  );

  // 3. Body parser
  app.use(express.json({ limit: '100kb' }));

  // 4. Health module
  app.use('/health', healthRouter);

  // 5. CRM Proxy module
  app.use('/api/v1/crm', crmProxyRouter);

  // 6. Helpdesk Database-backed Modules
  app.use('/api/v1/channels', channelsRouter);
  app.use('/api/v1/agent-settings', agentSettingsRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/conversations', conversationsRouter);
  app.use('/api/v1/follow-ups', followUpsRouter);
  app.use('/api/v1/webhook-events', webhookEventsRouter);

  // 7. 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      },
    });
  });

  // 8. Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createHelpdeskApp();
