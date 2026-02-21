import React, { useState, useEffect, useCallback } from 'react';
import StatsBar from './components/StatsBar';
import ContactTable from './components/ContactTable';
import RecentCalls from './components/RecentCalls';

const API_BASE = '/api';

function App() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState({ stage: '', status: '', completed: '' });

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.stage) params.set('stage', filter.stage);
      if (filter.status) params.set('status', filter.status);
      if (filter.completed) params.set('completed', filter.completed);

      const [contactsRes, statsRes, callsRes] = await Promise.all([
        fetch(`${API_BASE}/contacts?${params}`),
        fetch(`${API_BASE}/dashboard/stats`),
        fetch(`${API_BASE}/dashboard/recent-calls`),
      ]);

      const contactsData = await contactsRes.json();
      const statsData = await statsRes.json();
      const callsData = await callsRes.json();

      setContacts(contactsData.contacts || []);
      setStats(statsData);
      setRecentCalls(callsData.calls || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API_BASE}/contacts/sync`, { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleOverride = async (contactId, stage) => {
    try {
      await fetch(`${API_BASE}/contacts/${contactId}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      await fetchData();
    } catch (err) {
      console.error('Override failed:', err);
    }
  };

  const handleDelete = async (contactId) => {
    try {
      await fetch(`${API_BASE}/contacts/${contactId}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleTriggerCall = async (contactId, callType) => {
    try {
      await fetch(`${API_BASE}/contacts/${contactId}/trigger-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType }),
      });
      await fetchData();
    } catch (err) {
      console.error('Trigger call failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mohr Insurance Services
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Medicare Webinar Outreach Dashboard
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                'Sync Contacts'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        {stats && <StatsBar stats={stats} />}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            value={filter.stage}
            onChange={(e) => setFilter((f) => ({ ...f, stage: e.target.value }))}
            className="rounded-md border-gray-300 shadow-sm text-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Stages</option>
            <option value="call1">Call 1</option>
            <option value="call2">Call 2</option>
          </select>

          <select
            value={filter.completed}
            onChange={(e) => setFilter((f) => ({ ...f, completed: e.target.value }))}
            className="rounded-md border-gray-300 shadow-sm text-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Contacts</option>
            <option value="false">Active</option>
            <option value="true">Completed</option>
          </select>
        </div>

        {/* Contact Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading contacts...</div>
        ) : (
          <ContactTable contacts={contacts} onOverride={handleOverride} onDelete={handleDelete} onTriggerCall={handleTriggerCall} />
        )}

        {/* Recent Calls */}
        <div className="mt-8">
          <RecentCalls calls={recentCalls} />
        </div>
      </main>
    </div>
  );
}

export default App;
