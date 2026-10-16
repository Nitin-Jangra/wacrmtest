import { app } from './app';
import { config } from './config';

const server = app.listen(config.MOCK_CRM_PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Mock CRM API listening on port ${config.MOCK_CRM_PORT}`,
      env: config.NODE_ENV,
      port: config.MOCK_CRM_PORT,
      timestamp: new Date().toISOString(),
    }),
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'SIGTERM received, closing HTTP server',
    }),
  );
  server.close(() => {
    process.exit(0);
  });
});
