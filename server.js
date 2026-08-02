require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/database');
const logger = require('./src/config/logger');
const { initSocket } = require('./src/socket');
const { checkUpcomingAppointments } = require('./src/services/notificationService');

const PORT = process.env.PORT || 3000;
const REMINDER_INTERVAL_MS = parseInt(process.env.REMINDER_INTERVAL_MS) || 15 * 60 * 1000;

const server = app.listen(PORT, () => {
  initSocket(server);
  logger.info(`Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });

  const reminderTimer = setInterval(async () => {
    try {
      const tenants = await db.selectFrom('tenants').select('id').execute();
      for (const tenant of tenants) {
        const sent = await checkUpcomingAppointments(tenant.id);
        if (sent.length > 0) {
          logger.info(`Appointment reminders sent`, { tenantId: tenant.id, count: sent.length });
        }
      }
    } catch (err) {
      logger.error('Failed to check upcoming appointments', { error: err.message });
    }
  }, REMINDER_INTERVAL_MS);

  reminderTimer.unref();
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      const { getIO } = require('./src/socket');
      const io = getIO();
      io.close();
      console.log('Socket.IO closed.');
    } catch { /* socket may not be initialized */ }
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
