import {
  MetaWhatsAppWebhookPayload,
  MetaWhatsAppMessage,
  MetaWhatsAppStatus,
  DeliveryStatus,
} from '@gym-helpdesk/shared-types';
import { config } from '../../config';
import {
  IWhatsAppProvider,
  getWhatsAppProvider,
} from '../../integrations/whatsapp';
import {
  WhatsAppWebhookVerificationError,
  WhatsAppBadRequestError,
} from '../../integrations/whatsapp/whatsapp.errors';
import { HelpdeskRepository, helpdeskRepository } from '../../repositories/helpdesk.repository';
import { WhatsAppChannelResolver, whatsappChannelResolver } from './whatsapp-channel.resolver';
import { AssignmentService, assignmentService } from '../assignment/assignment.service';
import { canTransitionStatus, mapMetaDeliveryStatus } from './delivery-status-mapper';

export class WhatsAppWebhookService {
  private verifyToken: string = config.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  constructor(
    private provider: IWhatsAppProvider = getWhatsAppProvider(),
    private readonly repo: HelpdeskRepository = helpdeskRepository,
    private readonly channelResolver: WhatsAppChannelResolver = whatsappChannelResolver,
    private readonly assignService: AssignmentService = assignmentService,
  ) {}

  public setProvider(provider: IWhatsAppProvider): void {
    this.provider = provider;
  }

  public setVerifyToken(token: string): void {
    this.verifyToken = token;
  }

  /**
   * Validates the Meta Webhook Verification handshake (GET /api/v1/webhooks/whatsapp).
   */
  public verifySubscription(
    mode?: string,
    token?: string,
    challenge?: string,
  ): string {
    if (mode !== 'subscribe') {
      throw new WhatsAppBadRequestError('hub.mode must be "subscribe"');
    }

    if (!challenge) {
      throw new WhatsAppBadRequestError('hub.challenge is required');
    }

    if (token !== this.verifyToken) {
      throw new WhatsAppWebhookVerificationError(
        'Webhook subscription handshake failed: Invalid verification token',
      );
    }

    return challenge;
  }

  /**
   * Verifies the x-hub-signature-256 header using the active provider.
   */
  public verifySignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    return this.provider.verifyWebhookSignature(rawBody, signatureHeader);
  }

  /**
   * Main processor for incoming Meta WhatsApp Cloud API webhooks.
   */
  public async processWebhook(
    payload: MetaWhatsAppWebhookPayload,
  ): Promise<{ processedMessages: number; processedStatuses: number }> {
    let processedMessages = 0;
    let processedStatuses = 0;

    if (payload.object !== 'whatsapp_business_account' || !payload.entry) {
      return { processedMessages: 0, processedStatuses: 0 };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        // 1. Process Inbound Messages
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            await this.processIncomingMessage(msg, phoneNumberId, value.contacts);
            processedMessages++;
          }
        }

        // 2. Process Delivery-Status Updates
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await this.processDeliveryStatus(status, phoneNumberId);
            processedStatuses++;
          }
        }
      }
    }

    return { processedMessages, processedStatuses };
  }

  /**
   * Handles a single inbound WhatsApp message.
   */
  private async processIncomingMessage(
    msg: MetaWhatsAppMessage,
    phoneNumberId: string,
    contacts?: Array<{ profile: { name: string }; wa_id: string }>,
  ): Promise<void> {
    const externalEventId = msg.id;

    // Idempotency Check: Has this message already been processed?
    const existingEvent = await this.repo.getWebhookEvent('meta_whatsapp', externalEventId);
    if (existingEvent && (existingEvent.processingStatus === 'completed' || existingEvent.processingStatus === 'processing')) {
      return;
    }

    // Resolve sender channel
    const channel = await this.channelResolver.findActiveChannel(phoneNumberId);
    if (!channel) {
      // Channel unknown or inactive: record as ignored/failed and exit safely
      if (!existingEvent) {
        await this.repo.recordWebhookEvent({
          provider: 'meta_whatsapp',
          externalEventId,
          tenantId: null,
          channelId: null,
          eventType: 'message',
          processingStatus: 'ignored',
          errorCode: 'CHANNEL_INACTIVE_OR_UNKNOWN',
        });
      }
      return;
    }

    // Record webhook event as processing
    let eventRecord = existingEvent;
    if (!eventRecord) {
      eventRecord = await this.repo.recordWebhookEvent({
        provider: 'meta_whatsapp',
        externalEventId,
        tenantId: channel.tenantId,
        channelId: channel.id,
        eventType: 'message',
        processingStatus: 'processing',
        errorCode: null,
      });
    }

    try {
      const senderPhone = msg.from;
      const contactInfo = contacts?.find((c) => c.wa_id === senderPhone || senderPhone.includes(c.wa_id));
      const senderName = contactInfo?.profile?.name || senderPhone;

      // 1. Find or create Lead
      let lead = await this.repo.findLeadByPhoneOrExternalId(
        channel.tenantId,
        channel.branchId,
        senderPhone,
      );

      if (!lead) {
        lead = await this.repo.createLead({
          tenantId: channel.tenantId,
          branchId: channel.branchId,
          name: senderName,
          phoneNumber: senderPhone,
          externalContactId: senderPhone,
          email: null,
          source: 'whatsapp',
          metadata: {
            channelId: channel.id,
            phoneNumberId,
          },
        });
      }

      // 2. Find or create Conversation
      let conversation = await this.repo.findActiveConversation(
        channel.tenantId,
        channel.branchId,
        lead.id,
        channel.id,
      );

      if (!conversation) {
        conversation = await this.repo.createConversation({
          tenantId: channel.tenantId,
          branchId: channel.branchId,
          leadId: lead.id,
          channelId: channel.id,
          assignedEmployeeId: (lead.metadata?.assignedEmployeeId as string) || null,
          status: 'open',
        });
      }

      // 3. Persist Inbound Message
      const supportedTypes = ['text', 'image', 'document', 'audio', 'video', 'location', 'template'];
      const isSupportedType = supportedTypes.includes(msg.type);
      const resolvedMessageType = isSupportedType ? (msg.type as any) : 'document';
      const messageBody = msg.text?.body || (msg.type !== 'text' ? `[${msg.type.toUpperCase()}]` : null);

      await this.repo.createMessage({
        tenantId: channel.tenantId,
        branchId: channel.branchId,
        conversationId: conversation.id,
        externalMessageId: msg.id,
        direction: 'inbound',
        messageType: resolvedMessageType,
        body: messageBody,
        payload: msg as Record<string, unknown>,
        deliveryStatus: 'delivered',
      });

      // Update conversation lastMessageAt
      await this.repo.updateConversation(conversation.id, {
        lastMessageAt: new Date().toISOString(),
      });

      // 4. Trigger Phase 3 Assignment Engine
      // Reuses SWRR, retains eligible owners, updates state & audit trail
      await this.assignService.assignLead(lead.id, {});

      // 5. Mark webhook event as completed
      await this.repo.updateWebhookEvent(eventRecord.id, {
        processingStatus: 'completed',
        processedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      await this.repo.updateWebhookEvent(eventRecord.id, {
        processingStatus: 'failed',
        errorCode: err.message || 'PROCESSING_ERROR',
        processedAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  /**
   * Handles a delivery status update from WhatsApp (sent, delivered, read, failed).
   */
  private async processDeliveryStatus(
    status: MetaWhatsAppStatus,
    _phoneNumberId?: string,
  ): Promise<void> {
    const statusEventId = `${status.id}:${status.status}`;

    // Idempotency check for status
    const existingEvent = await this.repo.getWebhookEvent('meta_whatsapp', statusEventId);
    if (existingEvent && existingEvent.processingStatus === 'completed') {
      return;
    }

    const message = await this.repo.getMessageByExternalId(status.id);
    if (!message) {
      // Message might not belong to this instance or was sent out of band
      if (!existingEvent) {
        await this.repo.recordWebhookEvent({
          provider: 'meta_whatsapp',
          externalEventId: statusEventId,
          tenantId: null,
          channelId: null,
          eventType: 'status',
          processingStatus: 'ignored',
          errorCode: 'MESSAGE_NOT_FOUND',
        });
      }
      return;
    }

    const newStatus: DeliveryStatus = mapMetaDeliveryStatus(status.status);
    const updates: any = {};

    // Monotonic status progression check
    if (canTransitionStatus(message.deliveryStatus, newStatus)) {
      updates.deliveryStatus = newStatus;

      const timestampIso = status.timestamp
        ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString()
        : new Date().toISOString();

      if (newStatus === 'sent' && !message.sentAt) updates.sentAt = timestampIso;
      if (newStatus === 'delivered' && !message.deliveredAt) updates.deliveredAt = timestampIso;
      if (newStatus === 'read') updates.readAt = timestampIso;
      if (newStatus === 'failed') {
        updates.payload = {
          ...message.payload,
          deliveryFailure: status.errors || status,
        };
      }

      await this.repo.updateMessage(message.id, updates);
    }

    // Record webhook event as completed
    if (existingEvent) {
      await this.repo.updateWebhookEvent(existingEvent.id, {
        processingStatus: 'completed',
        processedAt: new Date().toISOString(),
      });
    } else {
      await this.repo.recordWebhookEvent({
        provider: 'meta_whatsapp',
        externalEventId: statusEventId,
        tenantId: message.tenantId,
        channelId: null,
        eventType: 'status',
        processingStatus: 'completed',
        errorCode: null,
      });
    }
  }
}

export const whatsappWebhookService = new WhatsAppWebhookService();
