import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setSupabaseClient } from '../../apps/api/src/database/supabase.client';
import { WhatsAppChannelResolver } from '../../apps/api/src/services/whatsapp/whatsapp-channel.resolver';
import {
  WhatsAppChannelNotFoundError,
  WhatsAppChannelInactiveError,
} from '../../apps/api/src/integrations/whatsapp/whatsapp.errors';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient(channels: any[] = []): SupabaseClient {
  const store = { whatsapp_channels: [...channels] };

  const mock = {
    from: (tableName: string) => {
      let currentData = [...(store[tableName as keyof typeof store] || [])];

      const queryBuilder: any = {
        select: () => queryBuilder,
        eq: (field: string, val: any) => {
          currentData = currentData.filter((item: any) => item[field] === val);
          return queryBuilder;
        },
        maybeSingle: async () => {
          return { data: currentData[0] || null, error: null };
        },
        single: async () => {
          return { data: currentData[0] || null, error: null };
        },
      };

      return queryBuilder;
    },
  };

  return mock as unknown as SupabaseClient;
}

describe('WhatsAppChannelResolver Unit Tests', () => {
  const activePhoneNumberId = '109876543210987';
  const inactivePhoneNumberId = '109876543210988';
  const activeChannelId = randomUUID();
  const inactiveChannelId = randomUUID();
  const tenantId = randomUUID();
  const branchId = randomUUID();

  const mockChannels = [
    {
      id: activeChannelId,
      tenant_id: tenantId,
      branch_id: branchId,
      provider: 'meta_whatsapp',
      phone_number_id: activePhoneNumberId,
      waba_id: 'waba-1234567890',
      display_name: 'Alpha Gym Support',
      status: 'active',
      credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
      configuration: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: inactiveChannelId,
      tenant_id: tenantId,
      branch_id: branchId,
      provider: 'meta_whatsapp',
      phone_number_id: inactivePhoneNumberId,
      waba_id: 'waba-1234567891',
      display_name: 'Alpha Inactive Channel',
      status: 'inactive',
      credential_reference: 'env://WHATSAPP_ACCESS_TOKEN',
      configuration: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    setSupabaseClient(createMockSupabaseClient(mockChannels));
  });

  afterEach(() => {
    setSupabaseClient(null as any);
  });

  const resolver = new WhatsAppChannelResolver();

  it('resolves an active channel successfully by phone_number_id', async () => {
    const channel = await resolver.resolveActiveChannel(activePhoneNumberId);

    expect(channel).toBeDefined();
    expect(channel.id).toBe(activeChannelId);
    expect(channel.phoneNumberId).toBe(activePhoneNumberId);
    expect(channel.status).toBe('active');
    expect(channel.tenantId).toBe(tenantId);
    expect(channel.branchId).toBe(branchId);
  });

  it('throws WhatsAppChannelNotFoundError when phone_number_id is unknown', async () => {
    await expect(resolver.resolveActiveChannel('999999999999999')).rejects.toThrow(
      WhatsAppChannelNotFoundError,
    );
  });

  it('throws WhatsAppChannelNotFoundError when phone_number_id is empty or whitespace', async () => {
    await expect(resolver.resolveActiveChannel('')).rejects.toThrow(
      WhatsAppChannelNotFoundError,
    );
    await expect(resolver.resolveActiveChannel('   ')).rejects.toThrow(
      WhatsAppChannelNotFoundError,
    );
  });

  it('throws WhatsAppChannelInactiveError when channel status is inactive', async () => {
    await expect(resolver.resolveActiveChannel(inactivePhoneNumberId)).rejects.toThrow(
      WhatsAppChannelInactiveError,
    );
  });

  it('findActiveChannel returns channel for active and null for inactive/unknown', async () => {
    const active = await resolver.findActiveChannel(activePhoneNumberId);
    expect(active?.id).toBe(activeChannelId);

    const inactive = await resolver.findActiveChannel(inactivePhoneNumberId);
    expect(inactive).toBeNull();

    const missing = await resolver.findActiveChannel('non_existent');
    expect(missing).toBeNull();
  });
});
