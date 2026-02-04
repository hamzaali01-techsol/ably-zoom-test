import React, { useState, useRef, useEffect } from 'react';
import { EVENT_NAMES } from '../utils/constants';

/**
 * Component for displaying and filtering event logs
 */
export function EventLog({ events, clearEvents, role }) {
  const [filterChannel, setFilterChannel] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterTime, setFilterTime] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const logEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  // Get unique channels from events
  const channels = Array.from(new Set(
    events
      .filter(e => e.channel !== 'system')
      .map(e => e.channel)
  )).sort();

  // Get unique event names from events
  const eventNames = Array.from(new Set(
    events
      .filter(e => e.channel !== 'system')
      .map(e => e.eventName)
  )).sort();

  // Filter events
  const now = Date.now();
  const filteredEvents = events.filter(event => {
    // Channel filter
    if (filterChannel && event.channel !== filterChannel) return false;

    // Event name filter
    if (filterEvent && event.eventName !== filterEvent) return false;

    // Time filter
    if (filterTime !== 'all') {
      const eventTime = new Date(event.timestamp).getTime();
      const ageMs = now - eventTime;

      const timeThresholds = {
        '5min': 5 * 60 * 1000,
        '10min': 10 * 60 * 1000,
        '30min': 30 * 60 * 1000
      };

      if (ageMs > timeThresholds[filterTime]) return false;
    }

    // Search filter
    if (searchQuery) {
      const dataStr = JSON.stringify(event.data).toLowerCase();
      if (!dataStr.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  // Get event color based on type
  const getEventColor = (eventName) => {
    if (eventName.startsWith('presence.')) return '#9b59b6'; // Purple
    if (eventName.includes('joined') || eventName.includes('entered')) return '#27ae60'; // Green
    if (eventName.includes('approval') || eventName.includes('requested')) return '#f39c12'; // Orange
    if (eventName.includes('ended') || eventName.includes('leave')) return '#e74c3c'; // Red
    if (eventName.includes('approved') || eventName.includes('rejected')) return '#3498db'; // Blue
    return '#95a5a6'; // Gray
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="event-log">
      <div className="section-header">
        Event Log ({filteredEvents.length}/{events.length})
      </div>

      {/* Filters */}
      <div className="filters-container">
        <input
          type="text"
          placeholder="Search in data..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="filter-input"
        />

        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="filter-select"
        >
          <option value="">All Channels</option>
          {channels.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>

        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="filter-select"
        >
          <option value="">All Events</option>
          {eventNames.map(en => (
            <option key={en} value={en}>{en}</option>
          ))}
        </select>

        <select
          value={filterTime}
          onChange={(e) => setFilterTime(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Time</option>
          <option value="5min">Last 5 min</option>
          <option value="10min">Last 10 min</option>
          <option value="30min">Last 30 min</option>
        </select>

        <label className="auto-scroll-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>

        <button onClick={handleExport} className="btn btn-small">
          Export
        </button>

        <button onClick={clearEvents} className="btn btn-small btn-danger">
          Clear
        </button>
      </div>

      {/* Events List */}
      <div className="events-container">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            {events.length === 0
              ? 'No events yet - connect and trigger actions to see events'
              : 'No events match the current filters'}
          </div>
        ) : (
          <div className="events-list">
            {filteredEvents.map((event, idx) => (
              <div key={event.id} className="event-card">
                <div className="event-header">
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3
                    })}
                  </span>

                  {event.channel !== 'system' && (
                    <code className="event-channel">{event.channel}</code>
                  )}

                  <span
                    className="event-name"
                    style={{ color: getEventColor(event.eventName) }}
                  >
                    {event.eventName}
                  </span>
                </div>

                {event.data && Object.keys(event.data).length > 0 && (
                  <div className="event-data">
                    <pre>{JSON.stringify(event.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
