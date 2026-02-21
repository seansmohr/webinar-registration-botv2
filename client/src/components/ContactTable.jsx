import React, { useState } from 'react';
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

function ContactTable({ contacts, onOverride, onDelete, onTriggerCall }) {
  const [triggeringCall, setTriggeringCall] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No contacts found. Click "Sync Contacts" to pull from GoHighLevel.
      </div>
    );
  }

  const handleTriggerCall = async (contactId, callType) => {
    setTriggeringCall((prev) => ({ ...prev, [contactId]: callType }));
    try {
      await onTriggerCall(contactId, callType);
    } finally {
      setTriggeringCall((prev) => ({ ...prev, [contactId]: null }));
    }
  };

  const handleDelete = async (contact) => {
    if (!window.confirm(`Delete ${contact.first_name} ${contact.last_name}? This will also remove all their call logs.`)) {
      return;
    }
    setDeletingId(contact.id);
    try {
      await onDelete(contact.id);
    } finally {
      setDeletingId(null);
    }
  };

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
                Trigger Call
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Called
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.map((contact) => (
              <tr key={contact.id} className={`hover:bg-gray-50 ${deletingId === contact.id ? 'opacity-50' : ''}`}>
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
                <td className="px-4 py-3 whitespace-nowrap">
                  <CallTrigger
                    contact={contact}
                    triggeringCallType={triggeringCall[contact.id]}
                    onTrigger={handleTriggerCall}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(contact.call1_last_attempt || contact.call2_last_attempt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                  {contact.notes || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(contact)}
                    disabled={deletingId === contact.id}
                    className="text-red-500 hover:text-red-700 disabled:text-red-300 disabled:cursor-not-allowed"
                    title="Delete contact"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
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

function CallTrigger({ contact, triggeringCallType, onTrigger }) {
  const isTriggering = !!triggeringCallType;

  return (
    <div className="inline-flex rounded-md shadow-sm">
      <button
        onClick={() => onTrigger(contact.id, 'call1')}
        disabled={isTriggering}
        className={`px-2.5 py-1 text-xs font-medium rounded-l-md border ${
          triggeringCallType === 'call1'
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-white text-green-700 border-gray-300 hover:bg-green-50 disabled:text-gray-400 disabled:hover:bg-white'
        }`}
      >
        {triggeringCallType === 'call1' ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Call 1
          </span>
        ) : 'Call 1'}
      </button>
      <button
        onClick={() => onTrigger(contact.id, 'call2')}
        disabled={isTriggering}
        className={`px-2.5 py-1 text-xs font-medium rounded-r-md border-t border-r border-b ${
          triggeringCallType === 'call2'
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-white text-green-700 border-gray-300 hover:bg-green-50 disabled:text-gray-400 disabled:hover:bg-white'
        }`}
      >
        {triggeringCallType === 'call2' ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Call 2
          </span>
        ) : 'Call 2'}
      </button>
    </div>
  );
}

export default ContactTable;
