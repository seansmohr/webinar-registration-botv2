const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { addTagToContact } = require('../services/ghlService');
const { computeNextCallTime } = require('../services/callScheduler');

/**
 * POST /api/webhooks/retell
 *
 * Retell AI posts call analysis data here after each call ends.
 * Parses the analysis and updates the contact's status accordingly.
 */
router.post('/retell', async (req, res) => {
  try {
    const payload = req.body;
    logger.info('Retell webhook received', { payload: JSON.stringify(payload).slice(0, 500) });

    const callId = payload.call_id || payload.call?.call_id;
    if (!callId) {
      logger.warn('Webhook missing call_id');
      return res.status(400).json({ error: 'Missing call_id' });
    }

    // Find the call log entry
    const callLogResult = await db.query(
      'SELECT * FROM call_logs WHERE retell_call_id = $1',
      [callId]
    );

    if (callLogResult.rows.length === 0) {
      logger.warn('No call log found for retell call_id', { callId });
      return res.status(404).json({ error: 'Call not found' });
    }

    const callLog = callLogResult.rows[0];
    const contactId = callLog.contact_id;
    const callType = callLog.call_type;

    // Get the contact
    const contactResult = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contact = contactResult.rows[0];

    // Extract analysis from the payload
    // Retell sends analysis in different possible locations
    const analysis = payload.call_analysis || payload.analysis || payload.custom_analysis_data || {};
    const callStatus = payload.call_status || payload.status || 'completed';
    const duration = payload.call_duration_ms
      ? Math.round(payload.call_duration_ms / 1000)
      : payload.duration_seconds || 0;

    // Update call log with analysis
    await db.query(
      `UPDATE call_logs SET
        status = $1,
        duration_seconds = $2,
        ended_at = NOW(),
        reached_person = $3,
        confirmed_registration = $4,
        wrong_number = $5,
        confirmed_attendance = $6,
        attended_status = $7,
        reason_if_declined = $8,
        raw_analysis = $9
      WHERE id = $10`,
      [
        callStatus,
        duration,
        analysis.reached_person || false,
        analysis.confirmed_registration || false,
        analysis.wrong_number || false,
        analysis.confirmed || false,
        analysis.attended_status || null,
        analysis.reason_if_declined || null,
        JSON.stringify(payload),
        callLog.id,
      ]
    );

    // Process outcomes based on call type
    if (callType === 'call1') {
      await processCall1Outcome(contact, analysis);
    } else if (callType === 'call2') {
      await processCall2Outcome(contact, analysis);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Webhook processing error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process Call 1 outcomes and update contact status.
 */
async function processCall1Outcome(contact, analysis) {
  const reachedPerson = analysis.reached_person === true;
  const confirmedRegistration = analysis.confirmed_registration === true;
  const wrongNumber = analysis.wrong_number === true;

  if (!reachedPerson) {
    // Didn't reach anyone — continue retrying
    const nextAttempt = computeNextCallTime(contact.timezone, 'call1', new Date());
    await db.query(
      `UPDATE contacts SET
        call1_status = 'attempting',
        call1_next_attempt = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [nextAttempt, contact.id]
    );
    logger.info('Call 1: Did not reach person, scheduling retry', { contactId: contact.id });
    return;
  }

  if (wrongNumber) {
    // Wrong person / did not register — mark completed, stop all calls
    await db.query(
      `UPDATE contacts SET
        call1_status = 'wrong_number',
        call1_next_attempt = NULL,
        call2_next_attempt = NULL,
        is_completed = TRUE,
        notes = COALESCE(notes || E'\\n', '') || 'Wrong number / did not register',
        updated_at = NOW()
      WHERE id = $1`,
      [contact.id]
    );
    logger.info('Call 1: Wrong number, marking completed', { contactId: contact.id });
    return;
  }

  if (confirmedRegistration) {
    // Contact confirmed registration — advance to Call 2 and push GHL tag
    await db.query(
      `UPDATE contacts SET
        call1_status = 'connected',
        call1_next_attempt = NULL,
        current_stage = 'call2',
        updated_at = NOW()
      WHERE id = $1`,
      [contact.id]
    );

    // Schedule Call 2 for 24 hours before webinar
    const webinarTime = new Date(contact.webinar_time);
    const call2TriggerTime = new Date(webinarTime.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const call2NextAttempt = call2TriggerTime <= now
      ? computeNextCallTime(contact.timezone, 'call2')
      : call2TriggerTime;

    await db.query(
      `UPDATE contacts SET call2_next_attempt = $1, updated_at = NOW() WHERE id = $2`,
      [call2NextAttempt, contact.id]
    );

    // Push tag to GHL
    await addTagToContact(contact.ghl_contact_id, 'confirmed webinar registration');

    logger.info('Call 1: Registration confirmed, advancing to Call 2', {
      contactId: contact.id,
    });
    return;
  }

  // Reached person but did not confirm — mark as no_confirmation, continue retries
  const nextAttempt = computeNextCallTime(contact.timezone, 'call1', new Date());
  await db.query(
    `UPDATE contacts SET
      call1_status = 'no_confirmation',
      call1_next_attempt = $1,
      updated_at = NOW()
    WHERE id = $2`,
    [nextAttempt, contact.id]
  );
  logger.info('Call 1: Reached but no confirmation, scheduling retry', { contactId: contact.id });
}

/**
 * Process Call 2 outcomes and update contact status.
 */
async function processCall2Outcome(contact, analysis) {
  const reachedPerson = analysis.reached_person === true;
  const attendedStatus = analysis.attended_status;
  const wrongNumber = analysis.wrong_number === true;

  if (!reachedPerson) {
    // Didn't reach anyone — continue retrying
    const nextAttempt = computeNextCallTime(contact.timezone, 'call2', new Date());
    await db.query(
      `UPDATE contacts SET
        call2_status = 'attempting',
        call2_next_attempt = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [nextAttempt, contact.id]
    );
    logger.info('Call 2: Did not reach person, scheduling retry', { contactId: contact.id });
    return;
  }

  if (wrongNumber) {
    // Wrong person — mark completed
    await db.query(
      `UPDATE contacts SET
        call2_status = 'complete',
        call2_next_attempt = NULL,
        is_completed = TRUE,
        notes = COALESCE(notes || E'\\n', '') || 'Wrong number on Call 2',
        updated_at = NOW()
      WHERE id = $1`,
      [contact.id]
    );
    logger.info('Call 2: Wrong number, marking completed', { contactId: contact.id });
    return;
  }

  if (attendedStatus === 'confirmed') {
    // Contact confirmed attendance
    await db.query(
      `UPDATE contacts SET
        call2_status = 'confirmed',
        call2_next_attempt = NULL,
        is_completed = TRUE,
        updated_at = NOW()
      WHERE id = $1`,
      [contact.id]
    );

    // Push tag to GHL
    await addTagToContact(contact.ghl_contact_id, 'confirmed webinar attendance');

    logger.info('Call 2: Attendance confirmed', { contactId: contact.id });
    return;
  }

  if (attendedStatus === 'declined') {
    // Contact declined
    const reason = analysis.reason_if_declined || '';
    await db.query(
      `UPDATE contacts SET
        call2_status = 'declined',
        call2_next_attempt = NULL,
        is_completed = TRUE,
        notes = COALESCE(notes || E'\\n', '') || $1,
        updated_at = NOW()
      WHERE id = $2`,
      [reason ? `Declined: ${reason}` : 'Declined attendance', contact.id]
    );
    logger.info('Call 2: Attendance declined', { contactId: contact.id, reason });
    return;
  }

  // Uncertain / unsure — continue retries
  const nextAttempt = computeNextCallTime(contact.timezone, 'call2', new Date());
  await db.query(
    `UPDATE contacts SET
      call2_status = 'uncertain',
      call2_next_attempt = $1,
      updated_at = NOW()
    WHERE id = $2`,
    [nextAttempt, contact.id]
  );
  logger.info('Call 2: Uncertain response, scheduling retry', { contactId: contact.id });
}

module.exports = router;
