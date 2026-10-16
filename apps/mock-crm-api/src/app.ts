import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { corsOrigins } from './config';
import { healthRouter } from './routes/health.route';
import { meRouter } from './routes/me.route';
import { tenantsRouter } from './routes/tenants.route';
import { branchesRouter } from './routes/branches.route';
import { employeesRouter } from './routes/employees.route';
import { designationsRouter } from './routes/designations.route';
import { mockAuthMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { NotFoundError } from './errors/app.errors';

export function createMockCrmApp(): Express {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. Restrictive CORS Allowlist
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, vitest)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin "${origin}" not allowed by policy`));
      },
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-mock-identity'],
    }),
  );

  // 3. Request parsing with body size limit
  app.use(express.json({ limit: '100kb' }));

  // 4. Public Health Check
  app.use('/health', healthRouter);

  // 5. Protected Mock CRM Routes (/api/v1)
  const apiV1Router = express.Router();
  apiV1Router.use(mockAuthMiddleware);

  apiV1Router.use('/me', meRouter);
  apiV1Router.use('/tenants', tenantsRouter);
  apiV1Router.use('/branches', branchesRouter);
  apiV1Router.use('/employees', employeesRouter);
  apiV1Router.use('/chat-designations', designationsRouter);

  app.use('/api/v1', apiV1Router);

  // 6. 404 Handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createMockCrmApp();
