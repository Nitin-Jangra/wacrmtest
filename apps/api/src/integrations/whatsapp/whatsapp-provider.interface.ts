export interface SendTextMessageParams {
  phoneNumberId: string;
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface SendTextMessageResult {
  messageId: string;
}

export interface IWhatsAppProvider {
  /**
   * Sends an outbound text message via WhatsApp Cloud API.
   */
  sendTextMessage(params: SendTextMessageParams): Promise<SendTextMessageResult>;

  /**
   * Validates the x-hub-signature-256 header against the raw incoming request payload.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean;
}
