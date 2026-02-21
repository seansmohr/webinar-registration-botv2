const cron = require('node-cron');
const logger = require('../utils/logger');
const { syncContacts } = require('./contactSync');
const { processCallQueue, checkAutoAdvance, checkWebinarDayCompletion } = require('./callScheduler');

/**
 * Start all cron-based scheduled tasks.
 */
function startScheduler() {
  // Sync contacts from GHL every 60 minutes
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled GHL contact sync');
    try {
      await syncContacts();
    } catch (err) {
      logger.error('Scheduled sync failed', { error: err.message });
    }
  });

  // Process call queue every minute — checks for contacts due for a call
  cron.schedule('* * * * *', async () => {
    try {
      await processCallQueue();
    } catch (err) {
      logger.error('Call queue processing failed', { error: err.message });
    }
  });

  // Check auto-advance (Call 1 → Call 2) every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAutoAdvance();
    } catch (err) {
      logger.error('Auto-advance check failed', { error: err.message });
    }
  });

  // Check webinar day completion every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkWebinarDayCompletion();
    } catch (err) {
      logger.error('Webinar day completion check failed', { error: err.message });
    }
  });

  // Run an initial sync on startup (after a short delay)
  setTimeout(async () => {
    logger.info('Running initial GHL contact sync on startup');
    try {
      await syncContacts();
    } catch (err) {
      logger.error('Initial sync failed', { error: err.message });
    }
  }, 5000);

  logger.info('All schedulers initialized');
}

module.exports = { startScheduler };
