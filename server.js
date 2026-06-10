require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/database');
const logger = require('./src/config/logger');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  initSocket(server);
  logger.info(`Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await db.destroy();
      console.log('Database pool drained.');
    } catch (err) {
      console.error('Error draining DB pool:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
