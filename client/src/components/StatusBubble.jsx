import React from 'react';

const CALL1_STYLES = {
  not_called: { color: 'bg-gray-400', label: 'Not Called' },
  attempting: { color: 'bg-blue-500', label: 'Attempting' },
  connected: { color: 'bg-green-500', label: 'Connected' },
  wrong_number: { color: 'bg-red-500', label: 'Wrong Number' },
  no_confirmation: { color: 'bg-yellow-400', label: 'No Confirmation' },
};

const CALL2_STYLES = {
  not_called: { color: 'bg-gray-400', label: 'Not Called' },
  attempting: { color: 'bg-blue-500', label: 'Attempting' },
  confirmed: { color: 'bg-green-500', label: 'Confirmed' },
  declined: { color: 'bg-red-500', label: 'Declined' },
  uncertain: { color: 'bg-yellow-400', label: 'Uncertain' },
  complete: { color: 'bg-purple-500', label: 'Complete' },
};

function StatusBubble({ status, callType }) {
  const styles = callType === 'call1' ? CALL1_STYLES : CALL2_STYLES;
  const style = styles[status] || { color: 'bg-gray-300', label: status || 'Unknown' };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.color}`} />
      <span className="text-sm text-gray-700">{style.label}</span>
    </span>
  );
}

export default StatusBubble;
