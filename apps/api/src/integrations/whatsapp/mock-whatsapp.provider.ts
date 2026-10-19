import crypto from 'crypto';
import {
  IWhatsAppProvider,
  SendTextMessageParams,
  SendTextMessageResult,
} from './whatsapp-provider.interface';
import {
  WhatsAppProviderError,
  WhatsAppInvalidRecipientError,
} from './whatsapp.errors';

export type MockProviderMode = 'success' | 'rejection' | 'network_failure' | 'invalid_recipient' | 'provider_rejection';

export interface SentMessageRecord {
  params: SendTextMessageParams;
  result: SendTextMessageResult;
  sentAt: Date;
}

export class MockWhatsAppProvider implements IWhatsAppProvider {
  public mode: MockProviderMode = 'success';
  public appSecret: string = 'dev-app-secret';
  public sentMessages: SentMessageRecord[] = [];
  public simulateInvalidSignature: boolean = false;

  constructor(options?: { appSecret?: string; mode?: MockProviderMode } | string) {
    if (typeof options === 'string') {
      this.appSecret = options;
    } else if (options) {
      if (options.appSecret) this.appSecret = options.appSecret;
      if (options.mode) this.mode = options.mode;
    }
  }

  public setMode(mode: MockProviderMode): void {
    this.mode = mode;
  }

  public setErrorMode(mode: MockProviderMode): void {
    this.setMode(mode);
  }

  public clearSentMessages(): void {
    this.sentMessages = [];
  }

  public getSentMessages(): any[] {
    return this.sentMessages.map((s) => ({
      ...s.params,
      messageId: s.result.messageId,
      sentAt: s.sentAt,
    }));
  }

  /**
   * Static helper to generate a valid Meta x-hub-signature-256 with any secret.
   */
  public static generateSignature(rawBody: Buffer | string, secret: string): string {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return `sha256=${hash}`;
  }

  /**
   * Simulates sending a message.
   */
  public async sendTextMessage(params: SendTextMessageParams): Promise<SendTextMessageResult> {
    if (this.mode === 'invalid_recipient' || !params.to || !params.to.trim()) {
      throw new WhatsAppInvalidRecipientError(`Mock: Recipient phone number "${params.to}" is invalid`);
    }

    if (this.mode === 'rejection' || this.mode === 'provider_rejection') {
      throw new WhatsAppProviderError('Mock Meta API Error: Message recipient is not in allowed test contacts', {
        code: 131030,
        type: 'OAuthException',
      });
    }

    if (this.mode === 'network_failure') {
      throw new WhatsAppProviderError('Mock Network Error: connect ETIMEDOUT graph.facebook.com:443');
    }

    const messageId = `wamid.HBgL${Math.random().toString(36).substring(2, 10).toUpperCase()}==`;
    const result: SendTextMessageResult = { messageId };

    this.sentMessages.push({
      params: { ...params },
      result,
      sentAt: new Date(),
    });

    return result;
  }

  /**
   * Helper to generate a valid Meta x-hub-signature-256 for a payload buffer/string.
   */
  public generateSignature(rawBody: Buffer | string): string {
    const hash = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');
    return `sha256=${hash}`;
  }

  /**
   * Validates signature using appSecret.
   */
  public verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (this.simulateInvalidSignature) {
      return false;
    }

    if (!signatureHeader || !this.appSecret) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const receivedHash = parts[1]!;
    const expectedHash = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    if (receivedHash.length !== expectedHash.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
    } catch {
      return false;
    }
  }

  public verifySignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    return this.verifyWebhookSignature(rawBody, signatureHeader);
  }
}

export const mockWhatsAppProvider = new MockWhatsAppProvider();
