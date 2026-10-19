import { z } from 'zod';

// ============================================================================
// Core CRM Domain Entities (External CRM Source of Truth)
// ============================================================================

export type EntityStatus = 'active' | 'inactive';

export type CrmRole = 'super_admin' | 'tenant_admin' | 'branch_admin' | 'employee';

export interface Tenant {
  id: string; // UUID
  name: string;
  status: EntityStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface Branch {
  id: string; // UUID
  tenantId: string; // UUID
  name: string;
  city: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatDesignation {
  id: string; // UUID
  tenantId: string; // UUID
  name: string;
  description: string;
  status?: EntityStatus;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string; // UUID
  tenantId: string; // UUID
  branchId: string; // UUID
  fullName: string;
  email: string;
  status: EntityStatus;
  crmRole: CrmRole;
  chatSupportEligible: boolean;
  designationId: string | null; // UUID or null
  createdAt: string;
  updatedAt: string;
}

export interface EligibleChatAgent {
  employeeId: string;
  tenantId: string;
  branchId: string;
  fullName: string;
  email: string;
  designationId: string;
  designationName: string;
  eligibilityStatus: boolean;
  employeeStatus: EntityStatus;
  exampleAssignmentWeight?: number;
}

// ============================================================================
// Permissions and Authorization
// ============================================================================

export type Permission =
  | 'tenants:read'
  | 'branches:read'
  | 'employees:read'
  | 'designations:read'
  | 'employees:manage'
  | 'chat_agents:read'
  | 'channels:read'
  | 'channels:manage'
  | 'conversations:read'
  | 'conversations:manage'
  | 'leads:read'
  | 'leads:manage';

export type MockIdentityKey =
  | 'super_admin'
  | 'alpha_admin'
  | 'alpha_branch_admin'
  | 'alpha_employee'
  | 'beta_admin'
  | 'beta_branch_admin'
  | 'beta_employee';

export interface MockIdentity {
  key: MockIdentityKey;
  userId: string;
  name: string;
  email: string;
  role: CrmRole;
  tenantId: string | null;
  branchId: string | null;
  permissions: Permission[];
}

export interface CurrentIdentityResponse {
  identity: MockIdentity;
  scope: {
    isSuperAdmin: boolean;
    authorizedTenantId: string | null;
    authorizedBranchId: string | null;
    allowedPermissions: Permission[];
  };
}

// ============================================================================
// Phase 2: Helpdesk Persistent Domain Entities (Supabase Owned)
// ============================================================================

export type ChannelStatus = 'draft' | 'active' | 'inactive' | 'disconnected';

export interface WhatsAppChannel {
  id: string;
  tenantId: string;
  branchId: string;
  provider: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string;
  status: ChannelStatus;
  credentialReference: string | null;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAgentSetting {
  id: string;
  tenantId: string;
  branchId: string;
  employeeId: string;
  designationId: string | null;
  isEligible: boolean;
  assignmentWeight: number;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStrategy = 'round_robin' | 'weighted_round_robin' | 'least_active' | 'manual';

export interface ChatAssignmentRule {
  id: string;
  tenantId: string;
  branchId: string | null;
  strategy: AssignmentStrategy;
  isEnabled: boolean;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAssignmentState {
  id: string;
  tenantId: string;
  branchId: string;
  strategy: string;
  state: Record<string, unknown>;
  updatedAt: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  branchId: string;
  externalContactId: string | null;
  name: string | null;
  phoneNumber: string | null;
  email: string | null;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ConversationStatus = 'open' | 'on_hold' | 'resolved' | 'closed';

export interface Conversation {
  id: string;
  tenantId: string;
  branchId: string;
  leadId: string;
  channelId: string;
  assignedEmployeeId: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'template';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  tenantId: string;
  branchId: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: MessageDirection;
  messageType: MessageType;
  body: string | null;
  payload: Record<string, unknown>;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export type FollowUpStatus = 'scheduled' | 'completed' | 'cancelled' | 'overdue';

export interface FollowUp {
  id: string;
  tenantId: string;
  branchId: string;
  conversationId: string;
  assignedEmployeeId: string;
  scheduledAt: string;
  status: FollowUpStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentEventType =
  | 'initial_assignment'
  | 'reassignment'
  | 'manual_transfer'
  | 'agent_unassigned';

export interface AssignmentAudit {
  id: string;
  tenantId: string;
  branchId: string;
  conversationId: string;
  previousEmployeeId: string | null;
  newEmployeeId: string | null;
  eventType: AssignmentEventType;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type WebhookProcessingStatus =
  | 'received'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'ignored';

export interface WebhookEvent {
  id: string;
  provider: string;
  externalEventId: string;
  tenantId: string | null;
  channelId: string | null;
  eventType: string;
  processingStatus: WebhookProcessingStatus;
  receivedAt: string;
  processedAt: string | null;
  errorCode: string | null;
}

// ============================================================================
// API Envelopes and Pagination
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const UuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page must be a positive integer >= 1',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'limit must be between 1 and 100',
    }),
});

export const EmployeeFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  branchId: z.string().uuid().optional(),
  role: z.enum(['super_admin', 'tenant_admin', 'branch_admin', 'employee']).optional(),
  chatEligible: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined)),
});

export const BranchFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export const DesignationFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

// DTO Schemas for Helpdesk Persistence
export const CreateChannelSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  provider: z.string().min(1).default('meta_cloud'),
  phoneNumberId: z.string().nullable().optional(),
  wabaId: z.string().nullable().optional(),
  displayName: z.string().min(1).max(150),
  status: z.enum(['draft', 'active', 'inactive', 'disconnected']).default('draft'),
  credentialReference: z.string().nullable().optional(),
  configuration: z.record(z.unknown()).default({}),
});

export const CreateAgentSettingSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  employeeId: z.string().uuid(),
  designationId: z.string().uuid().nullable().optional(),
  isEligible: z.boolean().default(true),
  assignmentWeight: z.number().int().min(0).default(10),
});

export const CreateLeadSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  externalContactId: z.string().nullable().optional(),
  name: z.string().max(150).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  source: z.string().default('whatsapp'),
  metadata: z.record(z.unknown()).default({}),
});

export const CreateConversationSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  leadId: z.string().uuid(),
  channelId: z.string().uuid(),
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'on_hold', 'resolved', 'closed']).default('open'),
});

export const CreateMessageSchema = z.object({
  externalMessageId: z.string().nullable().optional(),
  direction: z.enum(['inbound', 'outbound']),
  messageType: z
    .enum(['text', 'image', 'document', 'audio', 'video', 'location', 'template'])
    .default('text'),
  body: z.string().nullable().optional(),
  payload: z.record(z.unknown()).default({}),
  deliveryStatus: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).default('sent'),
});

export const CreateFollowUpSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  conversationId: z.string().uuid(),
  assignedEmployeeId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'overdue']).default('scheduled'),
  note: z.string().nullable().optional(),
});

// Phase 3: Lead & Conversation Assignment DTOs
export const AssignLeadSchema = z.object({
  forceReassign: z.boolean().optional(),
  requestId: z.string().max(100).optional(),
});

export const AssignConversationSchema = z.object({
  forceReassign: z.boolean().optional(),
  targetEmployeeId: z.string().uuid().optional(),
  requestId: z.string().max(100).optional(),
});
export type AssignConversationDto = z.infer<typeof AssignConversationSchema>;

export const UpdateConversationStatusSchema = z.object({
  status: z.enum(['open', 'on_hold', 'resolved', 'closed']),
});
export type UpdateConversationStatusDto = z.infer<typeof UpdateConversationStatusSchema>;

export const UpdateFollowUpSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'overdue']).optional(),
  note: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type UpdateFollowUpDto = z.infer<typeof UpdateFollowUpSchema>;

export const UpdateAgentSettingSchema = z.object({
  isEligible: z.boolean().optional(),
  assignmentWeight: z.number().int().min(0).optional(),
  designationId: z.string().uuid().nullable().optional(),
});

// Phase 4: WhatsApp Cloud API DTOs
export const SendTextMessageSchema = z.object({
  type: z.literal('text').default('text'),
  text: z.string().min(1, 'Message text is required'),
});

export type SendTextMessageDto = z.infer<typeof SendTextMessageSchema>;

export const WhatsAppWebhookVerifyQuerySchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

export type WhatsAppWebhookVerifyQuery = z.infer<typeof WhatsAppWebhookVerifyQuerySchema>;

export interface MetaWhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };
  audio?: {
    id?: string;
    mime_type?: string;
  };
  document?: {
    id?: string;
    filename?: string;
    mime_type?: string;
  };
  [key: string]: unknown;
}

export interface MetaWhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface MetaWhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  messages?: MetaWhatsAppMessage[];
  statuses?: MetaWhatsAppStatus[];
}

export interface MetaWhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    field: string;
    value: MetaWhatsAppChangeValue;
  }>;
}

export interface MetaWhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: MetaWhatsAppWebhookEntry[];
}

