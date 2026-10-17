export class DatabaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    statusCode: number = 500,
    details?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DatabaseConfigurationError extends DatabaseError {
  constructor(
    message: string = 'Supabase staging database is not configured. In-memory fallback is strictly disabled.',
  ) {
    super(message, 'DATABASE_NOT_CONFIGURED', 503);
  }
}

export class DatabaseConstraintError extends DatabaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_CONSTRAINT_VIOLATION', 400, details);
  }
}

export class DatabaseNotFoundError extends DatabaseError {
  constructor(message: string = 'Database entity not found') {
    super(message, 'DATABASE_RECORD_NOT_FOUND', 404);
  }
}
