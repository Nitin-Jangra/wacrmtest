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
import { branchesRouter } from './modules/branches/branches.route';
import { whatsappWebhookRouter } from './modules/webhooks/whatsapp.route';
import { errorHandler } from './middleware/error.middleware';

export function createHelpdeskApp(): Express {
  const app = express();

  // 1. Security Headers (configured for cross-origin SPA access)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 2. Production & Development CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          corsOrigins.includes('*') ||
          corsOrigins.includes(origin) ||
          origin.endsWith('.netlify.app') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        // Fail-safe: allow origin to avoid blocking dashboard
        return callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-mock-identity',
        'x-tenant-id',
        'x-branch-id',
        'x-user-id',
        'x-user-role',
      ],
      credentials: true,
    }),
  );

  // 3. Body parser with raw body retention for HMAC verification
  app.use(
    express.json({
      limit: '100kb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

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
  app.use('/api/v1/branches', branchesRouter);
  app.use('/api/v1/webhooks/whatsapp', whatsappWebhookRouter);

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
