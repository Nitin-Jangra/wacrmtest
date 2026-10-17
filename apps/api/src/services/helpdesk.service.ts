import {
  WhatsAppChannel,
  ChatAgentSetting,
  Lead,
  Conversation,
  Message,
  FollowUp,
  AssignmentAudit,
  WebhookEvent,
} from '@gym-helpdesk/shared-types';
import { helpdeskRepository, HelpdeskRepository } from '../repositories/helpdesk.repository';
import { crmAdapter } from '../integrations/crm/crm-adapter.factory';
import { ICrmAdapter } from '../integrations/crm/crm.interface';
import {
  DatabaseConstraintError,
  DatabaseNotFoundError,
} from '../database/database.errors';

export class HelpdeskService {
  constructor(
    private readonly repo: HelpdeskRepository = helpdeskRepository,
    private crm: ICrmAdapter = crmAdapter,
  ) {}

  public setCrmAdapter(crm: ICrmAdapter): void {
    this.crm = crm;
  }

  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------
  public async createChannel(
    data: Omit<WhatsAppChannel, 'id' | 'createdAt' | 'updatedAt'>,
    identityKey?: string,
  ): Promise<WhatsAppChannel> {
    // 1. Verify branch exists and belongs to the specified tenant
    const branch = await this.crm.getBranchById(data.branchId, identityKey);
    if (branch.tenantId !== data.tenantId) {
      throw new DatabaseConstraintError(
        `Cross-tenant violation: Branch ${data.branchId} belongs to tenant ${branch.tenantId}, not ${data.tenantId}`,
      );
    }

    return this.repo.createChannel(data);
  }

  public async getChannelById(id: string): Promise<WhatsAppChannel> {
    const channel = await this.repo.getChannelById(id);
    if (!channel) {
      throw new DatabaseNotFoundError(`WhatsApp Channel with ID "${id}" not found`);
    }
    return channel;
  }

  public async listChannels(tenantId: string, branchId?: string): Promise<WhatsAppChannel[]> {
    return this.repo.listChannels(tenantId, branchId);
  }

  // ---------------------------------------------------------------------------
  // Agent Settings
  // ---------------------------------------------------------------------------
  public async configureAgentSetting(
    data: Omit<ChatAgentSetting, 'id' | 'createdAt' | 'updatedAt'>,
    identityKey?: string,
  ): Promise<ChatAgentSetting> {
    // 1. Verify employee exists in CRM
    const employee = await this.crm.getEmployeeById(data.employeeId, identityKey);

    // 2. Cross-tenant check: employee must belong to specified tenant
    if (employee.tenantId !== data.tenantId) {
      throw new DatabaseConstraintError(
        `Cross-tenant violation: Employee ${data.employeeId} belongs to tenant ${employee.tenantId}, not ${data.tenantId}`,
      );
    }

    // 3. Cross-branch check: employee must belong to specified branch
    if (employee.branchId !== data.branchId) {
      throw new DatabaseConstraintError(
        `Cross-branch violation: Employee ${data.employeeId} belongs to branch ${employee.branchId}, not ${data.branchId}`,
      );
    }

    // 4. Inactive employee guard: an inactive employee cannot be newly configured as eligible
    if (data.isEligible && employee.status !== 'active') {
      throw new DatabaseConstraintError(
        `Eligibility violation: Employee ${data.employeeId} is inactive in CRM and cannot be configured as eligible for chat support`,
      );
    }

    // 5. Designation check: if provided, must belong to the same tenant
    if (data.designationId) {
      const designation = await this.crm.getChatDesignationById(data.designationId, identityKey);
      if (designation.tenantId !== data.tenantId) {
        throw new DatabaseConstraintError(
          `Cross-tenant designation violation: Designation ${data.designationId} belongs to tenant ${designation.tenantId}, not ${data.tenantId}`,
        );
      }
    }

    return this.repo.upsertAgentSetting(data);
  }

  public async listAgentSettings(tenantId: string, branchId?: string): Promise<ChatAgentSetting[]> {
    return this.repo.listAgentSettings(tenantId, branchId);
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------
  public async createLead(
    data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>,
    identityKey?: string,
  ): Promise<Lead> {
    // Verify branch belongs to tenant
    const branch = await this.crm.getBranchById(data.branchId, identityKey);
    if (branch.tenantId !== data.tenantId) {
      throw new DatabaseConstraintError(
        `Cross-tenant violation: Branch ${data.branchId} belongs to tenant ${branch.tenantId}, not ${data.tenantId}`,
      );
    }

    return this.repo.createLead(data);
  }

  public async getLeadById(id: string): Promise<Lead> {
    const lead = await this.repo.getLeadById(id);
    if (!lead) {
      throw new DatabaseNotFoundError(`Lead with ID "${id}" not found`);
    }
    return lead;
  }

  public async listLeads(
    tenantId: string,
    branchId?: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: Lead[]; total: number }> {
    return this.repo.listLeads(tenantId, branchId, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------
  public async createConversation(
    data: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'closedAt'>,
    identityKey?: string,
  ): Promise<Conversation> {
    // 1. Verify lead exists and belongs to the same tenant and branch
    const lead = await this.repo.getLeadById(data.leadId);
    if (!lead) {
      throw new DatabaseNotFoundError(`Lead with ID "${data.leadId}" not found`);
    }
    if (lead.tenantId !== data.tenantId || lead.branchId !== data.branchId) {
      throw new DatabaseConstraintError(
        `Lead scope violation: Lead ${data.leadId} belongs to tenant ${lead.tenantId} and branch ${lead.branchId}, not conversation tenant ${data.tenantId} / branch ${data.branchId}`,
      );
    }

    // 2. Verify channel exists and belongs to the same tenant and branch
    const channel = await this.repo.getChannelById(data.channelId);
    if (!channel) {
      throw new DatabaseNotFoundError(`Channel with ID "${data.channelId}" not found`);
    }
    if (channel.tenantId !== data.tenantId || channel.branchId !== data.branchId) {
      throw new DatabaseConstraintError(
        `Channel scope violation: Channel ${data.channelId} belongs to tenant ${channel.tenantId} and branch ${channel.branchId}, not conversation tenant ${data.tenantId} / branch ${data.branchId}`,
      );
    }

    // 3. If employee is assigned, verify eligibility in CRM and settings
    if (data.assignedEmployeeId) {
      const employee = await this.crm.getEmployeeById(data.assignedEmployeeId, identityKey);
      if (employee.tenantId !== data.tenantId || employee.branchId !== data.branchId) {
        throw new DatabaseConstraintError(
          `Assignment scope violation: Assigned employee ${data.assignedEmployeeId} does not belong to branch ${data.branchId}`,
        );
      }
      if (employee.status !== 'active') {
        throw new DatabaseConstraintError(
          `Assignment error: Employee ${data.assignedEmployeeId} is inactive and cannot be assigned to new conversations`,
        );
      }
    }

    const conversation = await this.repo.createConversation(data);

    // 4. Record initial assignment audit if an employee was assigned
    if (data.assignedEmployeeId) {
      await this.repo.recordAudit({
        tenantId: data.tenantId,
        branchId: data.branchId,
        conversationId: conversation.id,
        previousEmployeeId: null,
        newEmployeeId: data.assignedEmployeeId,
        eventType: 'initial_assignment',
        reason: 'Initial assignment upon conversation creation',
        metadata: { status: data.status },
      });
    }

    return conversation;
  }

  public async getConversationById(id: string): Promise<Conversation> {
    const conversation = await this.repo.getConversationById(id);
    if (!conversation) {
      throw new DatabaseNotFoundError(`Conversation with ID "${id}" not found`);
    }
    return conversation;
  }

  public async listConversations(
    tenantId: string,
    branchId?: string,
    status?: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: Conversation[]; total: number }> {
    return this.repo.listConversations(tenantId, branchId, status, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  public async addMessage(
    conversationId: string,
    data: Omit<Message, 'id' | 'conversationId' | 'tenantId' | 'branchId' | 'createdAt' | 'sentAt' | 'deliveredAt' | 'readAt'>,
  ): Promise<Message> {
    const conversation = await this.getConversationById(conversationId);

    const message = await this.repo.createMessage({
      tenantId: conversation.tenantId,
      branchId: conversation.branchId,
      conversationId: conversation.id,
      externalMessageId: data.externalMessageId,
      direction: data.direction,
      messageType: data.messageType,
      body: data.body,
      payload: data.payload,
      deliveryStatus: data.deliveryStatus,
    });

    // Update conversation lastMessageAt
    await this.repo.updateConversation(conversation.id, {
      lastMessageAt: new Date().toISOString(),
    });

    return message;
  }

  public async listMessages(
    conversationId: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: Message[]; total: number }> {
    await this.getConversationById(conversationId); // Verify exists
    return this.repo.listMessages(conversationId, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Follow-Ups & Audit
  // ---------------------------------------------------------------------------
  public async scheduleFollowUp(
    data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>,
    identityKey?: string,
  ): Promise<FollowUp> {
    const conversation = await this.getConversationById(data.conversationId);
    if (conversation.tenantId !== data.tenantId || conversation.branchId !== data.branchId) {
      throw new DatabaseConstraintError('Follow-up tenant/branch does not match conversation scope');
    }

    const employee = await this.crm.getEmployeeById(data.assignedEmployeeId, identityKey);
    if (employee.tenantId !== data.tenantId) {
      throw new DatabaseConstraintError('Assigned employee does not belong to the same tenant');
    }

    return this.repo.createFollowUp(data);
  }

  public async listFollowUps(tenantId: string, branchId?: string, status?: string): Promise<FollowUp[]> {
    return this.repo.listFollowUps(tenantId, branchId, status);
  }

  public async listAssignmentAudit(conversationId: string): Promise<AssignmentAudit[]> {
    await this.getConversationById(conversationId);
    return this.repo.listAuditByConversation(conversationId);
  }

  // ---------------------------------------------------------------------------
  // Webhook Idempotency Events
  // ---------------------------------------------------------------------------
  public async recordWebhookEvent(
    data: Omit<WebhookEvent, 'id' | 'receivedAt' | 'processedAt'>,
  ): Promise<WebhookEvent> {
    const existing = await this.repo.getWebhookEvent(data.provider, data.externalEventId);
    if (existing) {
      return existing; // Idempotent return without duplicate
    }
    return this.repo.recordWebhookEvent(data);
  }

  public async getWebhookEvent(provider: string, externalEventId: string): Promise<WebhookEvent | null> {
    return this.repo.getWebhookEvent(provider, externalEventId);
  }
}

export const helpdeskService = new HelpdeskService();
