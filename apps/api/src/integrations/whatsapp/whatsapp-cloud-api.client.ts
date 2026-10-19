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

export interface WhatsAppCloudApiClientOptions {
  accessToken: string;
  appSecret: string;
  apiVersion?: string;
  baseUrl?: string;
}

export class WhatsAppCloudApiClient implements IWhatsAppProvider {
  private readonly accessToken: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  constructor(options: WhatsAppCloudApiClientOptions) {
    this.accessToken = options.accessToken;
    this.appSecret = options.appSecret;
    this.apiVersion = options.apiVersion || 'v21.0';
    this.baseUrl = (options.baseUrl || 'https://graph.facebook.com').replace(/\/+$/, '');
  }

  /**
   * Sends an outbound text message via WhatsApp Cloud API.
   * Endpoint: POST https://graph.facebook.com/{version}/{phoneNumberId}/messages
   */
  public async sendTextMessage(params: SendTextMessageParams): Promise<SendTextMessageResult> {
    if (!params.to || !params.to.trim()) {
      throw new WhatsAppInvalidRecipientError('Recipient phone number must not be empty');
    }

    const cleanTo = params.to.replace(/[^\d]/g, '');
    if (!cleanTo) {
      throw new WhatsAppInvalidRecipientError(`Invalid recipient phone number: "${params.to}"`);
    }

    const url = `${this.baseUrl}/${this.apiVersion}/${params.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: params.previewUrl ?? false,
        body: params.text,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        const errorDetail = data?.error?.message || response.statusText;
        const errorCode = data?.error?.code;
        throw new WhatsAppProviderError(
          `Meta WhatsApp Cloud API error (${response.status}): ${errorDetail}`,
          { errorCode, status: response.status, details: data?.error },
        );
      }

      const messageId = data?.messages?.[0]?.id;
      if (!messageId) {
        throw new WhatsAppProviderError('Meta API response missing message ID', data);
      }

      return { messageId };
    } catch (err: any) {
      if (err instanceof WhatsAppProviderError || err instanceof WhatsAppInvalidRecipientError) {
        throw err;
      }
      throw new WhatsAppProviderError(`Failed to send WhatsApp message: ${err.message}`, {
        originalError: err.message,
      });
    }
  }

  /**
   * Validates the x-hub-signature-256 header using timingSafeEqual to avoid timing attacks.
   */
  public verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
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
