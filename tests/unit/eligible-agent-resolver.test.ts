import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EligibleAgentResolver } from '../../apps/api/src/services/assignment/resolvers/eligible-agent.resolver';
import { MockCrmAdapter } from '../../apps/api/src/integrations/crm/mock-crm.adapter';
import { HelpdeskRepository } from '../../apps/api/src/repositories/helpdesk.repository';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_SR_EXEC_ID,
  ALPHA_DESIG_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';
import { ChatAgentSetting } from '@gym-helpdesk/shared-types';

describe('EligibleAgentResolver Unit Tests', () => {
  let resolver: EligibleAgentResolver;
  let mockCrm: MockCrmAdapter;
  let mockRepo: HelpdeskRepository;

  beforeEach(() => {
    mockCrm = new MockCrmAdapter();
    mockRepo = new HelpdeskRepository();
    resolver = new EligibleAgentResolver(mockCrm, mockRepo);
  });

  it('resolves eligible agents when CRM and Helpdesk settings match criteria', async () => {
    // In Mock CRM fixtures for Greater Noida:
    // e1111111-0001-... Aarav Sharma (active, chatSupportEligible, desig SR_EXEC)
    // e1111111-0002-... Diya Patel (active, chatSupportEligible, desig EXEC)
    // e1111111-0003-... Ishaan Gupta (chatSupportEligible: false)
    // e1111111-0004-... Ananya Verma (status: inactive)

    const mockSettings: ChatAgentSetting[] = [
      {
        id: 's1',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        designationId: ALPHA_DESIG_SR_EXEC_ID,
        isEligible: true,
        assignmentWeight: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's2',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0002-4000-8000-000000000002',
        designationId: ALPHA_DESIG_EXEC_ID,
        isEligible: true,
        assignmentWeight: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(mockRepo, 'listAgentSettings').mockResolvedValue(mockSettings);

    const eligible = await resolver.resolveEligibleAgents(
      TENANT_ALPHA_ID,
      ALPHA_BRANCH_GREATER_NOIDA_ID,
    );

    expect(eligible.length).toBe(2);
    expect(eligible[0]!.employeeId).toBe('e1111111-0001-4000-8000-000000000001');
    expect(eligible[0]!.weight).toBe(15);
    expect(eligible[1]!.employeeId).toBe('e1111111-0002-4000-8000-000000000002');
    expect(eligible[1]!.weight).toBe(10);
  });

  it('excludes agents with assignment weight = 0', async () => {
    const mockSettings: ChatAgentSetting[] = [
      {
        id: 's1',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        designationId: ALPHA_DESIG_SR_EXEC_ID,
        isEligible: true,
        assignmentWeight: 0, // Zero weight
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's2',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0002-4000-8000-000000000002',
        designationId: ALPHA_DESIG_EXEC_ID,
        isEligible: true,
        assignmentWeight: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(mockRepo, 'listAgentSettings').mockResolvedValue(mockSettings);

    const eligible = await resolver.resolveEligibleAgents(
      TENANT_ALPHA_ID,
      ALPHA_BRANCH_GREATER_NOIDA_ID,
    );

    expect(eligible.length).toBe(1);
    expect(eligible[0]!.employeeId).toBe('e1111111-0002-4000-8000-000000000002');
  });

  it('excludes agents with isEligible = false', async () => {
    const mockSettings: ChatAgentSetting[] = [
      {
        id: 's1',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        designationId: ALPHA_DESIG_SR_EXEC_ID,
        isEligible: false, // Disabled
        assignmentWeight: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(mockRepo, 'listAgentSettings').mockResolvedValue(mockSettings);

    const eligible = await resolver.resolveEligibleAgents(
      TENANT_ALPHA_ID,
      ALPHA_BRANCH_GREATER_NOIDA_ID,
    );

    expect(eligible.length).toBe(0);
  });

  it('excludes agents that are explicitly excluded by rule configuration', async () => {
    const mockSettings: ChatAgentSetting[] = [
      {
        id: 's1',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0001-4000-8000-000000000001',
        designationId: ALPHA_DESIG_SR_EXEC_ID,
        isEligible: true,
        assignmentWeight: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's2',
        tenantId: TENANT_ALPHA_ID,
        branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
        employeeId: 'e1111111-0002-4000-8000-000000000002',
        designationId: ALPHA_DESIG_EXEC_ID,
        isEligible: true,
        assignmentWeight: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(mockRepo, 'listAgentSettings').mockResolvedValue(mockSettings);

    const eligible = await resolver.resolveEligibleAgents(
      TENANT_ALPHA_ID,
      ALPHA_BRANCH_GREATER_NOIDA_ID,
      { excludedEmployeeIds: ['e1111111-0001-4000-8000-000000000001'] },
    );

    expect(eligible.length).toBe(1);
    expect(eligible[0]!.employeeId).toBe('e1111111-0002-4000-8000-000000000002');
  });
});
