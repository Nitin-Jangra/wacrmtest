import { WhatsAppChannel } from '@gym-helpdesk/shared-types';
import { HelpdeskRepository, helpdeskRepository } from '../../repositories/helpdesk.repository';
import {
  WhatsAppChannelNotFoundError,
  WhatsAppChannelInactiveError,
} from '../../integrations/whatsapp/whatsapp.errors';

export class WhatsAppChannelResolver {
  constructor(private readonly repo: HelpdeskRepository = helpdeskRepository) {}

  /**
   * Resolves a WhatsApp channel by its Meta phone_number_id.
   * Throws WhatsAppChannelNotFoundError if not found.
   * Throws WhatsAppChannelInactiveError if found but not active.
   */
  public async resolveActiveChannel(phoneNumberId: string): Promise<WhatsAppChannel> {
    if (!phoneNumberId || !phoneNumberId.trim()) {
      throw new WhatsAppChannelNotFoundError(`Missing or empty phone_number_id`);
    }

    const channel = await this.repo.getChannelByPhoneNumberId(phoneNumberId.trim());
    if (!channel) {
      throw new WhatsAppChannelNotFoundError(
        `No WhatsApp channel registered for phone_number_id: "${phoneNumberId}"`,
      );
    }

    if (channel.status !== 'active') {
      throw new WhatsAppChannelInactiveError(
        `WhatsApp channel "${channel.id}" (${channel.displayName}) is currently "${channel.status}", not active`,
      );
    }

    return channel;
  }

  /**
   * Safe lookup that returns null instead of throwing when channel is missing or inactive.
   */
  public async findActiveChannel(phoneNumberId: string): Promise<WhatsAppChannel | null> {
    try {
      return await this.resolveActiveChannel(phoneNumberId);
    } catch {
      return null;
    }
  }
}

export const whatsappChannelResolver = new WhatsAppChannelResolver();
