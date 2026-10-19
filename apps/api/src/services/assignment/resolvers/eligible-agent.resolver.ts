import { ICrmAdapter } from '../../../integrations/crm/crm.interface';
import { crmAdapter } from '../../../integrations/crm/crm-adapter.factory';
import { HelpdeskRepository, helpdeskRepository } from '../../../repositories/helpdesk.repository';

export interface ResolvedEligibleAgent {
  employeeId: string;
  tenantId: string;
  branchId: string;
  fullName: string;
  email: string;
  designationId: string;
  designationName: string;
  weight: number;
}

export interface ResolveEligibleAgentsOptions {
  identityKey?: string;
  excludedEmployeeIds?: string[];
}

export class EligibleAgentResolver {
  constructor(
    private crm: ICrmAdapter = crmAdapter,
    private readonly repo: HelpdeskRepository = helpdeskRepository,
  ) {}

  public setCrmAdapter(crm: ICrmAdapter): void {
    this.crm = crm;
  }

  /**
   * Resolves eligible chat agents for a specific branch by checking:
   * 1. CRM Employee belongs to exact tenant and branch
   * 2. CRM Employee status is active and chatSupportEligible is true
   * 3. Helpdesk Agent Setting exists, isEligible = true, and assignmentWeight > 0
   * 4. Agent designation is valid and active in CRM for the tenant
   * 5. Agent is not in excludedEmployeeIds from rule configuration
   */
  public async resolveEligibleAgents(
    tenantId: string,
    branchId: string,
    options: ResolveEligibleAgentsOptions = {},
  ): Promise<ResolvedEligibleAgent[]> {
    const { identityKey, excludedEmployeeIds = [] } = options;
    const excludedSet = new Set(excludedEmployeeIds);

    // 1. Fetch eligible chat agents from CRM adapter
    const crmAgents = await this.crm.listEligibleChatAgents(branchId, identityKey);

    // 2. Fetch tenant designations to ensure designation is active and tenant-scoped
    const designationsRes = await this.crm.listChatDesignations(
      tenantId,
      { status: 'active' },
      1,
      100,
      identityKey,
    );
    const activeDesignationIds = new Set((designationsRes.data || []).map((d) => d.id));

    // 3. Fetch Helpdesk agent settings from repository
    const settings = await this.repo.listAgentSettings(tenantId, branchId);
    const settingsByEmployeeId = new Map(settings.map((s) => [s.employeeId, s]));

    const eligibleAgents: ResolvedEligibleAgent[] = [];

    for (const agent of crmAgents) {
      // Must match branch and tenant
      if (agent.tenantId !== tenantId || agent.branchId !== branchId) {
        continue;
      }

      // Must be active and eligible in CRM
      if (agent.employeeStatus !== 'active' || !agent.eligibilityStatus) {
        continue;
      }

      // Must not be excluded by assignment rule
      if (excludedSet.has(agent.employeeId)) {
        continue;
      }

      // Designation check: must belong to active tenant designations
      if (agent.designationId && !activeDesignationIds.has(agent.designationId)) {
        continue;
      }

      // Helpdesk agent setting check
      const setting = settingsByEmployeeId.get(agent.employeeId);
      if (!setting || !setting.isEligible || setting.assignmentWeight <= 0) {
        // Unconfigured agents or disabled/zero-weight agents are not eligible
        continue;
      }

      // Designation override check from settings if specified
      if (setting.designationId && !activeDesignationIds.has(setting.designationId)) {
        continue;
      }

      eligibleAgents.push({
        employeeId: agent.employeeId,
        tenantId: agent.tenantId,
        branchId: agent.branchId,
        fullName: agent.fullName,
        email: agent.email,
        designationId: agent.designationId,
        designationName: agent.designationName,
        weight: setting.assignmentWeight,
      });
    }

    return eligibleAgents;
  }
}

export const eligibleAgentResolver = new EligibleAgentResolver();
