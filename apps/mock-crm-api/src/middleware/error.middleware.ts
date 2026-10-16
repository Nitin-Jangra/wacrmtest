import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.errors';
import { config } from '../config';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 1. Domain AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request parameter validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 3. JSON body parsing error
  if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
      },
    });
    return;
  }

  // 4. Default unhandled error
  const isProduction = config.NODE_ENV === 'production';
  const statusCode = 500;
  const message = isProduction ? 'An internal server error occurred' : err.message;

  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
