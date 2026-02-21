const { DateTime } = require('luxon');

/**
 * Maps GHL tags to webinar day/time specifications.
 * All times are in CST (America/Chicago).
 */
const TAG_SCHEDULE = {
  'tuesday 11am': { dayOfWeek: 2, hour: 11, minute: 0 },
  'tuesday 6pm': { dayOfWeek: 2, hour: 18, minute: 0 },
  'thursday 1pm': { dayOfWeek: 4, hour: 13, minute: 0 },
  'saturday 11am': { dayOfWeek: 6, hour: 11, minute: 0 },
  'friday 5pm': { dayOfWeek: 5, hour: 17, minute: 0 },
  'sunday 5pm': { dayOfWeek: 7, hour: 17, minute: 0 }, // Test tag
};

/**
 * Given a GHL tag and a reference date, compute the next upcoming webinar time.
 * Returns a Luxon DateTime in CST.
 */
function getNextWebinarTime(tag, referenceDate = null) {
  const schedule = TAG_SCHEDULE[tag.toLowerCase()];
  if (!schedule) return null;

  const now = referenceDate
    ? DateTime.fromJSDate(referenceDate).setZone('America/Chicago')
    : DateTime.now().setZone('America/Chicago');

  // Start from today, find the next occurrence of the target day
  let candidate = now.set({
    hour: schedule.hour,
    minute: schedule.minute,
    second: 0,
    millisecond: 0,
  });

  // Adjust to the correct day of the week
  const currentDay = now.weekday; // 1=Mon, 7=Sun
  let daysUntil = schedule.dayOfWeek - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0 && candidate <= now) daysUntil = 7;

  candidate = candidate.plus({ days: daysUntil });

  return candidate;
}

/**
 * Returns a human-readable webinar label for Retell dynamic variables.
 * e.g., "Tuesday 11:00 AM CST"
 */
function getWebinarLabel(tag) {
  const schedule = TAG_SCHEDULE[tag.toLowerCase()];
  if (!schedule) return tag;

  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayName = days[schedule.dayOfWeek];
  const hour = schedule.hour > 12 ? schedule.hour - 12 : schedule.hour;
  const ampm = schedule.hour >= 12 ? 'PM' : 'AM';
  const minuteStr = schedule.minute === 0 ? '00' : String(schedule.minute).padStart(2, '0');

  return `${dayName} ${hour}:${minuteStr} ${ampm} CST`;
}

/**
 * Check if a contact registered more than 24 hours before the webinar.
 */
function registeredMoreThan24HoursBefore(registrationTime, webinarTime) {
  const regDt = DateTime.fromJSDate(new Date(registrationTime));
  const webDt = DateTime.fromJSDate(new Date(webinarTime));
  const diff = webDt.diff(regDt, 'hours').hours;
  return diff > 24;
}

module.exports = {
  TAG_SCHEDULE,
  getNextWebinarTime,
  getWebinarLabel,
  registeredMoreThan24HoursBefore,
};
