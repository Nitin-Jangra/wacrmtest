import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CurrentIdentityResponse } from '@gym-helpdesk/shared-types';
import { apiClient, ApiError } from '../api/client';

export interface AvailableIdentity {
  key: string;
  name: string;
  role: string;
  badge: string;
  tenantName: string;
}

export const MOCK_IDENTITIES: AvailableIdentity[] = [
  {
    key: 'alpha_branch_admin',
    name: 'Aarav Sharma (Branch Lead)',
    role: 'branch_admin',
    badge: 'Greater Noida Hub',
    tenantName: 'M Square Professionals',
  },
  {
    key: 'alpha_employee',
    name: 'Diya Patel (Helpdesk Specialist)',
    role: 'employee',
    badge: 'Greater Noida Support',
    tenantName: 'M Square Professionals',
  },
  {
    key: 'alpha_tenant_admin',
    name: 'Vikram Mehta (VP Operations)',
    role: 'tenant_admin',
    badge: 'Corporate HQ',
    tenantName: 'M Square Professionals',
  },
  {
    key: 'super_admin',
    name: 'System Super Admin',
    role: 'super_admin',
    badge: 'Global Admin',
    tenantName: 'M Square Global',
  },
  {
    key: 'beta_branch_admin',
    name: 'Karan Mehra (Branch Lead)',
    role: 'branch_admin',
    badge: 'Jaipur Hub',
    tenantName: 'M Square Enterprise',
  },
];

interface AuthContextValue {
  identityKey: string;
  identityData: CurrentIdentityResponse | null;
  loading: boolean;
  error: string | null;
  switchIdentity: (key: string) => Promise<void>;
  refreshIdentity: () => Promise<void>;
  tenantId: string | null;
  branchId: string | null;
  employeeId: string | null;
  role: string | null;
  name: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [identityKey, setIdentityKey] = useState<string>(() => {
    return localStorage.getItem('msquare_identity') || localStorage.getItem('gym_helpdesk_identity') || 'alpha_branch_admin';
  });
  const [identityData, setIdentityData] = useState<CurrentIdentityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    apiClient.setIdentity(key);

    try {
      const data = await apiClient.getCurrentIdentity();
      setIdentityData(data);
      localStorage.setItem('msquare_identity', key);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(`Failed to load identity: ${err.message}`);
      } else {
        setError('Network error connecting to API');
      }
      setIdentityData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdentity(identityKey);
  }, [identityKey, fetchIdentity]);

  const switchIdentity = async (newKey: string) => {
    setIdentityKey(newKey);
    await fetchIdentity(newKey);
  };

  const refreshIdentity = async () => {
    await fetchIdentity(identityKey);
  };

  const tenantId = identityData?.identity.tenantId ?? '11111111-1111-4000-8000-000000000001';
  const branchId = identityData?.identity.branchId ?? null;
  const employeeId = identityData?.identity.userId ?? null;
  const role = identityData?.identity.role ?? null;
  const name = identityData?.identity.name ?? 'Guest User';

  return (
    <AuthContext.Provider
      value={{
        identityKey,
        identityData,
        loading,
        error,
        switchIdentity,
        refreshIdentity,
        tenantId,
        branchId,
        employeeId,
        role,
        name,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
