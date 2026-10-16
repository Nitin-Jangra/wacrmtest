import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { CrmError } from '../integrations/crm/crm.errors';
import { config } from '../config';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 1. CRM Integration Errors
  if (err instanceof CrmError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 3. Fallback unhandled error
  const isProduction = config.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
