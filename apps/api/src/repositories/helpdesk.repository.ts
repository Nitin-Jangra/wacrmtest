import {
  WhatsAppChannel,
  ChatDesignation,
  ChatAgentSetting,
  Lead,
  Conversation,
  Message,
  FollowUp,
  AssignmentAudit,
  WebhookEvent,
} from '@gym-helpdesk/shared-types';
import { getSupabaseClient } from '../database/supabase.client';
import {
  DatabaseConstraintError,
  DatabaseNotFoundError,
} from '../database/database.errors';

export class HelpdeskRepository {
  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------
  public async createChannel(channel: Omit<WhatsAppChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<WhatsAppChannel> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('whatsapp_channels')
      .insert({
        tenant_id: channel.tenantId,
        branch_id: channel.branchId,
        provider: channel.provider,
        phone_number_id: channel.phoneNumberId,
        waba_id: channel.wabaId,
        display_name: channel.displayName,
        status: channel.status,
        credential_reference: channel.credentialReference,
        configuration: channel.configuration,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseConstraintError(error.message, error);
    }
    return this.mapChannel(data);
  }

  public async getChannelById(id: string): Promise<WhatsAppChannel | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('whatsapp_channels')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapChannel(data) : null;
  }

  public async listChannels(tenantId: string, branchId?: string): Promise<WhatsAppChannel[]> {
    const client = getSupabaseClient();
    let query = client.from('whatsapp_channels').select('*').eq('tenant_id', tenantId);
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw new DatabaseConstraintError(error.message);
    return (data || []).map(this.mapChannel);
  }

  public async getChannelByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppChannel | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('whatsapp_channels')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapChannel(data) : null;
  }

  // ---------------------------------------------------------------------------
  // Designations
  // ---------------------------------------------------------------------------
  public async getDesignationById(id: string): Promise<ChatDesignation | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_designations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapDesignation(data) : null;
  }

  public async listDesignations(tenantId: string): Promise<ChatDesignation[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_designations')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw new DatabaseConstraintError(error.message);
    return (data || []).map(this.mapDesignation);
  }

  // ---------------------------------------------------------------------------
  // Agent Settings
  // ---------------------------------------------------------------------------
  public async upsertAgentSetting(
    setting: Omit<ChatAgentSetting, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ChatAgentSetting> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_agent_settings')
      .upsert(
        {
          tenant_id: setting.tenantId,
          branch_id: setting.branchId,
          employee_id: setting.employeeId,
          designation_id: setting.designationId,
          is_eligible: setting.isEligible,
          assignment_weight: setting.assignmentWeight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,branch_id,employee_id' },
      )
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapAgentSetting(data);
  }

  public async getAgentSetting(tenantId: string, branchId: string, employeeId: string): Promise<ChatAgentSetting | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_agent_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapAgentSetting(data) : null;
  }

  public async getAgentSettingById(id: string): Promise<ChatAgentSetting | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_agent_settings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapAgentSetting(data) : null;
  }

  public async updateAgentSetting(
    id: string,
    updates: Partial<Pick<ChatAgentSetting, 'isEligible' | 'assignmentWeight' | 'designationId'>>,
  ): Promise<ChatAgentSetting> {
    const client = getSupabaseClient();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.isEligible !== undefined) dbUpdates['is_eligible'] = updates.isEligible;
    if (updates.assignmentWeight !== undefined) dbUpdates['assignment_weight'] = updates.assignmentWeight;
    if (updates.designationId !== undefined) dbUpdates['designation_id'] = updates.designationId;

    const { data, error } = await client
      .from('chat_agent_settings')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    if (!data) throw new DatabaseNotFoundError(`ChatAgentSetting ${id} not found`);
    return this.mapAgentSetting(data);
  }

  public async listAgentSettings(tenantId: string, branchId?: string): Promise<ChatAgentSetting[]> {
    const client = getSupabaseClient();
    let query = client.from('chat_agent_settings').select('*').eq('tenant_id', tenantId);
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw new DatabaseConstraintError(error.message);
    return (data || []).map(this.mapAgentSetting);
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------
  public async createLead(lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('leads')
      .insert({
        tenant_id: lead.tenantId,
        branch_id: lead.branchId,
        external_contact_id: lead.externalContactId,
        name: lead.name,
        phone_number: lead.phoneNumber,
        email: lead.email,
        source: lead.source,
        metadata: lead.metadata,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapLead(data);
  }

  public async getLeadById(id: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapLead(data) : null;
  }

  public async listLeads(tenantId: string, branchId?: string, page: number = 1, limit: number = 20): Promise<{ data: Lead[]; total: number }> {
    const client = getSupabaseClient();
    let query = client.from('leads').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (branchId) query = query.eq('branch_id', branchId);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

    if (error) throw new DatabaseConstraintError(error.message);
    return {
      data: (data || []).map(this.mapLead),
      total: count || 0,
    };
  }

  public async findLeadByPhoneOrExternalId(
    tenantId: string,
    branchId: string,
    identifier: string,
  ): Promise<Lead | null> {
    const client = getSupabaseClient();
    // Query leads table matching tenant, branch, and either phone_number or external_contact_id
    const byPhone = await client
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('phone_number', identifier)
      .maybeSingle();

    if (byPhone.data) return this.mapLead(byPhone.data);

    const byExt = await client
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('external_contact_id', identifier)
      .maybeSingle();

    if (byExt.data) return this.mapLead(byExt.data);

    return null;
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------
  public async createConversation(
    conv: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'closedAt'>,
  ): Promise<Conversation> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .insert({
        tenant_id: conv.tenantId,
        branch_id: conv.branchId,
        lead_id: conv.leadId,
        channel_id: conv.channelId,
        assigned_employee_id: conv.assignedEmployeeId,
        status: conv.status,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapConversation(data);
  }

  public async getConversationById(id: string): Promise<Conversation | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapConversation(data) : null;
  }

  public async listConversations(
    tenantId: string,
    branchId?: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
    assignedEmployeeId?: string,
  ): Promise<{ data: Conversation[]; total: number }> {
    const client = getSupabaseClient();
    let query = client.from('conversations').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    if (assignedEmployeeId) query = query.eq('assigned_employee_id', assignedEmployeeId);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

    if (error) throw new DatabaseConstraintError(error.message);
    return {
      data: (data || []).map(this.mapConversation),
      total: count || 0,
    };
  }

  public async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const client = getSupabaseClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status) dbUpdates['status'] = updates.status;
    if (updates.assignedEmployeeId !== undefined) dbUpdates['assigned_employee_id'] = updates.assignedEmployeeId;
    if (updates.lastMessageAt) dbUpdates['last_message_at'] = updates.lastMessageAt;
    if (updates.closedAt !== undefined) dbUpdates['closed_at'] = updates.closedAt;

    const { data, error } = await client
      .from('conversations')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`Conversation ${id} not found`);
    return this.mapConversation(data);
  }

  public async findActiveConversation(
    tenantId: string,
    branchId: string,
    leadId: string,
    channelId: string,
  ): Promise<Conversation | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('lead_id', leadId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapConversation(data) : null;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  public async createMessage(
    msg: Omit<Message, 'id' | 'createdAt' | 'sentAt' | 'deliveredAt' | 'readAt'>,
  ): Promise<Message> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .insert({
        tenant_id: msg.tenantId,
        branch_id: msg.branchId,
        conversation_id: msg.conversationId,
        external_message_id: msg.externalMessageId,
        direction: msg.direction,
        message_type: msg.messageType,
        body: msg.body,
        payload: msg.payload,
        delivery_status: msg.deliveryStatus,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapMessage(data);
  }

  public async listMessages(conversationId: string, page: number = 1, limit: number = 50): Promise<{ data: Message[]; total: number }> {
    const client = getSupabaseClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await client
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .range(from, to)
      .order('created_at', { ascending: true });

    if (error) throw new DatabaseConstraintError(error.message);
    return {
      data: (data || []).map(this.mapMessage),
      total: count || 0,
    };
  }

  public async getMessageById(id: string): Promise<Message | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapMessage(data) : null;
  }

  public async getMessageByExternalId(externalMessageId: string): Promise<Message | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('external_message_id', externalMessageId)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapMessage(data) : null;
  }

  public async updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
    const client = getSupabaseClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.externalMessageId !== undefined) dbUpdates['external_message_id'] = updates.externalMessageId;
    if (updates.deliveryStatus !== undefined) dbUpdates['delivery_status'] = updates.deliveryStatus;
    if (updates.body !== undefined) dbUpdates['body'] = updates.body;
    if (updates.payload !== undefined) dbUpdates['payload'] = updates.payload;
    if (updates.sentAt !== undefined) dbUpdates['sent_at'] = updates.sentAt;
    if (updates.deliveredAt !== undefined) dbUpdates['delivered_at'] = updates.deliveredAt;
    if (updates.readAt !== undefined) dbUpdates['read_at'] = updates.readAt;

    const { data, error } = await client
      .from('messages')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`Message ${id} not found`);
    return this.mapMessage(data);
  }

  // ---------------------------------------------------------------------------
  // Follow-Ups
  // ---------------------------------------------------------------------------
  public async createFollowUp(
    fu: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FollowUp> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('follow_ups')
      .insert({
        tenant_id: fu.tenantId,
        branch_id: fu.branchId,
        conversation_id: fu.conversationId,
        assigned_employee_id: fu.assignedEmployeeId,
        scheduled_at: fu.scheduledAt,
        status: fu.status,
        note: fu.note,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapFollowUp(data);
  }

  public async listFollowUps(
    tenantId: string,
    branchId?: string,
    status?: string,
    conversationId?: string,
    assignedEmployeeId?: string,
  ): Promise<FollowUp[]> {
    const client = getSupabaseClient();
    let query = client.from('follow_ups').select('*').eq('tenant_id', tenantId);
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    if (assignedEmployeeId) query = query.eq('assigned_employee_id', assignedEmployeeId);

    const { data, error } = await query.order('scheduled_at', { ascending: true });
    if (error) throw new DatabaseConstraintError(error.message);
    return (data || []).map(this.mapFollowUp);
  }

  public async updateFollowUp(id: string, updates: Partial<FollowUp>): Promise<FollowUp> {
    const client = getSupabaseClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates['status'] = updates.status;
    if (updates.note !== undefined) dbUpdates['note'] = updates.note;
    if (updates.scheduledAt !== undefined) dbUpdates['scheduled_at'] = updates.scheduledAt;

    const { data, error } = await client
      .from('follow_ups')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`FollowUp ${id} not found`);
    return this.mapFollowUp(data);
  }

  // ---------------------------------------------------------------------------
  // Assignment Audit
  // ---------------------------------------------------------------------------
  public async recordAudit(audit: Omit<AssignmentAudit, 'id' | 'createdAt'>): Promise<AssignmentAudit> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('assignment_audit')
      .insert({
        tenant_id: audit.tenantId,
        branch_id: audit.branchId,
        conversation_id: audit.conversationId,
        previous_employee_id: audit.previousEmployeeId,
        new_employee_id: audit.newEmployeeId,
        event_type: audit.eventType,
        reason: audit.reason,
        metadata: audit.metadata,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapAssignmentAudit(data);
  }

  public async listAuditByConversation(conversationId: string): Promise<AssignmentAudit[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('assignment_audit')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseConstraintError(error.message);
    return (data || []).map(this.mapAssignmentAudit);
  }

  // ---------------------------------------------------------------------------
  // Webhook Events
  // ---------------------------------------------------------------------------
  public async recordWebhookEvent(event: Omit<WebhookEvent, 'id' | 'receivedAt' | 'processedAt'>): Promise<WebhookEvent> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('webhook_events')
      .insert({
        provider: event.provider,
        external_event_id: event.externalEventId,
        tenant_id: event.tenantId,
        channel_id: event.channelId,
        event_type: event.eventType,
        processing_status: event.processingStatus,
        error_code: event.errorCode,
      })
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapWebhookEvent(data);
  }

  public async getWebhookEvent(provider: string, externalEventId: string): Promise<WebhookEvent | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('webhook_events')
      .select('*')
      .eq('provider', provider)
      .eq('external_event_id', externalEventId)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapWebhookEvent(data) : null;
  }

  public async updateWebhookEvent(
    id: string,
    updates: Partial<Pick<WebhookEvent, 'processingStatus' | 'errorCode' | 'processedAt' | 'tenantId' | 'channelId'>>,
  ): Promise<WebhookEvent> {
    const client = getSupabaseClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.processingStatus !== undefined) dbUpdates['processing_status'] = updates.processingStatus;
    if (updates.errorCode !== undefined) dbUpdates['error_code'] = updates.errorCode;
    if (updates.processedAt !== undefined) dbUpdates['processed_at'] = updates.processedAt;
    if (updates.tenantId !== undefined) dbUpdates['tenant_id'] = updates.tenantId;
    if (updates.channelId !== undefined) dbUpdates['channel_id'] = updates.channelId;

    const { data, error } = await client
      .from('webhook_events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`Webhook event ${id} not found`);
    return this.mapWebhookEvent(data);
  }

  // ---------------------------------------------------------------------------
  // Mapping Helpers (snake_case -> camelCase)
  // ---------------------------------------------------------------------------
  private mapChannel(row: any): WhatsAppChannel {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      provider: row.provider,
      phoneNumberId: row.phone_number_id,
      wabaId: row.waba_id,
      displayName: row.display_name,
      status: row.status,
      credentialReference: row.credential_reference,
      configuration: row.configuration || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDesignation(row: any): ChatDesignation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAgentSetting(row: any): ChatAgentSetting {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      employeeId: row.employee_id,
      designationId: row.designation_id,
      isEligible: row.is_eligible,
      assignmentWeight: row.assignment_weight,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapLead(row: any): Lead {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      externalContactId: row.external_contact_id,
      name: row.name,
      phoneNumber: row.phone_number,
      email: row.email,
      source: row.source,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapConversation(row: any): Conversation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      leadId: row.lead_id,
      channelId: row.channel_id,
      assignedEmployeeId: row.assigned_employee_id,
      status: row.status,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      conversationId: row.conversation_id,
      externalMessageId: row.external_message_id,
      direction: row.direction,
      messageType: row.message_type,
      body: row.body,
      payload: row.payload || {},
      deliveryStatus: row.delivery_status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
    };
  }

  private mapFollowUp(row: any): FollowUp {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      conversationId: row.conversation_id,
      assignedEmployeeId: row.assigned_employee_id,
      scheduledAt: row.scheduled_at,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAssignmentAudit(row: any): AssignmentAudit {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      conversationId: row.conversation_id,
      previousEmployeeId: row.previous_employee_id,
      newEmployeeId: row.new_employee_id,
      eventType: row.event_type,
      reason: row.reason,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private mapWebhookEvent(row: any): WebhookEvent {
    return {
      id: row.id,
      provider: row.provider,
      externalEventId: row.external_event_id,
      tenantId: row.tenant_id,
      channelId: row.channel_id,
      eventType: row.event_type,
      processingStatus: row.processing_status,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
      errorCode: row.error_code,
    };
  }
}

export const helpdeskRepository = new HelpdeskRepository();
