import { describe, it, expect } from 'vitest';
import {
  getSupabaseClient,
  checkDatabaseHealth,
  setSupabaseClient,
} from '../../apps/api/src/database/supabase.client';
import { DatabaseConfigurationError } from '../../apps/api/src/database/database.errors';

describe('Database Fail-Closed & Fail-Fast Tests', () => {
  it('should throw DatabaseConfigurationError when Supabase credentials are missing', () => {
    setSupabaseClient(null);

    // Save and wipe env vars
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => {
      getSupabaseClient();
    }).toThrow(DatabaseConfigurationError);

    // Verify error message states in-memory fallback is disabled
    try {
      getSupabaseClient();
    } catch (err) {
      expect((err as Error).message).toContain('In-memory fallback is strictly disabled');
    }

    // Restore env vars
    if (origUrl) process.env.SUPABASE_URL = origUrl;
    if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });

  it('checkDatabaseHealth should return not_configured when credentials missing', async () => {
    setSupabaseClient(null);
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const health = await checkDatabaseHealth();
      expect(['not_configured', 'unreachable']).toContain(health.status);
      expect(health.message).toBeDefined();
    } finally {
      if (origUrl) process.env.SUPABASE_URL = origUrl;
      if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    }
  });
});
