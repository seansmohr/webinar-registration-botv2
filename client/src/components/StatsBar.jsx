import React from 'react';

function StatsBar({ stats }) {
  const cards = [
    { label: 'Total Contacts', value: stats.total, color: 'bg-blue-500' },
    { label: 'Call 1 Active', value: stats.call1InProgress, color: 'bg-indigo-500' },
    { label: 'Call 2 Active', value: stats.call2InProgress, color: 'bg-purple-500' },
    { label: 'Completed', value: stats.completed, color: 'bg-gray-500' },
    { label: 'Confirmed Attendance', value: stats.confirmed, color: 'bg-green-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className={`inline-block w-2 h-2 rounded-full ${card.color} mr-2`} />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {card.label}
          </span>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export default StatsBar;
