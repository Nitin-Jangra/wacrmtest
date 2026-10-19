export class WhatsAppProviderError extends Error {
  public readonly statusCode = 502;
  public readonly code = 'WHATSAPP_PROVIDER_ERROR';

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'WhatsAppProviderError';
    Object.setPrototypeOf(this, WhatsAppProviderError.prototype);
  }
}

export class WhatsAppSignatureVerificationError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'WHATSAPP_INVALID_SIGNATURE';

  constructor(message: string = 'Invalid or missing Meta x-hub-signature-256 webhook signature') {
    super(message);
    this.name = 'WhatsAppSignatureVerificationError';
    Object.setPrototypeOf(this, WhatsAppSignatureVerificationError.prototype);
  }
}

export class WhatsAppChannelNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = 'WHATSAPP_CHANNEL_NOT_FOUND';

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppChannelNotFoundError';
    Object.setPrototypeOf(this, WhatsAppChannelNotFoundError.prototype);
  }
}

export class WhatsAppChannelInactiveError extends Error {
  public readonly statusCode = 422;
  public readonly code = 'WHATSAPP_CHANNEL_INACTIVE';

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppChannelInactiveError';
    Object.setPrototypeOf(this, WhatsAppChannelInactiveError.prototype);
  }
}

export class WhatsAppInvalidRecipientError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'WHATSAPP_INVALID_RECIPIENT';

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppInvalidRecipientError';
    Object.setPrototypeOf(this, WhatsAppInvalidRecipientError.prototype);
  }
}

export class WhatsAppWebhookVerificationError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'WEBHOOK_VERIFY_TOKEN_MISMATCH';

  constructor(message: string = 'Webhook verification token does not match') {
    super(message);
    this.name = 'WhatsAppWebhookVerificationError';
    Object.setPrototypeOf(this, WhatsAppWebhookVerificationError.prototype);
  }
}

export class WhatsAppBadRequestError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'BAD_REQUEST';

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppBadRequestError';
    Object.setPrototypeOf(this, WhatsAppBadRequestError.prototype);
  }
}
