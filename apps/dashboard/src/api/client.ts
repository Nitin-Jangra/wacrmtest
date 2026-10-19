import {
  Conversation,
  ConversationStatus,
  Message,
  Lead,
  FollowUp,
  AssignmentAudit,
  EligibleChatAgent,
  Tenant,
  Branch,
  Employee,
  CurrentIdentityResponse,
} from '@gym-helpdesk/shared-types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ListConversationsParams {
  tenantId: string;
  branchId?: string;
  status?: ConversationStatus;
  assignedEmployeeId?: string;
  page?: number;
  limit?: number;
}

export interface ListResponse<T> {
  data: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class HelpdeskApiClient {
  private baseUrl: string;
  private currentIdentityKey: string = 'alpha_branch_admin';

  constructor(baseUrl?: string) {
    const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL;
    this.baseUrl = baseUrl || envUrl || '/api/v1';
  }

  public setIdentity(identityKey: string): void {
    this.currentIdentityKey = identityKey;
  }

  public getIdentity(): string {
    return this.currentIdentityKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    headers.set('Content-Type', 'application/json');
    if (this.currentIdentityKey) {
      headers.set('x-mock-identity', this.currentIdentityKey);
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorCode = 'REQUEST_FAILED';
        let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
        let details: unknown;

        if (contentType.includes('application/json')) {
          try {
            const errorJson = (await response.json()) as any;
            if (errorJson.error) {
              errorCode = errorJson.error.code || errorCode;
              errorMessage = errorJson.error.message || errorMessage;
              details = errorJson.error.details;
            }
          } catch {
            // fallback to status text
          }
        }
        throw new ApiError(response.status, errorCode, errorMessage, details);
      }

      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'NETWORK_ERROR', (err as Error)?.message || 'Failed to connect to backend server');
    }
  }

  // ---------------------------------------------------------------------------
  // CRM Adapter & Identity
  // ---------------------------------------------------------------------------
  public async getCurrentIdentity(): Promise<CurrentIdentityResponse> {
    const res = await this.request<{ data: CurrentIdentityResponse }>('/crm/me');
    return res.data;
  }

  public async listTenants(): Promise<ListResponse<Tenant>> {
    return this.request<ListResponse<Tenant>>('/crm/tenants');
  }

  public async listBranches(tenantId: string): Promise<ListResponse<Branch>> {
    return this.request<ListResponse<Branch>>(`/crm/tenants/${tenantId}/branches`);
  }

  public async listEmployees(branchId: string): Promise<ListResponse<Employee>> {
    return this.request<ListResponse<Employee>>(`/crm/branches/${branchId}/employees`);
  }

  public async getEmployee(employeeId: string): Promise<Employee> {
    const res = await this.request<{ data: Employee }>(`/crm/employees/${employeeId}`);
    return res.data;
  }

  public async listBranchChatAgents(branchId: string): Promise<EligibleChatAgent[]> {
    const res = await this.request<{ data: EligibleChatAgent[] }>(`/crm/branches/${branchId}/chat-agents`);
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------
  public async listConversations(params: ListConversationsParams): Promise<ListResponse<Conversation>> {
    const query = new URLSearchParams();
    query.set('tenantId', params.tenantId);
    if (params.branchId) query.set('branchId', params.branchId);
    if (params.status) query.set('status', params.status);
    if (params.assignedEmployeeId) query.set('assignedEmployeeId', params.assignedEmployeeId);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    return this.request<ListResponse<Conversation>>(`/conversations?${query.toString()}`);
  }

  public async getConversation(id: string): Promise<Conversation> {
    const res = await this.request<{ data: Conversation }>(`/conversations/${id}`);
    return res.data;
  }

  public async updateConversationStatus(id: string, status: ConversationStatus): Promise<Conversation> {
    const res = await this.request<{ data: Conversation }>(`/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data;
  }

  public async transferConversation(id: string, targetEmployeeId: string): Promise<unknown> {
    const res = await this.request<{ data: unknown }>(`/conversations/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ targetEmployeeId }),
    });
    return res.data;
  }

  public async listMessages(conversationId: string, page: number = 1, limit: number = 50): Promise<ListResponse<Message>> {
    return this.request<ListResponse<Message>>(
      `/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    );
  }

  public async sendTextMessage(conversationId: string, text: string): Promise<Message> {
    const res = await this.request<{ data: Message; status: string }>(
      `/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ type: 'text', text }),
      },
    );
    return res.data;
  }

  public async getConversationAudit(conversationId: string): Promise<AssignmentAudit[]> {
    const res = await this.request<{ data: AssignmentAudit[] }>(`/conversations/${conversationId}/audit`);
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------
  public async getLead(leadId: string): Promise<Lead> {
    const res = await this.request<{ data: Lead }>(`/leads/${leadId}`);
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Follow-Ups
  // ---------------------------------------------------------------------------
  public async listFollowUps(params: {
    tenantId: string;
    branchId?: string;
    status?: string;
    conversationId?: string;
    assignedEmployeeId?: string;
  }): Promise<FollowUp[]> {
    const query = new URLSearchParams();
    query.set('tenantId', params.tenantId);
    if (params.branchId) query.set('branchId', params.branchId);
    if (params.status) query.set('status', params.status);
    if (params.conversationId) query.set('conversationId', params.conversationId);
    if (params.assignedEmployeeId) query.set('assignedEmployeeId', params.assignedEmployeeId);

    const res = await this.request<{ data: FollowUp[] }>(`/follow-ups?${query.toString()}`);
    return res.data;
  }

  public async scheduleFollowUp(data: {
    tenantId: string;
    branchId: string;
    conversationId: string;
    assignedEmployeeId: string;
    scheduledAt: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'overdue';
    note?: string | null;
  }): Promise<FollowUp> {
    const res = await this.request<{ data: FollowUp }>('/follow-ups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async updateFollowUp(
    id: string,
    updates: { status?: string; note?: string | null; scheduledAt?: string },
  ): Promise<FollowUp> {
    const res = await this.request<{ data: FollowUp }>(`/follow-ups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res.data;
  }
}

export const apiClient = new HelpdeskApiClient();
