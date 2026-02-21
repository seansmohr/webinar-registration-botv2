import React from 'react';
import StatusBubble from './StatusBubble';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatWebinarTime(dateStr, timezone) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  try {
    return d.toLocaleString('en-US', {
      timeZone: timezone || 'America/Chicago',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return d.toLocaleString();
  }
}

function ContactTable({ contacts, onOverride }) {
  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No contacts found. Click "Sync Contacts" to pull from GoHighLevel.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Webinar Tag
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Webinar Date/Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Call 1 Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Call 2 Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Override
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Called
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {contact.first_name} {contact.last_name}
                  </div>
                  <div className="text-xs text-gray-500">{contact.timezone}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {contact.phone}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {contact.webinar_tag}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {formatWebinarTime(contact.webinar_time, contact.timezone)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBubble status={contact.call1_status} callType="call1" />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBubble status={contact.call2_status} callType="call2" />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StageToggle
                    currentStage={contact.current_stage}
                    contactId={contact.id}
                    isCompleted={contact.is_completed}
                    onOverride={onOverride}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(contact.call1_last_attempt || contact.call2_last_attempt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                  {contact.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageToggle({ currentStage, contactId, isCompleted, onOverride }) {
  return (
    <div className="inline-flex rounded-md shadow-sm">
      <button
        onClick={() => onOverride(contactId, 'call1')}
        className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
          currentStage === 'call1'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        Call 1
      </button>
      <button
        onClick={() => onOverride(contactId, 'call2')}
        className={`px-3 py-1 text-xs font-medium rounded-r-md border-t border-r border-b ${
          currentStage === 'call2'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        Call 2
      </button>
    </div>
  );
}

export default ContactTable;
