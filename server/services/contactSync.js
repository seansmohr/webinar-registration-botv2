const db = require('../db');
const logger = require('../utils/logger');
const { getContactsByTag } = require('./ghlService');
const { getNextWebinarTime, registeredMoreThan24HoursBefore } = require('../utils/webinarTimes');
const { computeNextCallTime } = require('./callScheduler');

// Testing phase: sync contacts with 'sunday 5pm' tag
// Switch to production tags upon explicit approval
const ACTIVE_TAGS = ['sunday 5pm'];

/**
 * Sync contacts from GHL for all active tags.
 * Runs every 60 minutes via cron.
 */
async function syncContacts() {
  logger.info('Starting contact sync from GHL', { tags: ACTIVE_TAGS });

  for (const tag of ACTIVE_TAGS) {
    try {
      const ghlContacts = await getContactsByTag(tag);
      logger.info(`Found ${ghlContacts.length} contacts for tag "${tag}"`);

      for (const ghlContact of ghlContacts) {
        await upsertContact(ghlContact, tag);
      }
    } catch (err) {
      logger.error('Contact sync error for tag', { tag, error: err.message });
    }
  }

  logger.info('Contact sync completed');
}

/**
 * Upsert a single contact from GHL data into our database.
 */
async function upsertContact(ghlContact, tag) {
  const contactId = ghlContact.id;
  const phone = ghlContact.phone || ghlContact.phoneNumber;
  if (!phone) {
    logger.warn('Skipping contact without phone number', { contactId });
    return;
  }

  const firstName = ghlContact.firstName || ghlContact.first_name || '';
  const lastName = ghlContact.lastName || ghlContact.last_name || '';
  const email = ghlContact.email || '';
  const timezone = ghlContact.timezone || 'America/Chicago';

  // Calculate the next webinar time for this tag
  const webinarTime = getNextWebinarTime(tag);
  if (!webinarTime) {
    logger.warn('Could not compute webinar time for tag', { tag, contactId });
    return;
  }

  const webinarTimeISO = webinarTime.toISO();
  const now = new Date();

  // Check if contact already exists
  const existing = await db.query(
    'SELECT id, is_completed FROM contacts WHERE ghl_contact_id = $1',
    [contactId]
  );

  if (existing.rows.length > 0) {
    // Contact already exists, don't overwrite call statuses
    // Just update basic info
    if (!existing.rows[0].is_completed) {
      await db.query(
        `UPDATE contacts SET
          first_name = $1, last_name = $2, email = $3, timezone = $4,
          updated_at = NOW()
        WHERE ghl_contact_id = $5`,
        [firstName, lastName, email, timezone, contactId]
      );
    }
    return;
  }

  // Determine initial stage based on registration timing
  const moreThan24Hours = registeredMoreThan24HoursBefore(now, webinarTimeISO);
  const initialStage = moreThan24Hours ? 'call1' : 'call2';
  const initialCall1Status = moreThan24Hours ? 'not_called' : 'not_called';
  const initialCall2Status = 'not_called';

  // Compute first call attempt time
  const nextAttemptTime = computeNextCallTime(timezone, initialStage);

  try {
    await db.query(
      `INSERT INTO contacts (
        ghl_contact_id, first_name, last_name, phone, email, timezone,
        webinar_tag, webinar_time, registration_time,
        call1_status, call2_status, current_stage,
        call1_next_attempt, call2_next_attempt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (ghl_contact_id) DO NOTHING`,
      [
        contactId, firstName, lastName, phone, email, timezone,
        tag, webinarTimeISO, now,
        initialCall1Status, initialCall2Status, initialStage,
        initialStage === 'call1' ? nextAttemptTime : null,
        initialStage === 'call2' ? nextAttemptTime : null,
      ]
    );

    logger.info('New contact synced', {
      contactId,
      name: `${firstName} ${lastName}`,
      tag,
      initialStage,
    });
  } catch (err) {
    logger.error('Failed to upsert contact', { contactId, error: err.message });
  }
}

module.exports = { syncContacts, ACTIVE_TAGS };
