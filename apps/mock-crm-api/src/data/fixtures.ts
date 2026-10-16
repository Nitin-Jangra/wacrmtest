import { Tenant, Branch, ChatDesignation, Employee } from '@gym-helpdesk/shared-types';

export const TENANT_ALPHA_ID = '11111111-1111-4000-8000-000000000001';
export const TENANT_BETA_ID = '22222222-2222-4000-8000-000000000002';

export const ALPHA_BRANCH_GREATER_NOIDA_ID = 'aaaaaaaa-0001-4000-8000-000000000001';
export const ALPHA_BRANCH_NOIDA_ID = 'aaaaaaaa-0002-4000-8000-000000000002';

export const BETA_BRANCH_JAIPUR_ID = 'bbbbbbbb-0001-4000-8000-000000000001';
export const BETA_BRANCH_GURUGRAM_ID = 'bbbbbbbb-0002-4000-8000-000000000002';

export const FIXTURE_TENANTS: Tenant[] = [
  {
    id: TENANT_ALPHA_ID,
    name: 'Tenant Alpha',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      tier: 'enterprise',
      region: 'North India',
    },
  },
  {
    id: TENANT_BETA_ID,
    name: 'Tenant Beta',
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    metadata: {
      tier: 'standard',
      region: 'West/North India',
    },
  },
];

export const FIXTURE_BRANCHES: Branch[] = [
  // Tenant Alpha branches
  {
    id: ALPHA_BRANCH_GREATER_NOIDA_ID,
    tenantId: TENANT_ALPHA_ID,
    name: 'Alpha — Greater Noida',
    city: 'Greater Noida',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: ALPHA_BRANCH_NOIDA_ID,
    tenantId: TENANT_ALPHA_ID,
    name: 'Alpha — Noida',
    city: 'Noida',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
  // Tenant Beta branches
  {
    id: BETA_BRANCH_JAIPUR_ID,
    tenantId: TENANT_BETA_ID,
    name: 'Beta — Jaipur',
    city: 'Jaipur',
    status: 'active',
    createdAt: '2026-01-16T00:00:00.000Z',
    updatedAt: '2026-01-16T00:00:00.000Z',
  },
  {
    id: BETA_BRANCH_GURUGRAM_ID,
    tenantId: TENANT_BETA_ID,
    name: 'Beta — Gurugram',
    city: 'Gurugram',
    status: 'active',
    createdAt: '2026-01-17T00:00:00.000Z',
    updatedAt: '2026-01-17T00:00:00.000Z',
  },
];

export const ALPHA_DESIG_EXEC_ID = 'd1111111-0001-4000-8000-000000000001';
export const ALPHA_DESIG_SR_EXEC_ID = 'd1111111-0002-4000-8000-000000000002';
export const ALPHA_DESIG_MGR_ID = 'd1111111-0003-4000-8000-000000000003';

export const BETA_DESIG_CARE_AGENT_ID = 'd2222222-0001-4000-8000-000000000001';
export const BETA_DESIG_SALES_EXEC_ID = 'd2222222-0002-4000-8000-000000000002';
export const BETA_DESIG_CSM_ID = 'd2222222-0003-4000-8000-000000000003';

export const FIXTURE_DESIGNATIONS: ChatDesignation[] = [
  // Tenant Alpha designations
  {
    id: ALPHA_DESIG_EXEC_ID,
    tenantId: TENANT_ALPHA_ID,
    name: 'Chat Support Executive',
    description: 'Frontline chat handling for inquiries and memberships',
    status: 'active',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: ALPHA_DESIG_SR_EXEC_ID,
    tenantId: TENANT_ALPHA_ID,
    name: 'Senior Chat Executive',
    description: 'Escalations and complex customer support handling',
    status: 'active',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: ALPHA_DESIG_MGR_ID,
    tenantId: TENANT_ALPHA_ID,
    name: 'Chat Support Manager',
    description: 'Team lead and queue supervisor (inactive designation)',
    status: 'inactive',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  // Tenant Beta designations
  {
    id: BETA_DESIG_CARE_AGENT_ID,
    tenantId: TENANT_BETA_ID,
    name: 'Customer Care Agent',
    description: 'Primary customer support and live query resolution',
    status: 'active',
    createdAt: '2026-01-18T00:00:00.000Z',
    updatedAt: '2026-01-18T00:00:00.000Z',
  },
  {
    id: BETA_DESIG_SALES_EXEC_ID,
    tenantId: TENANT_BETA_ID,
    name: 'Sales Support Executive',
    description: 'Inbound trial booking and sales chat management',
    status: 'active',
    createdAt: '2026-01-18T00:00:00.000Z',
    updatedAt: '2026-01-18T00:00:00.000Z',
  },
  {
    id: BETA_DESIG_CSM_ID,
    tenantId: TENANT_BETA_ID,
    name: 'Customer Success Manager',
    description: 'Retention and VIP member relationship management',
    status: 'active',
    createdAt: '2026-01-18T00:00:00.000Z',
    updatedAt: '2026-01-18T00:00:00.000Z',
  },
];

export const FIXTURE_EMPLOYEES: Employee[] = [
  // ==========================================
  // Tenant Alpha — Greater Noida Branch (4 employees)
  // ==========================================
  {
    id: 'e1111111-0001-4000-8000-000000000001',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
    fullName: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    status: 'active',
    crmRole: 'branch_admin',
    chatSupportEligible: true,
    designationId: ALPHA_DESIG_SR_EXEC_ID,
    createdAt: '2026-01-06T00:00:00.000Z',
    updatedAt: '2026-01-06T00:00:00.000Z',
  },
  {
    id: 'e1111111-0002-4000-8000-000000000002',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
    fullName: 'Diya Patel',
    email: 'diya.patel@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: true,
    designationId: ALPHA_DESIG_EXEC_ID,
    createdAt: '2026-01-06T00:00:00.000Z',
    updatedAt: '2026-01-06T00:00:00.000Z',
  },
  {
    id: 'e1111111-0003-4000-8000-000000000003',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
    fullName: 'Ishaan Gupta',
    email: 'ishaan.gupta@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-06T00:00:00.000Z',
    updatedAt: '2026-01-06T00:00:00.000Z',
  },
  {
    id: 'e1111111-0004-4000-8000-000000000004',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_GREATER_NOIDA_ID,
    fullName: 'Ananya Verma',
    email: 'ananya.verma@example.com',
    status: 'inactive', // inactive employee
    crmRole: 'employee',
    chatSupportEligible: true, // eligible flag true, but inactive status should filter them out from chat agents
    designationId: ALPHA_DESIG_EXEC_ID,
    createdAt: '2026-01-06T00:00:00.000Z',
    updatedAt: '2026-01-06T00:00:00.000Z',
  },

  // ==========================================
  // Tenant Alpha — Noida Branch (4 employees)
  // ==========================================
  {
    id: 'e1111111-0005-4000-8000-000000000005',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_NOIDA_ID,
    fullName: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    status: 'active',
    crmRole: 'tenant_admin',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-07T00:00:00.000Z',
    updatedAt: '2026-01-07T00:00:00.000Z',
  },
  {
    id: 'e1111111-0006-4000-8000-000000000006',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_NOIDA_ID,
    fullName: 'Sneha Rao',
    email: 'sneha.rao@example.com',
    status: 'active',
    crmRole: 'branch_admin',
    chatSupportEligible: true,
    designationId: ALPHA_DESIG_SR_EXEC_ID,
    createdAt: '2026-01-07T00:00:00.000Z',
    updatedAt: '2026-01-07T00:00:00.000Z',
  },
  {
    id: 'e1111111-0007-4000-8000-000000000007',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_NOIDA_ID,
    fullName: 'Kabir Singh',
    email: 'kabir.singh@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: true,
    designationId: ALPHA_DESIG_EXEC_ID,
    createdAt: '2026-01-07T00:00:00.000Z',
    updatedAt: '2026-01-07T00:00:00.000Z',
  },
  {
    id: 'e1111111-0008-4000-8000-000000000008',
    tenantId: TENANT_ALPHA_ID,
    branchId: ALPHA_BRANCH_NOIDA_ID,
    fullName: 'Pooja Nair',
    email: 'pooja.nair@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-07T00:00:00.000Z',
    updatedAt: '2026-01-07T00:00:00.000Z',
  },

  // ==========================================
  // Tenant Beta — Jaipur Branch (4 employees)
  // ==========================================
  {
    id: 'e2222222-0001-4000-8000-000000000001',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_JAIPUR_ID,
    fullName: 'Vikram Rathore',
    email: 'vikram.rathore@example.com',
    status: 'active',
    crmRole: 'tenant_admin',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-20T00:00:00.000Z',
    updatedAt: '2026-01-20T00:00:00.000Z',
  },
  {
    id: 'e2222222-0002-4000-8000-000000000002',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_JAIPUR_ID,
    fullName: 'Meera Joshi',
    email: 'meera.joshi@example.com',
    status: 'active',
    crmRole: 'branch_admin',
    chatSupportEligible: true,
    designationId: BETA_DESIG_CSM_ID,
    createdAt: '2026-01-20T00:00:00.000Z',
    updatedAt: '2026-01-20T00:00:00.000Z',
  },
  {
    id: 'e2222222-0003-4000-8000-000000000003',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_JAIPUR_ID,
    fullName: 'Karan Malhotra',
    email: 'karan.malhotra@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: true,
    designationId: BETA_DESIG_CARE_AGENT_ID,
    createdAt: '2026-01-20T00:00:00.000Z',
    updatedAt: '2026-01-20T00:00:00.000Z',
  },
  {
    id: 'e2222222-0004-4000-8000-000000000004',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_JAIPUR_ID,
    fullName: 'Simran Kaur',
    email: 'simran.kaur@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-20T00:00:00.000Z',
    updatedAt: '2026-01-20T00:00:00.000Z',
  },

  // ==========================================
  // Tenant Beta — Gurugram Branch (4 employees)
  // ==========================================
  {
    id: 'e2222222-0005-4000-8000-000000000005',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_GURUGRAM_ID,
    fullName: 'Aditya Roy',
    email: 'aditya.roy@example.com',
    status: 'active',
    crmRole: 'branch_admin',
    chatSupportEligible: true,
    designationId: BETA_DESIG_SALES_EXEC_ID,
    createdAt: '2026-01-21T00:00:00.000Z',
    updatedAt: '2026-01-21T00:00:00.000Z',
  },
  {
    id: 'e2222222-0006-4000-8000-000000000006',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_GURUGRAM_ID,
    fullName: 'Neha Kapoor',
    email: 'neha.kapoor@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: true,
    designationId: BETA_DESIG_CARE_AGENT_ID,
    createdAt: '2026-01-21T00:00:00.000Z',
    updatedAt: '2026-01-21T00:00:00.000Z',
  },
  {
    id: 'e2222222-0007-4000-8000-000000000007',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_GURUGRAM_ID,
    fullName: 'Siddharth Jain',
    email: 'siddharth.jain@example.com',
    status: 'inactive', // inactive employee
    crmRole: 'employee',
    chatSupportEligible: false,
    designationId: null,
    createdAt: '2026-01-21T00:00:00.000Z',
    updatedAt: '2026-01-21T00:00:00.000Z',
  },
  {
    id: 'e2222222-0008-4000-8000-000000000008',
    tenantId: TENANT_BETA_ID,
    branchId: BETA_BRANCH_GURUGRAM_ID,
    fullName: 'Tanvi Saxena',
    email: 'tanvi.saxena@example.com',
    status: 'active',
    crmRole: 'employee',
    chatSupportEligible: true,
    designationId: BETA_DESIG_SALES_EXEC_ID,
    createdAt: '2026-01-21T00:00:00.000Z',
    updatedAt: '2026-01-21T00:00:00.000Z',
  },
];
