require('dotenv').config();
const { pool } = require('./index');
const logger = require('../utils/logger');

const migration = `
  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    ghl_contact_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'America/Chicago',
    webinar_tag VARCHAR(100) NOT NULL,
    webinar_time TIMESTAMPTZ NOT NULL,
    registration_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Call 1 status: not_called, attempting, connected, wrong_number, no_confirmation
    call1_status VARCHAR(50) DEFAULT 'not_called',
    call1_attempts INTEGER DEFAULT 0,
    call1_last_attempt TIMESTAMPTZ,
    call1_next_attempt TIMESTAMPTZ,
    call1_retell_call_id VARCHAR(255),

    -- Call 2 status: not_called, attempting, confirmed, declined, uncertain, complete
    call2_status VARCHAR(50) DEFAULT 'not_called',
    call2_attempts INTEGER DEFAULT 0,
    call2_last_attempt TIMESTAMPTZ,
    call2_next_attempt TIMESTAMPTZ,
    call2_retell_call_id VARCHAR(255),

    -- Overall status
    current_stage VARCHAR(10) DEFAULT 'call1',  -- 'call1' or 'call2'
    is_completed BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Manual override
    manual_override BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    call_type VARCHAR(10) NOT NULL,  -- 'call1' or 'call2'
    retell_call_id VARCHAR(255),
    status VARCHAR(50),
    duration_seconds INTEGER,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Retell analysis fields
    reached_person BOOLEAN,
    confirmed_registration BOOLEAN,
    wrong_number BOOLEAN,
    confirmed_attendance BOOLEAN,
    attended_status VARCHAR(50),
    reason_if_declined TEXT,

    raw_analysis JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_ghl_id ON contacts(ghl_contact_id);
  CREATE INDEX IF NOT EXISTS idx_contacts_current_stage ON contacts(current_stage);
  CREATE INDEX IF NOT EXISTS idx_contacts_completed ON contacts(is_completed);
  CREATE INDEX IF NOT EXISTS idx_contacts_call1_next ON contacts(call1_next_attempt);
  CREATE INDEX IF NOT EXISTS idx_contacts_call2_next ON contacts(call2_next_attempt);
  CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
  CREATE INDEX IF NOT EXISTS idx_call_logs_retell ON call_logs(retell_call_id);
`;

async function migrate() {
  try {
    await pool.query(migration);
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  }
}

migrate();
