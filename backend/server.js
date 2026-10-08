const app = require('./src/app');
const env = require('./src/config/env');
const syncQueueWorker = require('./src/services/syncQueueWorker');

const server = app.listen(env.PORT, () => {
  console.log(`[Server] Portfolio backend running on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  
  // Start the background queue worker
  syncQueueWorker.processNextJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});
