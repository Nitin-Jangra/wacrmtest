import { app } from './app';
import { config } from './config';
import { isSupabaseConfigured } from './database/supabase.client';
import { initDevMockDb } from './database/dev-mock-db';

if (!isSupabaseConfigured() && config.NODE_ENV === 'development') {
  console.log(
    JSON.stringify({
      level: 'warn',
      message:
        '[DEV MODE] Supabase credentials not found in .env. Initializing in-memory dev database with sample seeds for local testing.',
      timestamp: new Date().toISOString(),
    }),
  );
  initDevMockDb();
}

const server = app.listen(config.API_PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Gym WhatsApp Helpdesk API listening on port ${config.API_PORT}`,
      env: config.NODE_ENV,
      port: config.API_PORT,
      crmAdapter: config.CRM_ADAPTER,
      timestamp: new Date().toISOString(),
    }),
  );
});

process.on('SIGTERM', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'SIGTERM received, closing Helpdesk API server',
    }),
  );
  server.close(() => {
    process.exit(0);
  });
});
