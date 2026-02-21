const { DateTime } = require('luxon');
const db = require('../db');
const logger = require('../utils/logger');
const { createOutboundCall } = require('./retellService');
const { getWebinarLabel } = require('../utils/webinarTimes');

/**
 * Compute the next valid call time for a contact in their local timezone.
 *
 * Call windows: 8:30 AM and 5:30 PM in the contact's timezone.
 *
 * Rules:
 * - If before 5:30 PM, can call immediately (for new contacts)
 * - If after 5:30 PM, schedule for 8:30 AM next day
 * - Returns a JS Date (UTC)
 */
function computeNextCallTime(timezone, stage, currentAttempt = null) {
  const tz = timezone || 'America/Chicago';
  const now = DateTime.now().setZone(tz);

  const morning = now.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
  const evening = now.set({ hour: 17, minute: 30, second: 0, millisecond: 0 });

  // If no previous attempt, determine first call time
  if (!currentAttempt) {
    if (now < morning) {
      // Before morning window — schedule for 8:30 AM today
      return morning.toJSDate();
    } else if (now < evening) {
      // Within window — can call now (return current time)
      return now.toJSDate();
    } else {
      // After evening window — schedule for 8:30 AM tomorrow
      return morning.plus({ days: 1 }).toJSDate();
    }
  }

  // If we had a previous attempt, schedule the next window
  const lastAttemptDt = DateTime.fromJSDate(new Date(currentAttempt)).setZone(tz);

  if (lastAttemptDt < morning || lastAttemptDt >= evening) {
    // Last attempt was before morning or after evening, next is morning
    const nextMorning = lastAttemptDt < morning
      ? morning
      : morning.plus({ days: 1 });
    return nextMorning.toJSDate();
  } else if (lastAttemptDt >= morning && lastAttemptDt < evening) {
    // Last attempt was in the morning window, next is evening
    return evening.toJSDate();
  }

  // Fallback: next morning
  return morning.plus({ days: 1 }).toJSDate();
}

/**
 * Process all contacts that are due for a call attempt.
 * Runs every minute via cron to check for pending calls.
 */
async function processCallQueue() {
  const now = new Date();

  try {
    // Find contacts due for Call 1
    const call1Due = await db.query(
      `SELECT * FROM contacts
       WHERE current_stage = 'call1'
         AND call1_status IN ('not_called', 'attempting', 'no_confirmation')
         AND is_completed = FALSE
         AND call1_next_attempt IS NOT NULL
         AND call1_next_attempt <= $1
       ORDER BY call1_next_attempt ASC
       LIMIT 10`,
      [now]
    );

    for (const contact of call1Due.rows) {
      await attemptCall(contact, 'call1');
    }

    // Find contacts due for Call 2
    const call2Due = await db.query(
      `SELECT * FROM contacts
       WHERE current_stage = 'call2'
         AND call2_status IN ('not_called', 'attempting', 'uncertain')
         AND is_completed = FALSE
         AND call2_next_attempt IS NOT NULL
         AND call2_next_attempt <= $1
       ORDER BY call2_next_attempt ASC
       LIMIT 10`,
      [now]
    );

    for (const contact of call2Due.rows) {
      await attemptCall(contact, 'call2');
    }
  } catch (err) {
    logger.error('Error processing call queue', { error: err.message });
  }
}

/**
 * Check for Call 1 contacts that need to auto-advance to Call 2.
 * This happens when 24 hours before webinar is reached with no connection.
 */
async function checkAutoAdvance() {
  const now = new Date();

  try {
    const result = await db.query(
      `SELECT * FROM contacts
       WHERE current_stage = 'call1'
         AND call1_status IN ('not_called', 'attempting', 'no_confirmation')
         AND is_completed = FALSE
         AND webinar_time IS NOT NULL`,
      []
    );

    for (const contact of result.rows) {
      const webinarTime = new Date(contact.webinar_time);
      const twentyFourHoursBefore = new Date(webinarTime.getTime() - 24 * 60 * 60 * 1000);

      if (now >= twentyFourHoursBefore) {
        logger.info('Auto-advancing contact to Call 2', {
          contactId: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
        });

        // Compute next Call 2 attempt time
        // Special rule: if the 24-hour mark is outside 8:30 AM - 5:30 PM, call immediately
        const tz = contact.timezone || 'America/Chicago';
        const nowInTz = DateTime.now().setZone(tz);
        const morning = nowInTz.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
        const evening = nowInTz.set({ hour: 17, minute: 30, second: 0, millisecond: 0 });

        let nextCall2Time;
        if (nowInTz < morning || nowInTz >= evening) {
          // Outside normal window — call immediately (special rule)
          nextCall2Time = now;
        } else {
          nextCall2Time = now;
        }

        await db.query(
          `UPDATE contacts SET
            current_stage = 'call2',
            call2_status = 'not_called',
            call2_next_attempt = $1,
            updated_at = NOW()
          WHERE id = $2`,
          [nextCall2Time, contact.id]
        );
      }
    }
  } catch (err) {
    logger.error('Error in auto-advance check', { error: err.message });
  }
}

/**
 * Check for contacts on the day of the webinar — enforce "one 8:30 AM call then stop" rule.
 */
async function checkWebinarDayCompletion() {
  const now = new Date();

  try {
    const result = await db.query(
      `SELECT * FROM contacts
       WHERE current_stage = 'call2'
         AND is_completed = FALSE
         AND webinar_time IS NOT NULL`,
      []
    );

    for (const contact of result.rows) {
      const webinarTime = new Date(contact.webinar_time);
      const tz = contact.timezone || 'America/Chicago';
      const nowInTz = DateTime.now().setZone(tz);
      const webinarInTz = DateTime.fromJSDate(webinarTime).setZone(tz);

      // Check if today is webinar day
      if (nowInTz.hasSame(webinarInTz, 'day')) {
        const morningCall = nowInTz.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });

        // If we're past the morning call time on webinar day and already attempted
        if (nowInTz > morningCall && contact.call2_attempts > 0) {
          // Mark as complete — sequence finished
          await db.query(
            `UPDATE contacts SET
              call2_status = 'complete',
              is_completed = TRUE,
              call2_next_attempt = NULL,
              updated_at = NOW()
            WHERE id = $1`,
            [contact.id]
          );

          logger.info('Webinar day completion — stopping calls', {
            contactId: contact.id,
            name: `${contact.first_name} ${contact.last_name}`,
          });
        } else if (nowInTz <= morningCall && contact.call2_next_attempt === null) {
          // Schedule the morning call if not yet scheduled
          await db.query(
            `UPDATE contacts SET
              call2_next_attempt = $1,
              updated_at = NOW()
            WHERE id = $2`,
            [morningCall.toJSDate(), contact.id]
          );
        }
      }

      // If webinar has already passed, mark complete
      if (now > webinarTime) {
        await db.query(
          `UPDATE contacts SET
            is_completed = TRUE,
            call2_status = CASE WHEN call2_status = 'not_called' THEN 'complete' ELSE call2_status END,
            call2_next_attempt = NULL,
            updated_at = NOW()
          WHERE id = $1 AND is_completed = FALSE`,
          [contact.id]
        );
      }
    }
  } catch (err) {
    logger.error('Error in webinar day completion check', { error: err.message });
  }
}

/**
 * Attempt a single call to a contact via Retell.
 */
async function attemptCall(contact, callType) {
  const webinarLabel = getWebinarLabel(contact.webinar_tag);

  logger.info(`Attempting ${callType} for contact`, {
    contactId: contact.id,
    name: `${contact.first_name} ${contact.last_name}`,
    phone: contact.phone,
  });

  const result = await createOutboundCall({
    phoneNumber: contact.phone,
    callType,
    contactFirstName: contact.first_name || 'there',
    webinarLabel,
  });

  if (!result || !result.call_id) {
    logger.error(`Failed to create ${callType} call`, { contactId: contact.id });

    // Schedule retry at next window
    const nextAttempt = computeNextCallTime(contact.timezone, callType, new Date());
    const statusCol = callType === 'call1' ? 'call1_status' : 'call2_status';
    const nextCol = callType === 'call1' ? 'call1_next_attempt' : 'call2_next_attempt';

    await db.query(
      `UPDATE contacts SET
        ${statusCol} = 'attempting',
        ${nextCol} = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [nextAttempt, contact.id]
    );
    return;
  }

  // Update contact with call info
  const attemptsCol = callType === 'call1' ? 'call1_attempts' : 'call2_attempts';
  const statusCol = callType === 'call1' ? 'call1_status' : 'call2_status';
  const lastAttemptCol = callType === 'call1' ? 'call1_last_attempt' : 'call2_last_attempt';
  const nextAttemptCol = callType === 'call1' ? 'call1_next_attempt' : 'call2_next_attempt';
  const retellCol = callType === 'call1' ? 'call1_retell_call_id' : 'call2_retell_call_id';

  // Set next attempt to null for now — webhook will determine next steps
  // But compute fallback in case webhook doesn't fire
  const fallbackNext = computeNextCallTime(contact.timezone, callType, new Date());

  await db.query(
    `UPDATE contacts SET
      ${statusCol} = 'attempting',
      ${attemptsCol} = ${attemptsCol} + 1,
      ${lastAttemptCol} = NOW(),
      ${nextAttemptCol} = $1,
      ${retellCol} = $2,
      updated_at = NOW()
    WHERE id = $3`,
    [fallbackNext, result.call_id, contact.id]
  );

  // Log the call
  await db.query(
    `INSERT INTO call_logs (contact_id, call_type, retell_call_id, status, started_at)
     VALUES ($1, $2, $3, 'initiated', NOW())`,
    [contact.id, callType, result.call_id]
  );

  logger.info(`${callType} initiated`, {
    contactId: contact.id,
    retellCallId: result.call_id,
  });
}

module.exports = {
  computeNextCallTime,
  processCallQueue,
  checkAutoAdvance,
  checkWebinarDayCompletion,
  attemptCall,
};
