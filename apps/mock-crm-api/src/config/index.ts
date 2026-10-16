import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MOCK_CRM_PORT: z
    .string()
    .default('4001')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'MOCK_CRM_PORT must be a valid port number',
    }),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://localhost:4000,http://localhost:4001'),
  MOCK_AUTH_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  MOCK_CRM_SERVICE_TOKEN: z.string().default('dev-service-token-secret-change-in-prod'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with clear error message
  const formatted = parsed.error.format();
  throw new Error(
    `[Mock CRM API Config Error] Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`,
  );
}

export const config = parsed.data;

// Critical Security Constraint: Mock authentication MUST NOT be allowed when NODE_ENV=production
if (config.NODE_ENV === 'production' && config.MOCK_AUTH_ENABLED) {
  throw new Error(
    '[FATAL SECURITY ERROR] MOCK_AUTH_ENABLED cannot be true when NODE_ENV=production. Startup aborted.',
  );
}

export const corsOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
