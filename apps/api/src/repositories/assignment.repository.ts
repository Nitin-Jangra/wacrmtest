import {
  ChatAssignmentRule,
  ChatAssignmentState,
  Lead,
  Conversation,
  AssignmentAudit,
} from '@gym-helpdesk/shared-types';
import { getSupabaseClient } from '../database/supabase.client';
import { DatabaseConstraintError, DatabaseNotFoundError } from '../database/database.errors';

class BranchAssignmentMutex {
  private queues = new Map<string, Promise<void>>();

  public async runExclusive<T>(tenantId: string, branchId: string, fn: () => Promise<T>): Promise<T> {
    const key = `${tenantId}:${branchId}`;
    const previous = this.queues.get(key) || Promise.resolve();

    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const chain = previous.then(() => current);
    this.queues.set(key, chain);

    await previous;
    try {
      return await fn();
    } finally {
      release!();
      if (this.queues.get(key) === chain) {
        this.queues.delete(key);
      }
    }
  }
}

export class AssignmentRepository {
  private readonly mutex = new BranchAssignmentMutex();

  public async withBranchLock<T>(tenantId: string, branchId: string, fn: () => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(tenantId, branchId, fn);
  }

  // ---------------------------------------------------------------------------
  // Assignment Rules
  // ---------------------------------------------------------------------------
  public async getActiveRule(tenantId: string, branchId: string): Promise<ChatAssignmentRule | null> {
    const client = getSupabaseClient();

    // 1. Check for branch-specific rule
    const { data: branchRule, error: branchErr } = await client
      .from('chat_assignment_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('is_enabled', true)
      .maybeSingle();

    if (branchErr) throw new DatabaseConstraintError(branchErr.message);
    if (branchRule) return this.mapRule(branchRule);

    // 2. Fallback to tenant-wide rule (branch_id IS NULL)
    // Note: In Supabase, checking for null on branch_id can be done with .is('branch_id', null)
    let tenantQuery = client
      .from('chat_assignment_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_enabled', true);

    if (typeof (tenantQuery as any).is === 'function') {
      tenantQuery = (tenantQuery as any).is('branch_id', null);
    } else {
      tenantQuery = tenantQuery.eq('branch_id', null);
    }

    const { data: tenantRule, error: tenantErr } = await tenantQuery.maybeSingle();
    if (tenantErr) throw new DatabaseConstraintError(tenantErr.message);
    return tenantRule ? this.mapRule(tenantRule) : null;
  }

  // ---------------------------------------------------------------------------
  // Assignment State
  // ---------------------------------------------------------------------------
  public async getAssignmentState(
    tenantId: string,
    branchId: string,
    strategy: string,
  ): Promise<ChatAssignmentState | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_assignment_state')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('strategy', strategy)
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapState(data) : null;
  }

  public async upsertAssignmentState(
    tenantId: string,
    branchId: string,
    strategy: string,
    state: Record<string, unknown>,
  ): Promise<ChatAssignmentState> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('chat_assignment_state')
      .upsert(
        {
          tenant_id: tenantId,
          branch_id: branchId,
          strategy,
          state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,branch_id,strategy' },
      )
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message, error);
    return this.mapState(data);
  }

  // ---------------------------------------------------------------------------
  // Leads & Conversations Updates
  // ---------------------------------------------------------------------------
  public async updateLeadMetadata(
    leadId: string,
    metadata: Record<string, unknown>,
  ): Promise<Lead> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('leads')
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`Lead ${leadId} not found`);
    return this.mapLead(data);
  }

  public async updateConversationOwner(
    conversationId: string,
    employeeId: string | null,
  ): Promise<Conversation> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .update({
        assigned_employee_id: employeeId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw new DatabaseConstraintError(error.message);
    if (!data) throw new DatabaseNotFoundError(`Conversation ${conversationId} not found`);
    return this.mapConversation(data);
  }

  public async findLatestConversationForLead(
    tenantId: string,
    branchId: string,
    leadId: string,
  ): Promise<Conversation | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) throw new DatabaseConstraintError(error.message);
    return data ? this.mapConversation(data) : null;
  }

  // ---------------------------------------------------------------------------
  // Assignment Audit Record
  // ---------------------------------------------------------------------------
  public async recordAudit(
    audit: Omit<AssignmentAudit, 'id' | 'createdAt'>,
  ): Promise<AssignmentAudit> {
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

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------
  private mapRule(row: any): ChatAssignmentRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      strategy: row.strategy,
      isEnabled: row.is_enabled,
      configuration: row.configuration || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapState(row: any): ChatAssignmentState {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      strategy: row.strategy,
      state: row.state || {},
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
}

export const assignmentRepository = new AssignmentRepository();
