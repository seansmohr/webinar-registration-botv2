const axios = require('axios');
const logger = require('../utils/logger');

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

const ghlClient = axios.create({
  baseURL: GHL_BASE_URL,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  },
});

/**
 * Search contacts by tag in GHL.
 * Uses the search/filter endpoint to find contacts with specific tags.
 */
async function getContactsByTag(tag) {
  const contacts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await ghlClient.post('/contacts/search', {
        locationId: LOCATION_ID,
        page,
        pageLimit: 100,
        filters: [
          {
            field: 'tags',
            operator: 'contains',
            value: tag,
          },
        ],
      });

      const data = response.data;
      if (data.contacts && data.contacts.length > 0) {
        contacts.push(...data.contacts);
        page++;
        hasMore = data.contacts.length === 100;
      } else {
        hasMore = false;
      }
    } catch (err) {
      logger.error('GHL search contacts error', {
        error: err.response?.data || err.message,
        tag,
        page,
      });
      hasMore = false;
    }
  }

  return contacts;
}

/**
 * Get a single contact by ID from GHL.
 */
async function getContact(contactId) {
  try {
    const response = await ghlClient.get(`/contacts/${contactId}`);
    return response.data.contact;
  } catch (err) {
    logger.error('GHL get contact error', {
      error: err.response?.data || err.message,
      contactId,
    });
    return null;
  }
}

/**
 * Add a tag to a contact in GHL.
 */
async function addTagToContact(contactId, tag) {
  try {
    const response = await ghlClient.put(`/contacts/${contactId}`, {
      tags: [tag],
    });
    logger.info('Tag added to GHL contact', { contactId, tag });
    return response.data;
  } catch (err) {
    // If PUT with just tags doesn't merge, try fetching existing tags first
    logger.error('GHL add tag error, trying merge approach', {
      error: err.response?.data || err.message,
      contactId,
      tag,
    });

    try {
      const contact = await getContact(contactId);
      if (contact) {
        const existingTags = contact.tags || [];
        if (!existingTags.includes(tag)) {
          existingTags.push(tag);
          const mergeResponse = await ghlClient.put(`/contacts/${contactId}`, {
            tags: existingTags,
          });
          logger.info('Tag merged to GHL contact', { contactId, tag });
          return mergeResponse.data;
        }
      }
    } catch (mergeErr) {
      logger.error('GHL tag merge also failed', {
        error: mergeErr.response?.data || mergeErr.message,
        contactId,
        tag,
      });
    }
    return null;
  }
}

module.exports = {
  getContactsByTag,
  getContact,
  addTagToContact,
};
