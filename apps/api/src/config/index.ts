import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables (current directory and repository root)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'API_PORT must be a valid port number',
    }),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://localhost:4000,http://localhost:4001'),
  CRM_ADAPTER: z.enum(['mock', 'http']).default('http'),
  MOCK_CRM_BASE_URL: z.string().default('http://localhost:4001'),
  MOCK_CRM_SERVICE_TOKEN: z.string().default('dev-service-token-secret-change-in-prod'),

  // Supabase Staging Database Configuration
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // WhatsApp Cloud API Configuration
  WHATSAPP_PROVIDER: z.enum(['mock', 'cloud_api']).default('mock'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default('dev-verify-token'),
  WHATSAPP_APP_SECRET: z.string().default('dev-app-secret'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  throw new Error(
    `[Helpdesk API Config Error] Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`,
  );
}

export const config = parsed.data;
export const corsOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
