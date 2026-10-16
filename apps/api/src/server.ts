import { app } from './app';
import { config } from './config';

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
