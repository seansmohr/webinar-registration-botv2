const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/stats
 * Summary statistics for the dashboard.
 */
router.get('/stats', async (req, res) => {
  try {
    const totalResult = await db.query('SELECT COUNT(*) as total FROM contacts');
    const call1InProgress = await db.query(
      "SELECT COUNT(*) as count FROM contacts WHERE current_stage = 'call1' AND is_completed = FALSE"
    );
    const call2InProgress = await db.query(
      "SELECT COUNT(*) as count FROM contacts WHERE current_stage = 'call2' AND is_completed = FALSE"
    );
    const completedResult = await db.query(
      'SELECT COUNT(*) as count FROM contacts WHERE is_completed = TRUE'
    );
    const confirmedResult = await db.query(
      "SELECT COUNT(*) as count FROM contacts WHERE call2_status = 'confirmed'"
    );

    // Status breakdown
    const call1Breakdown = await db.query(
      `SELECT call1_status, COUNT(*) as count
       FROM contacts
       GROUP BY call1_status`
    );
    const call2Breakdown = await db.query(
      `SELECT call2_status, COUNT(*) as count
       FROM contacts
       GROUP BY call2_status`
    );

    res.json({
      total: parseInt(totalResult.rows[0].total),
      call1InProgress: parseInt(call1InProgress.rows[0].count),
      call2InProgress: parseInt(call2InProgress.rows[0].count),
      completed: parseInt(completedResult.rows[0].count),
      confirmed: parseInt(confirmedResult.rows[0].count),
      call1Breakdown: call1Breakdown.rows,
      call2Breakdown: call2Breakdown.rows,
    });
  } catch (err) {
    logger.error('Error fetching dashboard stats', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/dashboard/recent-calls
 * Recent call activity log.
 */
router.get('/recent-calls', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cl.*, c.first_name, c.last_name, c.phone, c.webinar_tag
       FROM call_logs cl
       JOIN contacts c ON cl.contact_id = c.id
       ORDER BY cl.created_at DESC
       LIMIT 50`
    );
    res.json({ calls: result.rows });
  } catch (err) {
    logger.error('Error fetching recent calls', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch recent calls' });
  }
});

module.exports = router;
