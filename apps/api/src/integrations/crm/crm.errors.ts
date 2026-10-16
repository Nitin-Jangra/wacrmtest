export class CrmError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = 'CRM_ERROR',
    statusCode: number = 502,
    details?: unknown,
  ) {
    super(message);
    this.name = 'CrmError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CrmAuthenticationError extends CrmError {
  constructor(message: string = 'CRM service authentication failed') {
    super(message, 'CRM_AUTHENTICATION_ERROR', 401);
  }
}

export class CrmAuthorizationError extends CrmError {
  constructor(message: string = 'CRM access forbidden for current identity scope') {
    super(message, 'CRM_AUTHORIZATION_ERROR', 403);
  }
}

export class CrmNotFoundError extends CrmError {
  constructor(message: string = 'Requested CRM entity not found') {
    super(message, 'CRM_NOT_FOUND', 404);
  }
}

export class CrmTimeoutError extends CrmError {
  constructor(message: string = 'CRM service request timed out') {
    super(message, 'CRM_TIMEOUT', 504);
  }
}

export class CrmUpstreamError extends CrmError {
  constructor(message: string = 'CRM upstream server responded with an error', details?: unknown) {
    super(message, 'CRM_UPSTREAM_ERROR', 502, details);
  }
}
