export class AssignmentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = 'ASSIGNMENT_ERROR',
    statusCode: number = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AssignmentError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AssignmentRuleNotFoundError extends AssignmentError {
  constructor(message: string = 'No active assignment rule configured for this branch') {
    super(message, 'ASSIGNMENT_RULE_NOT_FOUND', 422);
  }
}

export class AssignmentAuthorizationError extends AssignmentError {
  constructor(message: string = 'You are not authorized to perform assignment operations in this scope') {
    super(message, 'ASSIGNMENT_FORBIDDEN', 403);
  }
}

export class AssignmentTenantScopeError extends AssignmentError {
  constructor(message: string = 'Cross-tenant assignment access is strictly forbidden') {
    super(message, 'CROSS_TENANT_ACCESS_FORBIDDEN', 403);
  }
}

export class AssignmentBranchScopeError extends AssignmentError {
  constructor(message: string = 'Cross-branch assignment access is strictly forbidden') {
    super(message, 'BRANCH_SCOPE_FORBIDDEN', 403);
  }
}
