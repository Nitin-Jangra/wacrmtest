import {
  Tenant,
  Branch,
  Employee,
  ChatDesignation,
  EligibleChatAgent,
  CurrentIdentityResponse,
  ApiResponse,
} from '@gym-helpdesk/shared-types';
import { ICrmAdapter, CrmGenericFilters, CrmEmployeeFilters } from './crm.interface';
import {
  CrmAuthenticationError,
  CrmAuthorizationError,
  CrmNotFoundError,
  CrmTimeoutError,
  CrmUpstreamError,
} from './crm.errors';

export interface HttpCrmAdapterOptions {
  baseUrl: string;
  serviceToken?: string;
  defaultIdentityKey?: string;
  timeoutMs?: number;
}

export class HttpCrmAdapter implements ICrmAdapter {
  private readonly baseUrl: string;
  private readonly serviceToken?: string;
  private readonly defaultIdentityKey: string;
  private readonly timeoutMs: number;

  constructor(options: HttpCrmAdapterOptions) {
    if (!options.baseUrl) {
      throw new Error('HttpCrmAdapter requires a valid baseUrl');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.defaultIdentityKey = options.defaultIdentityKey || 'super_admin';
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async request<T>(path: string, identityKey?: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.serviceToken) {
      headers['Authorization'] = `Bearer ${this.serviceToken}`;
    }

    const effectiveIdentity = identityKey || this.defaultIdentityKey;
    if (effectiveIdentity) {
      headers['x-mock-identity'] = effectiveIdentity;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody: { error?: { code?: string; message?: string } } | undefined;
        try {
          errorBody = (await response.json()) as { error?: { code?: string; message?: string } };
        } catch {
          // ignore json parse failure for error body
        }

        const message = errorBody?.error?.message || response.statusText;

        if (response.status === 401) {
          throw new CrmAuthenticationError(message);
        }
        if (response.status === 403) {
          throw new CrmAuthorizationError(message);
        }
        if (response.status === 404) {
          throw new CrmNotFoundError(message);
        }
        if (response.status >= 500) {
          throw new CrmUpstreamError(message, errorBody);
        }

        throw new CrmUpstreamError(`HTTP error ${response.status}: ${message}`, errorBody);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === 'AbortError') {
        throw new CrmTimeoutError(
          `Request to CRM API timed out after ${this.timeoutMs}ms: GET ${path}`,
        );
      }

      // Re-throw our mapped CRM errors
      if (
        err instanceof CrmAuthenticationError ||
        err instanceof CrmAuthorizationError ||
        err instanceof CrmNotFoundError ||
        err instanceof CrmTimeoutError ||
        err instanceof CrmUpstreamError
      ) {
        throw err;
      }

      throw new CrmUpstreamError(
        `Failed to communicate with CRM API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public async checkHealth(): Promise<{ status: string; service: string; version: string }> {
    return this.request<{ status: string; service: string; version: string }>('/health');
  }

  public async getCurrentIdentity(identityKey?: string): Promise<CurrentIdentityResponse> {
    const res = await this.request<ApiResponse<CurrentIdentityResponse>>('/api/v1/me', identityKey);
    return res.data;
  }

  public async getTenantById(tenantId: string, identityKey?: string): Promise<Tenant> {
    const res = await this.request<ApiResponse<Tenant>>(`/api/v1/tenants/${tenantId}`, identityKey);
    return res.data;
  }

  public async listAccessibleTenants(
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    identityKey?: string,
  ): Promise<ApiResponse<Tenant[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.status ? { status: filters.status } : {}),
    });
    return this.request<ApiResponse<Tenant[]>>(`/api/v1/tenants?${params.toString()}`, identityKey);
  }

  public async listBranchesByTenant(
    tenantId: string,
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    identityKey?: string,
  ): Promise<ApiResponse<Branch[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.status ? { status: filters.status } : {}),
    });
    return this.request<ApiResponse<Branch[]>>(
      `/api/v1/tenants/${tenantId}/branches?${params.toString()}`,
      identityKey,
    );
  }

  public async getBranchById(branchId: string, identityKey?: string): Promise<Branch> {
    const res = await this.request<ApiResponse<Branch>>(
      `/api/v1/branches/${branchId}`,
      identityKey,
    );
    return res.data;
  }

  public async listEmployeesByTenant(
    tenantId: string,
    filters?: CrmEmployeeFilters,
    page: number = 1,
    limit: number = 20,
    identityKey?: string,
  ): Promise<ApiResponse<Employee[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(filters?.role ? { role: filters.role } : {}),
      ...(filters?.chatEligible !== undefined
        ? { chatEligible: String(filters.chatEligible) }
        : {}),
    });
    return this.request<ApiResponse<Employee[]>>(
      `/api/v1/tenants/${tenantId}/employees?${params.toString()}`,
      identityKey,
    );
  }

  public async listEmployeesByBranch(
    branchId: string,
    filters?: CrmEmployeeFilters,
    page: number = 1,
    limit: number = 20,
    identityKey?: string,
  ): Promise<ApiResponse<Employee[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.role ? { role: filters.role } : {}),
      ...(filters?.chatEligible !== undefined
        ? { chatEligible: String(filters.chatEligible) }
        : {}),
    });
    return this.request<ApiResponse<Employee[]>>(
      `/api/v1/branches/${branchId}/employees?${params.toString()}`,
      identityKey,
    );
  }

  public async getEmployeeById(employeeId: string, identityKey?: string): Promise<Employee> {
    const res = await this.request<ApiResponse<Employee>>(
      `/api/v1/employees/${employeeId}`,
      identityKey,
    );
    return res.data;
  }

  public async listChatDesignations(
    tenantId: string,
    filters?: CrmGenericFilters,
    page: number = 1,
    limit: number = 20,
    identityKey?: string,
  ): Promise<ApiResponse<ChatDesignation[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.status ? { status: filters.status } : {}),
    });
    return this.request<ApiResponse<ChatDesignation[]>>(
      `/api/v1/tenants/${tenantId}/chat-designations?${params.toString()}`,
      identityKey,
    );
  }

  public async getChatDesignationById(
    designationId: string,
    identityKey?: string,
  ): Promise<ChatDesignation> {
    const res = await this.request<ApiResponse<ChatDesignation>>(
      `/api/v1/chat-designations/${designationId}`,
      identityKey,
    );
    return res.data;
  }

  public async listEligibleChatAgents(
    branchId: string,
    identityKey?: string,
  ): Promise<EligibleChatAgent[]> {
    const res = await this.request<ApiResponse<EligibleChatAgent[]>>(
      `/api/v1/branches/${branchId}/chat-agents`,
      identityKey,
    );
    return res.data;
  }
}
