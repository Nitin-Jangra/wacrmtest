import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { DatabaseConfigurationError, DatabaseError } from './database.errors';

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return Boolean(
    (process.env.SUPABASE_URL ?? config.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (!isSupabaseConfigured()) {
    throw new DatabaseConfigurationError(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. In-memory fallback is strictly disabled.',
    );
  }

  try {
    const url = (process.env.NODE_ENV === 'test' ? process.env.SUPABASE_URL : (process.env.SUPABASE_URL ?? config.SUPABASE_URL))!;
    const key = (process.env.NODE_ENV === 'test' ? process.env.SUPABASE_SERVICE_ROLE_KEY : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_SERVICE_ROLE_KEY))!;
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch (err) {
    throw new DatabaseError(
      `Failed to initialize Supabase client: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Health check for Supabase persistence
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'not_configured' | 'unreachable';
  message?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'not_configured',
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment.',
    };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from('whatsapp_channels').select('id').limit(1);

    if (error) {
      return {
        status: 'unreachable',
        message: error.message,
      };
    }

    return { status: 'connected' };
  } catch (err) {
    return {
      status: 'unreachable',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Reset client instance for testing purposes
 */
export function setSupabaseClient(client: SupabaseClient | null): void {
  cachedClient = client;
}
