const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { syncContacts } = require('../services/contactSync');

/**
 * GET /api/contacts
 * List all contacts with optional filtering.
 */
router.get('/', async (req, res) => {
  try {
    const { stage, status, tag, completed } = req.query;

    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (stage) {
      paramCount++;
      query += ` AND current_stage = $${paramCount}`;
      params.push(stage);
    }

    if (status) {
      paramCount++;
      query += ` AND (call1_status = $${paramCount} OR call2_status = $${paramCount})`;
      params.push(status);
    }

    if (tag) {
      paramCount++;
      query += ` AND webinar_tag = $${paramCount}`;
      params.push(tag);
    }

    if (completed !== undefined) {
      paramCount++;
      query += ` AND is_completed = $${paramCount}`;
      params.push(completed === 'true');
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ contacts: result.rows });
  } catch (err) {
    logger.error('Error fetching contacts', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * GET /api/contacts/:id
 * Get a single contact with its call logs.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contactResult = await db.query('SELECT * FROM contacts WHERE id = $1', [id]);

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const callLogs = await db.query(
      'SELECT * FROM call_logs WHERE contact_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      contact: contactResult.rows[0],
      callLogs: callLogs.rows,
    });
  } catch (err) {
    logger.error('Error fetching contact', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

/**
 * PUT /api/contacts/:id/override
 * Manual override: switch a contact between Call 1 and Call 2.
 */
router.put('/:id/override', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body; // 'call1' or 'call2'

    if (!['call1', 'call2'].includes(stage)) {
      return res.status(400).json({ error: 'Stage must be "call1" or "call2"' });
    }

    const contactResult = await db.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contact = contactResult.rows[0];
    const { computeNextCallTime } = require('../services/callScheduler');
    const nextAttempt = computeNextCallTime(contact.timezone, stage);

    const updates = {
      current_stage: stage,
      manual_override: true,
      is_completed: false,
    };

    if (stage === 'call1') {
      updates.call1_next_attempt = nextAttempt;
      if (contact.call1_status === 'not_called' || contact.call1_status === 'connected') {
        updates.call1_status = 'not_called';
      }
    } else {
      updates.call2_next_attempt = nextAttempt;
      if (contact.call2_status === 'not_called' || contact.call2_status === 'confirmed' || contact.call2_status === 'complete') {
        updates.call2_status = 'not_called';
      }
    }

    await db.query(
      `UPDATE contacts SET
        current_stage = $1,
        manual_override = $2,
        is_completed = $3,
        call1_next_attempt = $4,
        call2_next_attempt = $5,
        call1_status = COALESCE($6, call1_status),
        call2_status = COALESCE($7, call2_status),
        updated_at = NOW()
      WHERE id = $8`,
      [
        updates.current_stage,
        updates.manual_override,
        updates.is_completed,
        stage === 'call1' ? nextAttempt : null,
        stage === 'call2' ? nextAttempt : null,
        updates.call1_status || null,
        updates.call2_status || null,
        id,
      ]
    );

    logger.info('Manual override applied', { contactId: id, stage });

    const updated = await db.query('SELECT * FROM contacts WHERE id = $1', [id]);
    res.json({ contact: updated.rows[0] });
  } catch (err) {
    logger.error('Error applying override', { error: err.message });
    res.status(500).json({ error: 'Failed to apply override' });
  }
});

/**
 * POST /api/contacts/sync
 * Trigger a manual sync from GHL.
 */
router.post('/sync', async (req, res) => {
  try {
    await syncContacts();
    res.json({ success: true, message: 'Sync completed' });
  } catch (err) {
    logger.error('Manual sync error', { error: err.message });
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;
