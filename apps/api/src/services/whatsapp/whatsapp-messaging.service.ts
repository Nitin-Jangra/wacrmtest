import { Message } from '@gym-helpdesk/shared-types';
import {
  IWhatsAppProvider,
  getWhatsAppProvider,
} from '../../integrations/whatsapp';
import {
  WhatsAppChannelNotFoundError,
  WhatsAppChannelInactiveError,
  WhatsAppInvalidRecipientError,
} from '../../integrations/whatsapp/whatsapp.errors';
import { HelpdeskRepository, helpdeskRepository } from '../../repositories/helpdesk.repository';
import { AssignmentService, assignmentService } from '../assignment/assignment.service';
import { DatabaseNotFoundError } from '../../database/database.errors';

export class WhatsAppMessagingService {
  constructor(
    private provider: IWhatsAppProvider = getWhatsAppProvider(),
    private readonly repo: HelpdeskRepository = helpdeskRepository,
    private readonly assignService: AssignmentService = assignmentService,
  ) {}

  public setProvider(provider: IWhatsAppProvider): void {
    this.provider = provider;
  }

  public getProvider(): IWhatsAppProvider {
    return this.provider;
  }

  /**
   * Sends an outbound text message to a conversation's customer over WhatsApp.
   */
  public async sendTextMessage(
    conversationId: string,
    text: string,
    identityKey?: string,
  ): Promise<Message> {
    if (!text || !text.trim()) {
      throw new Error('Message text cannot be empty');
    }

    // 1. Fetch conversation
    const conversation = await this.repo.getConversationById(conversationId);
    if (!conversation) {
      throw new DatabaseNotFoundError(`Conversation with ID "${conversationId}" not found`);
    }

    // 2. Authorize caller scope
    await this.assignService.validateCallerScope(
      conversation.tenantId,
      conversation.branchId,
      identityKey,
    );

    // 3. Resolve channel
    const channel = await this.repo.getChannelById(conversation.channelId);
    if (!channel) {
      throw new WhatsAppChannelNotFoundError(
        `Channel "${conversation.channelId}" associated with conversation not found`,
      );
    }

    if (channel.status !== 'active') {
      throw new WhatsAppChannelInactiveError(
        `WhatsApp channel "${channel.id}" (${channel.displayName}) is inactive`,
      );
    }

    if (!channel.phoneNumberId) {
      throw new WhatsAppChannelNotFoundError(
        `WhatsApp channel "${channel.id}" has no phone_number_id configured`,
      );
    }

    // 4. Resolve recipient lead
    const lead = await this.repo.getLeadById(conversation.leadId);
    if (!lead) {
      throw new DatabaseNotFoundError(`Lead "${conversation.leadId}" not found`);
    }

    const recipientPhone = lead.phoneNumber || lead.externalContactId;
    if (!recipientPhone) {
      throw new WhatsAppInvalidRecipientError(
        `Lead "${lead.id}" has no valid phone number or external contact ID`,
      );
    }

    // 5. Persist outbound message as 'pending'
    const message = await this.repo.createMessage({
      tenantId: conversation.tenantId,
      branchId: conversation.branchId,
      conversationId: conversation.id,
      externalMessageId: null,
      direction: 'outbound',
      messageType: 'text',
      body: text.trim(),
      payload: {},
      deliveryStatus: 'pending',
    });

    // 6. Send message through provider client
    try {
      const sendResult = await this.provider.sendTextMessage({
        phoneNumberId: channel.phoneNumberId,
        to: recipientPhone,
        text: text.trim(),
      });

      // 7. Update message with provider message ID and sent status
      const updatedMessage = await this.repo.updateMessage(message.id, {
        externalMessageId: sendResult.messageId,
        deliveryStatus: 'sent',
        sentAt: new Date().toISOString(),
      });

      // 8. Update conversation lastMessageAt
      await this.repo.updateConversation(conversation.id, {
        lastMessageAt: new Date().toISOString(),
      });

      return updatedMessage;
    } catch (err: any) {
      // Record failure on message record
      await this.repo.updateMessage(message.id, {
        deliveryStatus: 'failed',
        payload: { sendError: err.message },
      });
      throw err;
    }
  }
}

export const whatsappMessagingService = new WhatsAppMessagingService();
