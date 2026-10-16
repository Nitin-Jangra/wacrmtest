import { Request, Response, NextFunction } from 'express';
import { MockIdentityKey } from '@gym-helpdesk/shared-types';
import { MOCK_IDENTITIES } from '../data/identities';
import { UnauthorizedError, ForbiddenError } from '../errors/app.errors';
import { config } from '../config';

export function mockAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Hard stop if somehow invoked in production mode
  if (
    process.env.NODE_ENV === 'production' ||
    config.NODE_ENV === 'production' ||
    !config.MOCK_AUTH_ENABLED
  ) {
    throw new ForbiddenError(
      'Mock authentication is strictly disabled in production environments.',
      'MOCK_AUTH_DISABLED',
    );
  }

  // 1. Check for x-mock-identity header
  const headerVal = req.headers['x-mock-identity'];
  const authHeader = req.headers['authorization'];

  let identityKey: MockIdentityKey | undefined;

  if (typeof headerVal === 'string' && headerVal.trim().length > 0) {
    identityKey = headerVal.trim() as MockIdentityKey;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === config.MOCK_CRM_SERVICE_TOKEN) {
      // Service-to-service call default or specified
      identityKey = 'super_admin';
    } else {
      throw new UnauthorizedError('Invalid service authorization token', 'INVALID_TOKEN');
    }
  }

  if (!identityKey) {
    throw new UnauthorizedError(
      'Missing development authentication. Please provide "x-mock-identity" header or Bearer token.',
      'MISSING_IDENTITY',
    );
  }

  const identity = MOCK_IDENTITIES[identityKey];

  if (!identity) {
    throw new UnauthorizedError(
      `Invalid development identity: "${identityKey}". Allowed identities: ${Object.keys(
        MOCK_IDENTITIES,
      ).join(', ')}`,
      'INVALID_IDENTITY',
    );
  }

  req.identity = identity;
  next();
}
