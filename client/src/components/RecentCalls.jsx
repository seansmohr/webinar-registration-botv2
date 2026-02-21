import React from 'react';

function formatTime(dateStr) {
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

function RecentCalls({ calls }) {
  if (calls.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Call Activity</h2>
        <p className="text-gray-500 text-sm">No calls yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Call Activity</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Contact
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Reached
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-600">
                  {formatTime(call.created_at)}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900">
                  {call.first_name} {call.last_name}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">{call.phone}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      call.call_type === 'call1'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {call.call_type === 'call1' ? 'Call 1' : 'Call 2'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">{call.status || '-'}</td>
                <td className="px-3 py-2 text-sm">
                  {call.reached_person === true ? (
                    <span className="text-green-600 font-medium">Yes</span>
                  ) : call.reached_person === false ? (
                    <span className="text-red-500">No</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">
                  {call.duration_seconds ? `${call.duration_seconds}s` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecentCalls;
