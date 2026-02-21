const axios = require('axios');
const logger = require('../utils/logger');

const RETELL_BASE_URL = 'https://api.retellai.com';
const API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID_CALL1 = process.env.RETELL_AGENT_ID_CALL1;
const AGENT_ID_CALL2 = process.env.RETELL_AGENT_ID_CALL2;
const FROM_NUMBER = process.env.RETELL_PHONE_NUMBER;

const retellClient = axios.create({
  baseURL: RETELL_BASE_URL,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Initiate an outbound call via Retell AI.
 *
 * @param {Object} params
 * @param {string} params.phoneNumber - The contact's phone number (E.164)
 * @param {string} params.callType - 'call1' or 'call2'
 * @param {string} params.contactFirstName - Contact's first name for dynamic variable
 * @param {string} params.webinarLabel - e.g., "Tuesday 11:00 AM CST"
 * @returns {Object|null} Retell API response with call_id
 */
async function createOutboundCall({ phoneNumber, callType, contactFirstName, webinarLabel }) {
  const agentId = callType === 'call1' ? AGENT_ID_CALL1 : AGENT_ID_CALL2;

  try {
    const response = await retellClient.post('/v2/create-phone-call', {
      from_number: FROM_NUMBER,
      to_number: phoneNumber,
      override_agent_id: agentId,
      retell_llm_dynamic_variables: {
        contact_first_name: contactFirstName || 'there',
        webinar_label: webinarLabel || 'the upcoming webinar',
      },
    });

    logger.info('Retell outbound call created', {
      callType,
      phoneNumber,
      callId: response.data.call_id,
    });

    return response.data;
  } catch (err) {
    logger.error('Retell create call error', {
      error: err.response?.data || err.message,
      callType,
      phoneNumber,
    });
    return null;
  }
}

/**
 * Get call details from Retell.
 */
async function getCallDetails(callId) {
  try {
    const response = await retellClient.get(`/v2/get-call/${callId}`);
    return response.data;
  } catch (err) {
    logger.error('Retell get call error', {
      error: err.response?.data || err.message,
      callId,
    });
    return null;
  }
}

module.exports = {
  createOutboundCall,
  getCallDetails,
};
