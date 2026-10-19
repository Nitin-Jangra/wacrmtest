import {
  AssignmentAudit,
  AssignmentEventType,
} from '@gym-helpdesk/shared-types';
import { ICrmAdapter } from '../../integrations/crm/crm.interface';
import { crmAdapter } from '../../integrations/crm/crm-adapter.factory';
import { HelpdeskRepository, helpdeskRepository } from '../../repositories/helpdesk.repository';
import { AssignmentRepository, assignmentRepository } from '../../repositories/assignment.repository';
import {
  EligibleAgentResolver,
  eligibleAgentResolver,
  ResolvedEligibleAgent,
} from './resolvers/eligible-agent.resolver';
import {
  weightedRoundRobinStrategy,
} from './strategies/weighted-round-robin.strategy';
import {
  roundRobinStrategy,
} from './strategies/round-robin.strategy';
import {
  AssignmentRuleNotFoundError,
  AssignmentTenantScopeError,
  AssignmentBranchScopeError,
} from './assignment.errors';
import { DatabaseNotFoundError, DatabaseConstraintError } from '../../database/database.errors';

export type AssignmentReason =
  | 'NEW_LEAD_ASSIGNMENT'
  | 'NEW_CONVERSATION_ASSIGNMENT'
  | 'OWNER_RETAINED'
  | 'OWNER_INELIGIBLE'
  | 'MANUAL_REASSIGNMENT'
  | 'RETRY_ASSIGNMENT'
  | 'NO_ELIGIBLE_AGENTS';

export interface AssignLeadOptions {
  forceReassign?: boolean;
  requestId?: string;
}

export interface AssignConversationOptions {
  forceReassign?: boolean;
  targetEmployeeId?: string;
  requestId?: string;
}

export interface LeadAssignmentResult {
  leadId: string;
  tenantId: string;
  branchId: string;
  assigned: boolean;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  strategy: string;
  reason: AssignmentReason;
  weightsSnapshot?: Record<string, number>;
  isRetained: boolean;
  conversationId?: string | null;
}

export interface ConversationAssignmentResult {
  conversationId: string;
  leadId: string;
  tenantId: string;
  branchId: string;
  assigned: boolean;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  strategy: string;
  reason: AssignmentReason;
  weightsSnapshot?: Record<string, number>;
  isRetained: boolean;
}

export interface AssignmentPreviewResult {
  tenantId: string;
  branchId: string;
  strategy: string;
  ruleConfiguration: Record<string, unknown>;
  eligibleAgents: ResolvedEligibleAgent[];
  predictedEmployeeId: string | null;
  predictedEmployeeName: string | null;
  reason?: string;
}

export class AssignmentService {
  constructor(
    private crm: ICrmAdapter = crmAdapter,
    private readonly helpdeskRepo: HelpdeskRepository = helpdeskRepository,
    private readonly assignRepo: AssignmentRepository = assignmentRepository,
    private readonly resolver: EligibleAgentResolver = eligibleAgentResolver,
  ) {}

  public setCrmAdapter(crm: ICrmAdapter): void {
    this.crm = crm;
    this.resolver.setCrmAdapter(crm);
  }

  public getCrmAdapter(): ICrmAdapter {
    return this.crm;
  }

  // ---------------------------------------------------------------------------
  // 1. Assign a Lead
  // ---------------------------------------------------------------------------
  public async assignLead(
    leadId: string,
    options: AssignLeadOptions = {},
    identityKey?: string,
  ): Promise<LeadAssignmentResult> {
    const lead = await this.helpdeskRepo.getLeadById(leadId);
    if (!lead) {
      throw new DatabaseNotFoundError(`Lead with ID "${leadId}" not found`);
    }

    // Verify caller authorization against lead tenant & branch
    await this.validateCallerScope(lead.tenantId, lead.branchId, identityKey);

    return this.assignRepo.withBranchLock(lead.tenantId, lead.branchId, async () => {
      // Refresh lead under lock
      const currentLead = (await this.helpdeskRepo.getLeadById(leadId)) || lead;
      const existingOwnerId = (currentLead.metadata?.assignedEmployeeId as string) || null;

      // 1. Check active assignment rule
      const rule = await this.assignRepo.getActiveRule(currentLead.tenantId, currentLead.branchId);
      if (!rule) {
        throw new AssignmentRuleNotFoundError(
          `No active assignment rule configured for branch "${currentLead.branchId}" or tenant fallback`,
        );
      }

      // 2. Resolve eligible agents for this branch
      const excludedIds = (rule.configuration?.excludedEmployeeIds as string[]) || [];
      const eligibleAgents = await this.resolver.resolveEligibleAgents(
        currentLead.tenantId,
        currentLead.branchId,
        { identityKey, excludedEmployeeIds: excludedIds },
      );

      // 3. Ownership retention: If lead already has an owner and that owner is still eligible
      if (existingOwnerId && !options.forceReassign) {
        const ownerStillEligible = eligibleAgents.find((a) => a.employeeId === existingOwnerId);
        if (ownerStillEligible) {
          // Retain existing eligible owner without consuming weighted state
          return {
            leadId: currentLead.id,
            tenantId: currentLead.tenantId,
            branchId: currentLead.branchId,
            assigned: true,
            assignedEmployeeId: existingOwnerId,
            assignedEmployeeName: ownerStillEligible.fullName,
            strategy: rule.strategy,
            reason: 'OWNER_RETAINED',
            isRetained: true,
          };
        }
      }

      // 4. If no eligible agents exist in branch
      if (eligibleAgents.length === 0) {
        // Leave unassigned
        const updatedMeta = {
          ...currentLead.metadata,
          assignedEmployeeId: null,
          assignmentStatus: 'unassigned',
          unassignedReason: 'NO_ELIGIBLE_AGENTS',
          unassignedAt: new Date().toISOString(),
        };
        await this.assignRepo.updateLeadMetadata(currentLead.id, updatedMeta);

        return {
          leadId: currentLead.id,
          tenantId: currentLead.tenantId,
          branchId: currentLead.branchId,
          assigned: false,
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          strategy: rule.strategy,
          reason: 'NO_ELIGIBLE_AGENTS',
          isRetained: false,
        };
      }

      // 5. Select next agent using configured strategy
      const candidates = eligibleAgents.map((a) => ({
        employeeId: a.employeeId,
        weight: a.weight,
      }));

      const currentState = await this.assignRepo.getAssignmentState(
        currentLead.tenantId,
        currentLead.branchId,
        rule.strategy,
      );

      const strategyImpl =
        rule.strategy === 'round_robin' ? roundRobinStrategy : weightedRoundRobinStrategy;

      const selection = strategyImpl.selectNext(candidates, currentState?.state);

      // 6. Persist updated assignment state
      await this.assignRepo.upsertAssignmentState(
        currentLead.tenantId,
        currentLead.branchId,
        rule.strategy,
        selection.newState,
      );

      // 7. Update lead metadata owner
      const selectedAgent = eligibleAgents.find((a) => a.employeeId === selection.selectedEmployeeId)!;
      const isReassignment = !!existingOwnerId;
      const reason: AssignmentReason = options.forceReassign
        ? 'MANUAL_REASSIGNMENT'
        : isReassignment
          ? 'OWNER_INELIGIBLE'
          : currentLead.metadata?.assignmentStatus === 'unassigned'
            ? 'RETRY_ASSIGNMENT'
            : 'NEW_LEAD_ASSIGNMENT';

      const updatedMeta = {
        ...currentLead.metadata,
        assignedEmployeeId: selectedAgent.employeeId,
        assignedEmployeeName: selectedAgent.fullName,
        assignedAt: new Date().toISOString(),
        assignmentReason: reason,
        assignmentStrategy: rule.strategy,
      };
      await this.assignRepo.updateLeadMetadata(currentLead.id, updatedMeta);

      // 8. If an active conversation exists for this lead, update it and write audit
      const conversation = await this.assignRepo.findLatestConversationForLead(
        currentLead.tenantId,
        currentLead.branchId,
        currentLead.id,
      );

      if (conversation) {
        await this.assignRepo.updateConversationOwner(conversation.id, selectedAgent.employeeId);
        await this.recordAuditLog({
          tenantId: currentLead.tenantId,
          branchId: currentLead.branchId,
          conversationId: conversation.id,
          previousEmployeeId: existingOwnerId,
          newEmployeeId: selectedAgent.employeeId,
          eventType: isReassignment ? 'reassignment' : 'initial_assignment',
          reason,
          metadata: {
            leadId: currentLead.id,
            strategy: rule.strategy,
            weightsSnapshot: selection.weightsSnapshot,
            requestId: options.requestId || null,
          },
        });
      }

      return {
        leadId: currentLead.id,
        tenantId: currentLead.tenantId,
        branchId: currentLead.branchId,
        assigned: true,
        assignedEmployeeId: selectedAgent.employeeId,
        assignedEmployeeName: selectedAgent.fullName,
        strategy: rule.strategy,
        reason,
        weightsSnapshot: selection.weightsSnapshot,
        isRetained: false,
        conversationId: conversation?.id || null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Assign a Conversation
  // ---------------------------------------------------------------------------
  public async assignConversation(
    conversationId: string,
    options: AssignConversationOptions = {},
    identityKey?: string,
  ): Promise<ConversationAssignmentResult> {
    const conversation = await this.helpdeskRepo.getConversationById(conversationId);
    if (!conversation) {
      throw new DatabaseNotFoundError(`Conversation with ID "${conversationId}" not found`);
    }

    // Verify caller authorization against conversation tenant & branch
    await this.validateCallerScope(conversation.tenantId, conversation.branchId, identityKey);

    return this.assignRepo.withBranchLock(conversation.tenantId, conversation.branchId, async () => {
      const currentConv =
        (await this.helpdeskRepo.getConversationById(conversationId)) || conversation;

      // 1. Fetch lead associated with conversation
      const lead = await this.helpdeskRepo.getLeadById(currentConv.leadId);
      const leadOwnerId = (lead?.metadata?.assignedEmployeeId as string) || null;

      // 2. Fetch active assignment rule
      const rule = await this.assignRepo.getActiveRule(currentConv.tenantId, currentConv.branchId);
      if (!rule) {
        throw new AssignmentRuleNotFoundError(
          `No active assignment rule configured for branch "${currentConv.branchId}" or tenant fallback`,
        );
      }

      // 3. Resolve eligible agents
      const excludedIds = (rule.configuration?.excludedEmployeeIds as string[]) || [];
      const eligibleAgents = await this.resolver.resolveEligibleAgents(
        currentConv.tenantId,
        currentConv.branchId,
        { identityKey, excludedEmployeeIds: excludedIds },
      );

      // Explicit target employee transfer (manual reassignment)
      if (options.targetEmployeeId) {
        const targetAgent = eligibleAgents.find((a) => a.employeeId === options.targetEmployeeId);
        if (!targetAgent) {
          throw new DatabaseConstraintError(
            `Target employee "${options.targetEmployeeId}" is not an active eligible chat agent in branch "${currentConv.branchId}"`,
          );
        }

        const prevEmployeeId = currentConv.assignedEmployeeId;
        await this.assignRepo.updateConversationOwner(currentConv.id, targetAgent.employeeId);

        if (lead) {
          await this.assignRepo.updateLeadMetadata(lead.id, {
            ...lead.metadata,
            assignedEmployeeId: targetAgent.employeeId,
            assignedEmployeeName: targetAgent.fullName,
            assignedAt: new Date().toISOString(),
            assignmentReason: 'MANUAL_REASSIGNMENT',
            assignmentStrategy: 'manual_transfer',
          });
        }

        await this.recordAuditLog({
          tenantId: currentConv.tenantId,
          branchId: currentConv.branchId,
          conversationId: currentConv.id,
          previousEmployeeId: prevEmployeeId,
          newEmployeeId: targetAgent.employeeId,
          eventType: 'reassignment',
          reason: 'MANUAL_REASSIGNMENT',
          metadata: {
            leadId: currentConv.leadId,
            strategy: 'manual_transfer',
            requestId: options.requestId || null,
          },
        });

        return {
          conversationId: currentConv.id,
          leadId: currentConv.leadId,
          tenantId: currentConv.tenantId,
          branchId: currentConv.branchId,
          assigned: true,
          assignedEmployeeId: targetAgent.employeeId,
          assignedEmployeeName: targetAgent.fullName,
          strategy: 'manual_transfer',
          reason: 'MANUAL_REASSIGNMENT',
          isRetained: false,
        };
      }

      // 4. Lead-first ownership retention:
      // If lead owner is eligible in this branch, retain that owner!
      if (leadOwnerId && !options.forceReassign) {
        const ownerStillEligible = eligibleAgents.find((a) => a.employeeId === leadOwnerId);
        if (ownerStillEligible) {
          // If conversation already assigned to this exact owner: idempotent return
          if (currentConv.assignedEmployeeId === leadOwnerId) {
            return {
              conversationId: currentConv.id,
              leadId: currentConv.leadId,
              tenantId: currentConv.tenantId,
              branchId: currentConv.branchId,
              assigned: true,
              assignedEmployeeId: leadOwnerId,
              assignedEmployeeName: ownerStillEligible.fullName,
              strategy: rule.strategy,
              reason: 'OWNER_RETAINED',
              isRetained: true,
            };
          }

          // Otherwise update conversation and record audit with OWNER_RETAINED
          await this.assignRepo.updateConversationOwner(currentConv.id, leadOwnerId);
          await this.recordAuditLog({
            tenantId: currentConv.tenantId,
            branchId: currentConv.branchId,
            conversationId: currentConv.id,
            previousEmployeeId: currentConv.assignedEmployeeId,
            newEmployeeId: leadOwnerId,
            eventType: currentConv.assignedEmployeeId ? 'reassignment' : 'initial_assignment',
            reason: 'OWNER_RETAINED',
            metadata: {
              leadId: currentConv.leadId,
              strategy: rule.strategy,
              requestId: options.requestId || null,
            },
          });

          return {
            conversationId: currentConv.id,
            leadId: currentConv.leadId,
            tenantId: currentConv.tenantId,
            branchId: currentConv.branchId,
            assigned: true,
            assignedEmployeeId: leadOwnerId,
            assignedEmployeeName: ownerStillEligible.fullName,
            strategy: rule.strategy,
            reason: 'OWNER_RETAINED',
            isRetained: true,
          };
        }
      }

      // If conversation itself already has an assigned owner who is still eligible (and not forced)
      if (currentConv.assignedEmployeeId && !options.forceReassign) {
        const convOwnerStillEligible = eligibleAgents.find(
          (a) => a.employeeId === currentConv.assignedEmployeeId,
        );
        if (convOwnerStillEligible) {
          return {
            conversationId: currentConv.id,
            leadId: currentConv.leadId,
            tenantId: currentConv.tenantId,
            branchId: currentConv.branchId,
            assigned: true,
            assignedEmployeeId: currentConv.assignedEmployeeId,
            assignedEmployeeName: convOwnerStillEligible.fullName,
            strategy: rule.strategy,
            reason: 'OWNER_RETAINED',
            isRetained: true,
          };
        }
      }

      // 5. If no eligible agents exist
      if (eligibleAgents.length === 0) {
        await this.assignRepo.updateConversationOwner(currentConv.id, null);
        return {
          conversationId: currentConv.id,
          leadId: currentConv.leadId,
          tenantId: currentConv.tenantId,
          branchId: currentConv.branchId,
          assigned: false,
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          strategy: rule.strategy,
          reason: 'NO_ELIGIBLE_AGENTS',
          isRetained: false,
        };
      }

      // 6. Select next agent
      const candidates = eligibleAgents.map((a) => ({
        employeeId: a.employeeId,
        weight: a.weight,
      }));

      const currentState = await this.assignRepo.getAssignmentState(
        currentConv.tenantId,
        currentConv.branchId,
        rule.strategy,
      );

      const strategyImpl =
        rule.strategy === 'round_robin' ? roundRobinStrategy : weightedRoundRobinStrategy;

      const selection = strategyImpl.selectNext(candidates, currentState?.state);

      // 7. Persist state
      await this.assignRepo.upsertAssignmentState(
        currentConv.tenantId,
        currentConv.branchId,
        rule.strategy,
        selection.newState,
      );

      // 8. Update conversation & lead owner
      const selectedAgent = eligibleAgents.find((a) => a.employeeId === selection.selectedEmployeeId)!;
      await this.assignRepo.updateConversationOwner(currentConv.id, selectedAgent.employeeId);

      if (lead) {
        const updatedMeta = {
          ...lead.metadata,
          assignedEmployeeId: selectedAgent.employeeId,
          assignedEmployeeName: selectedAgent.fullName,
          assignedAt: new Date().toISOString(),
          assignmentReason: 'NEW_CONVERSATION_ASSIGNMENT',
        };
        await this.assignRepo.updateLeadMetadata(lead.id, updatedMeta);
      }

      const previousEmployeeId = currentConv.assignedEmployeeId || leadOwnerId;
      const isReassignment = !!previousEmployeeId;
      const reason: AssignmentReason = options.forceReassign
        ? 'MANUAL_REASSIGNMENT'
        : isReassignment
          ? 'OWNER_INELIGIBLE'
          : 'NEW_CONVERSATION_ASSIGNMENT';

      await this.recordAuditLog({
        tenantId: currentConv.tenantId,
        branchId: currentConv.branchId,
        conversationId: currentConv.id,
        previousEmployeeId,
        newEmployeeId: selectedAgent.employeeId,
        eventType: isReassignment ? 'reassignment' : 'initial_assignment',
        reason,
        metadata: {
          leadId: currentConv.leadId,
          strategy: rule.strategy,
          weightsSnapshot: selection.weightsSnapshot,
          requestId: options.requestId || null,
        },
      });

      return {
        conversationId: currentConv.id,
        leadId: currentConv.leadId,
        tenantId: currentConv.tenantId,
        branchId: currentConv.branchId,
        assigned: true,
        assignedEmployeeId: selectedAgent.employeeId,
        assignedEmployeeName: selectedAgent.fullName,
        strategy: rule.strategy,
        reason,
        weightsSnapshot: selection.weightsSnapshot,
        isRetained: false,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Preview Assignment (Read-only simulation)
  // ---------------------------------------------------------------------------
  public async previewAssignment(
    branchId: string,
    identityKey?: string,
  ): Promise<AssignmentPreviewResult> {
    const branch = await this.crm.getBranchById(branchId, identityKey);
    await this.validateCallerScope(branch.tenantId, branch.id, identityKey);

    const rule = await this.assignRepo.getActiveRule(branch.tenantId, branch.id);
    if (!rule) {
      throw new AssignmentRuleNotFoundError(
        `No active assignment rule configured for branch "${branchId}" or tenant fallback`,
      );
    }

    const excludedIds = (rule.configuration?.excludedEmployeeIds as string[]) || [];
    const eligibleAgents = await this.resolver.resolveEligibleAgents(
      branch.tenantId,
      branch.id,
      { identityKey, excludedEmployeeIds: excludedIds },
    );

    if (eligibleAgents.length === 0) {
      return {
        tenantId: branch.tenantId,
        branchId: branch.id,
        strategy: rule.strategy,
        ruleConfiguration: rule.configuration,
        eligibleAgents: [],
        predictedEmployeeId: null,
        predictedEmployeeName: null,
        reason: 'NO_ELIGIBLE_AGENTS',
      };
    }

    const candidates = eligibleAgents.map((a) => ({
      employeeId: a.employeeId,
      weight: a.weight,
    }));

    const currentState = await this.assignRepo.getAssignmentState(
      branch.tenantId,
      branch.id,
      rule.strategy,
    );

    const strategyImpl =
      rule.strategy === 'round_robin' ? roundRobinStrategy : weightedRoundRobinStrategy;

    // Simulation only — NO state saved
    const selection = strategyImpl.selectNext(candidates, currentState?.state);
    const predicted = eligibleAgents.find((a) => a.employeeId === selection.selectedEmployeeId);

    return {
      tenantId: branch.tenantId,
      branchId: branch.id,
      strategy: rule.strategy,
      ruleConfiguration: rule.configuration,
      eligibleAgents,
      predictedEmployeeId: predicted ? predicted.employeeId : null,
      predictedEmployeeName: predicted ? predicted.fullName : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: Scope Validation
  // ---------------------------------------------------------------------------
  public async validateCallerScope(
    tenantId: string,
    branchId: string,
    identityKey?: string,
  ): Promise<void> {
    if (!identityKey) return; // Service-to-service default or unauthenticated dev mode

    const identityRes = await this.crm.getCurrentIdentity(identityKey);
    const { identity } = identityRes;

    // Super Admin has global access
    if (identity.role === 'super_admin' || identity.tenantId === null) {
      return;
    }

    // 1. Cross-tenant check
    if (identity.tenantId !== tenantId) {
      throw new AssignmentTenantScopeError(
        `Access denied: Caller tenant ${identity.tenantId} does not match entity tenant ${tenantId}`,
      );
    }

    // 2. Branch scope check
    if (
      (identity.role === 'branch_admin' || identity.role === 'employee') &&
      identity.branchId !== null &&
      identity.branchId !== branchId
    ) {
      throw new AssignmentBranchScopeError(
        `Access denied: Caller branch ${identity.branchId} does not match entity branch ${branchId}`,
      );
    }
  }

  private async recordAuditLog(params: {
    tenantId: string;
    branchId: string;
    conversationId: string;
    previousEmployeeId: string | null;
    newEmployeeId: string | null;
    eventType: AssignmentEventType;
    reason: AssignmentReason;
    metadata: Record<string, unknown>;
  }): Promise<AssignmentAudit> {
    return this.assignRepo.recordAudit({
      tenantId: params.tenantId,
      branchId: params.branchId,
      conversationId: params.conversationId,
      previousEmployeeId: params.previousEmployeeId,
      newEmployeeId: params.newEmployeeId,
      eventType: params.eventType,
      reason: params.reason,
      metadata: params.metadata,
    });
  }
}

export const assignmentService = new AssignmentService();
