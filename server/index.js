// Load .env only if DATABASE_URL is not already set (Railway injects env vars directly)
require('dotenv').config({ override: false });

const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const db = require('./db');
const { runMigration } = require('./db/migrate');
const { startScheduler } = require('./services/scheduler');
const contactRoutes = require('./routes/contacts');
const webhookRoutes = require('./routes/webhooks');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/contacts', contactRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Serve static frontend (always serve if dist exists, not just in production)
const distPath = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Fallback: return a simple response on / so Railway health check passes
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'webinar-registration-bot' });
  });
}

let server;

async function start() {
  try {
    // Run migration with retries (waits for DB to become available)
    logger.info('Running database migration...');
    await runMigration(db.pool, logger, { maxRetries: 15, delayMs: 3000 });

    // Verify connection
    await db.query('SELECT 1');
    logger.info('Database connected successfully');

    // Start the scheduler (cron jobs for sync + call scheduling)
    startScheduler();
    logger.info('Scheduler started');

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown — handle Railway's SIGTERM cleanly
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(() => {
      db.pool.end().then(() => {
        logger.info('Server and database connections closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => process.exit(0), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

module.exports = app;
