import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAblyConnection } from './hooks/useAblyConnection';
import { useZoomVideo } from './hooks/useZoomVideo';
import { ApiTester } from './components/ApiTester';
import { TokenInspector } from './components/TokenInspector';
import { ConnectionStatus } from './components/ConnectionStatus';
import { EventLog } from './components/EventLog';
import { PresenceMonitor } from './components/PresenceMonitor';
import { ParticipantsList } from './components/ParticipantsList';
import { ENDPOINTS, ROLE_CONFIGS } from './utils/constants';
import { parseMessagingToken } from './utils/tokenHelpers';
import './App.css';

/**
 * Main application component with tabs for each role
 */
function App() {
  const [activeTab, setActiveTab] = useState('student');
  const [token, setToken] = useState(null);
  const [apiResponse, setApiResponse] = useState(null); // Store full API response
  const [lastEndpoint, setLastEndpoint] = useState(null); // Track which endpoint was called
  const [showSettings, setShowSettings] = useState(false);
  const [instanceId] = useState(() => `Instance-${Date.now()}`);

  const {
    connect,
    disconnect,
    connectionStatus,
    events,
    subscribedChannels,
    presenceMembers,
    error,
    enterPresence,
    subscribeToChannel,
    publishMessage,
    clearEvents
  } = useAblyConnection();

  const [presenceStatus, setPresenceStatus] = useState('Not entered');

  // Handle token extraction from API response
  const handleTokenExtracted = useCallback(async (tokenData, endpoint, fullResponse) => {
    setToken(tokenData);
    setLastEndpoint(endpoint);
    setApiResponse(fullResponse);

    const parsed = parseMessagingToken(tokenData);
    if (!parsed) {
      console.error('Invalid token data');
      return;
    }

    // Auto-connect if enabled
    if (localStorage.getItem('autoConnect') === 'true') {
      try {
        await connect(tokenData, parsed.clientId);

        // Check if this is a StartLooking response (has stage_availability channel)
        // Channel format: {tenantId}:{sessionInstanceId}:stage_availability:{stageId}
        const isStartLooking = Object.keys(parsed.capabilities).some(ch =>
          ch.includes(':stage_availability:')
        );

        if (isStartLooking) {
          // For StartLooking, just subscribe to channels (no presence)
          setPresenceStatus('Subscribed to availability updates');
          const channels = Object.keys(parsed.capabilities);
          for (const ch of channels) {
            try {
              await subscribeToChannel(ch);
            } catch (err) {
              console.error(`Failed to subscribe to ${ch}:`, err);
            }
          }
        } else {
          // Enter presence on session channel if available
          const sessionChannel = Object.keys(parsed.capabilities).find(ch =>
            ch.includes(':session')
          );

          if (sessionChannel) {
            try {
              // Extract tenantId from channel name (format: {tenantId}:{sessionInstanceId}:session)
              const tenantId = parseInt(sessionChannel.split(':')[0], 10);
              await enterPresence(sessionChannel, {
                tenantId: tenantId,
                userId: parsed.clientId,
                role: activeTab,
                joinedAt: new Date().toISOString()
              });
              setPresenceStatus(`Entered on ${sessionChannel}`);
            } catch (err) {
              console.error('Failed to enter presence:', err);
              setPresenceStatus(`Failed: ${err.message}`);
            }
          }

          // Subscribe to all channels
          const channels = Object.keys(parsed.capabilities);
          for (const ch of channels) {
            try {
              await subscribeToChannel(ch);
            } catch (err) {
              console.error(`Failed to subscribe to ${ch}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-connect:', err);
      }
    }
  }, [activeTab, connect, enterPresence, subscribeToChannel]);

  // Handle manual connect
  const handleManualConnect = async () => {
    if (!token) return;

    const parsed = parseMessagingToken(token);
    if (!parsed) {
      console.error('Invalid token');
      return;
    }

    try {
      setPresenceStatus('Connecting...');
      await connect(token, parsed.clientId);

      // Check if this is a StartLooking token (has stage_availability channel)
      // Channel format: {tenantId}:{sessionInstanceId}:stage_availability:{stageId}
      const isStartLooking = Object.keys(parsed.capabilities).some(ch =>
        ch.includes(':stage_availability:')
      );

      if (isStartLooking) {
        // For StartLooking, just subscribe to channels (no presence)
        setPresenceStatus('Subscribed to availability updates');
        const channels = Object.keys(parsed.capabilities);
        for (const ch of channels) {
          try {
            await subscribeToChannel(ch);
          } catch (err) {
            console.error(`Failed to subscribe to ${ch}:`, err);
          }
        }
      } else {
        // Enter presence on session channel if available
        const sessionChannel = Object.keys(parsed.capabilities).find(ch =>
          ch.includes(':session')
        );

        if (sessionChannel) {
          try {
            // Extract tenantId from channel name (format: {tenantId}:{sessionInstanceId}:session)
            const tenantId = parseInt(sessionChannel.split(':')[0], 10);
            await enterPresence(sessionChannel, {
              tenantId: tenantId,
              userId: parsed.clientId,
              role: activeTab,
              joinedAt: new Date().toISOString()
            });
            setPresenceStatus(`Entered on ${sessionChannel}`);
          } catch (err) {
            console.error('Failed to enter presence:', err);
            setPresenceStatus(`Failed: ${err.message}`);
          }
        }

        // Subscribe to all channels
        const channels = Object.keys(parsed.capabilities);
        for (const ch of channels) {
          try {
            await subscribeToChannel(ch);
          } catch (err) {
            console.error(`Failed to subscribe to ${ch}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setPresenceStatus('Connection failed');
    }
  };

  // Handle manual disconnect
  const handleManualDisconnect = () => {
    disconnect();
    setPresenceStatus('Not entered');
  };

  // Render a tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'student':
        return <StudentTab
          token={token}
          onTokenExtracted={handleTokenExtracted}
          connectionStatus={connectionStatus}
          events={events}
          subscribedChannels={subscribedChannels}
          presenceMembers={presenceMembers}
          presenceStatus={presenceStatus}
          error={error}
          clearEvents={clearEvents}
          onConnect={handleManualConnect}
          onDisconnect={handleManualDisconnect}
        />;
      case 'assessor':
        return <AssessorTab
          token={token}
          onTokenExtracted={handleTokenExtracted}
          connectionStatus={connectionStatus}
          events={events}
          subscribedChannels={subscribedChannels}
          presenceMembers={presenceMembers}
          presenceStatus={presenceStatus}
          error={error}
          clearEvents={clearEvents}
          onConnect={handleManualConnect}
          onDisconnect={handleManualDisconnect}
          apiResponse={apiResponse}
          lastEndpoint={lastEndpoint}
        />;
      case 'manager':
        return <ManagerTab
          token={token}
          onTokenExtracted={handleTokenExtracted}
          connectionStatus={connectionStatus}
          events={events}
          subscribedChannels={subscribedChannels}
          presenceMembers={presenceMembers}
          presenceStatus={presenceStatus}
          error={error}
          clearEvents={clearEvents}
          onConnect={handleManualConnect}
          onDisconnect={handleManualDisconnect}
          onPublishMessage={publishMessage}
          apiResponse={apiResponse}
        />;
      case 'presence':
        return <PresenceTab
          events={events}
          presenceMembers={presenceMembers}
          clearEvents={clearEvents}
        />;
      case 'video':
        return <VideoTab />;
      case 'directJoin':
        return <DirectJoinTab />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1>🔍 Ably Debugging & Testing Tool</h1>
          <span className="instance-badge">{instanceId}</span>
        </div>
        <div className="header-right">
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Tab Navigation */}
      <nav className="tab-navigation">
        {Object.entries(ROLE_CONFIGS).map(([role, config]) => (
          <button
            key={role}
            className={`tab-btn ${activeTab === role ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(role);
              setToken(null);
              handleManualDisconnect();
            }}
            style={{
              borderBottom: activeTab === role ? `3px solid ${config.color}` : 'none'
            }}
          >
            <span className="role-indicator">{config.roleIndicator}</span>
            <span>{config.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="tab-content">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>Events: {events.length} | Connections: 1 | Status: {connectionStatus}</span>
      </footer>
    </div>
  );
}

/**
 * Student Tab Component
 */
function StudentTab({
  token,
  onTokenExtracted,
  connectionStatus,
  events,
  subscribedChannels,
  presenceMembers,
  presenceStatus,
  error,
  clearEvents,
  onConnect,
  onDisconnect
}) {
  return (
    <div className="tab-panel student-tab">
      <div className="tab-grid">
        {/* Left Column: API and Connection */}
        <div className="tab-column-left">
          <ApiTester
            endpoints={[ENDPOINTS.STUDENT.JOIN_SESSION, ENDPOINTS.STUDENT.JOIN_ROOM]}
            role="student"
            onTokenExtracted={onTokenExtracted}
          />

          <div className="connection-controls">
            <button
              onClick={onConnect}
              disabled={!token || connectionStatus === 'connected'}
              className="btn btn-primary"
            >
              Connect
            </button>
            <button
              onClick={onDisconnect}
              disabled={connectionStatus !== 'connected'}
              className="btn btn-danger"
            >
              Disconnect
            </button>
            {/* Show reconnect button if user has new token but is already connected */}
            {token && connectionStatus === 'connected' && (
              <button
                onClick={() => {
                  onDisconnect();
                  setTimeout(() => onConnect(), 500);
                }}
                className="btn btn-warning"
              >
                Reconnect
              </button>
            )}
          </div>

          <ConnectionStatus
            status={connectionStatus}
            subscribedChannels={subscribedChannels}
            presenceStatus={presenceStatus}
            error={error}
          />
        </div>

        {/* Right Column: Token, Events, Presence */}
        <div className="tab-column-right">
          {token && <TokenInspector token={token} role="student" />}
          <PresenceMonitor members={presenceMembers} />
          <EventLog events={events} clearEvents={clearEvents} role="student" />
        </div>
      </div>
    </div>
  );
}

/**
 * Assessor Tab Component
 */
function AssessorTab({
  token,
  onTokenExtracted,
  connectionStatus,
  events,
  subscribedChannels,
  presenceMembers,
  presenceStatus,
  error,
  clearEvents,
  onConnect,
  onDisconnect,
  apiResponse,
  lastEndpoint
}) {
  // Check if this is a StartLooking response
  const isStartLooking = lastEndpoint?.path?.includes('start-looking');
  const initialAvailability = apiResponse?.currentAvailability;

  // Track current availability - updates from events
  const [currentAvailability, setCurrentAvailability] = useState(null);

  // Update availability when initial response comes in
  useEffect(() => {
    if (initialAvailability) {
      setCurrentAvailability(initialAvailability);
    }
  }, [initialAvailability]);

  // Listen for availability.updated events and update the display
  useEffect(() => {
    if (events.length === 0) return;

    // Find the most recent availability.updated event
    const availabilityEvents = events.filter(e =>
      e.name === 'availability.updated' || e.eventName === 'availability.updated'
    );

    if (availabilityEvents.length > 0) {
      const latestEvent = availabilityEvents[availabilityEvents.length - 1];

      // The event data is nested inside message.data.Data (from MessagePayload)
      // Backend uses PascalCase, so check both PascalCase and camelCase
      const messageData = latestEvent.data || latestEvent;
      const eventData = messageData.Data || messageData.data || messageData;

      // Check for PascalCase (backend) or camelCase property names
      const available = eventData.AvailableInWaitingRoom ?? eventData.availableInWaitingRoom;
      const remaining = eventData.TotalRemaining ?? eventData.totalRemaining;
      const stage = eventData.StageId ?? eventData.stageId;

      if (available !== undefined) {
        setCurrentAvailability({
          stageId: stage || currentAvailability?.stageId,
          availableInWaitingRoom: available,
          totalRemaining: remaining
        });
      }
    }
  }, [events]);

  // Use current availability (from events) or initial (from API)
  const availability = currentAvailability || initialAvailability;

  return (
    <div className="tab-panel assessor-tab">
      <div className="tab-grid">
        <div className="tab-column-left">
          {/* Help tip for StartLooking */}
          <div className="help-tip">
            <span className="help-tip-icon">💡</span>
            <div>
              <strong>StartLooking Flow:</strong> First call JoinSession to connect as assessor with presence.
              Then call StartLooking to subscribe to stage availability updates. Events will appear when students
              join/leave the waiting room.
            </div>
          </div>

          <ApiTester
            endpoints={[ENDPOINTS.ASSESSOR.JOIN_SESSION, ENDPOINTS.ASSESSOR.START_LOOKING]}
            role="assessor"
            onTokenExtracted={onTokenExtracted}
          />

          <div className="connection-controls">
            <button
              onClick={onConnect}
              disabled={!token || connectionStatus === 'connected'}
              className="btn btn-primary"
            >
              Connect
            </button>
            <button
              onClick={onDisconnect}
              disabled={connectionStatus !== 'connected'}
              className="btn btn-danger"
            >
              Disconnect
            </button>
            {/* Show reconnect button if user has new token but is already connected */}
            {token && connectionStatus === 'connected' && (
              <button
                onClick={() => {
                  onDisconnect();
                  setTimeout(() => onConnect(), 500);
                }}
                className="btn btn-warning"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Warning when user has new token but is already connected */}
          {token && connectionStatus === 'connected' && isStartLooking && (
            <div className="help-tip" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
              <span className="help-tip-icon">⚠️</span>
              <div>
                <strong>New token received!</strong> You have a StartLooking token but are already connected.
                Click "Reconnect" to use the new token, or "Disconnect" first then "Connect".
              </div>
            </div>
          )}

          <ConnectionStatus
            status={connectionStatus}
            subscribedChannels={subscribedChannels}
            presenceStatus={presenceStatus}
            error={error}
          />

          {/* Show Stage Availability if StartLooking was called */}
          {isStartLooking && availability && (
            <div className="availability-display">
              <div className="availability-header">Stage Availability (Stage {availability.stageId})</div>
              <div className="availability-stats">
                <div className="availability-stat">
                  <div className="stat-value">{availability.availableInWaitingRoom}</div>
                  <div className="stat-label">In Waiting Room</div>
                </div>
                <div className="availability-stat">
                  <div className="stat-value">{availability.totalRemaining}</div>
                  <div className="stat-label">Total Remaining</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tab-column-right">
          {token && <TokenInspector token={token} role="assessor" />}
          <PresenceMonitor members={presenceMembers} />
          <EventLog events={events} clearEvents={clearEvents} role="assessor" />
        </div>
      </div>
    </div>
  );
}

/**
 * Manager Tab Component
 * Tracks participants via backend message events (not Ably presence API)
 */
function ManagerTab({
  token,
  onTokenExtracted,
  connectionStatus,
  events,
  subscribedChannels,
  presenceMembers,
  presenceStatus,
  error,
  clearEvents,
  onConnect,
  onDisconnect,
  onPublishMessage,
  apiResponse
}) {
  const [targetUserId, setTargetUserId] = useState('');
  const [messageEvent, setMessageEvent] = useState('');
  const [messageData, setMessageData] = useState('{}');

  // Track participants from backend events (not Ably presence)
  const [participants, setParticipants] = useState([]);

  // Initialize participants from API response
  useEffect(() => {
    if (apiResponse?.participants) {
      setParticipants(apiResponse.participants.map(p => ({
        userId: p.userId,
        name: p.name,
        role: p.role,
        status: p.status,
        roomId: p.roomId,
        joinedAt: p.joinedAt,
        isRejoin: false
      })));
    }
  }, [apiResponse]);

  // Listen for join events and update participant list
  useEffect(() => {
    if (events.length === 0) return;

    // Get the latest event
    const latestEvent = events[events.length - 1];
    const eventName = latestEvent.eventName || latestEvent.name;

    // Handle join events
    if (eventName === 'student.joined_session' ||
        eventName === 'assessor.joined_room' ||
        eventName === 'manager.joined_session') {

      // Extract event data (handle both PascalCase and camelCase)
      const messageData = latestEvent.data || latestEvent;
      const eventData = messageData.Data || messageData.data || messageData;

      const userId = eventData.UserId ?? eventData.userId;
      const roomId = eventData.RoomId ?? eventData.roomId;
      const isRejoin = eventData.IsRejoin ?? eventData.isRejoin ?? false;

      if (userId === undefined) return;

      // Determine role from event name
      let role = 'Unknown';
      if (eventName.includes('student')) role = 'Student';
      else if (eventName.includes('assessor')) role = 'Assessor';
      else if (eventName.includes('manager')) role = 'Manager';

      setParticipants(prev => {
        // Check if participant already exists
        const existingIndex = prev.findIndex(p => p.userId === userId);

        if (existingIndex >= 0) {
          // Update existing participant
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: 'available',
            roomId: roomId || updated[existingIndex].roomId,
            isRejoin
          };
          return updated;
        } else {
          // Add new participant
          return [...prev, {
            userId,
            name: `User ${userId}`, // Name not in event, use placeholder
            role,
            status: 'available',
            roomId: roomId || null,
            joinedAt: new Date().toISOString(),
            isRejoin
          }];
        }
      });
    }

    // Handle student.joined_room event (student moved to a room)
    if (eventName === 'student.joined_room') {
      const messageData = latestEvent.data || latestEvent;
      const eventData = messageData.Data || messageData.data || messageData;

      const userId = eventData.UserId ?? eventData.userId;
      const roomId = eventData.RoomId ?? eventData.roomId;

      if (userId !== undefined) {
        setParticipants(prev =>
          prev.map(p =>
            p.userId === userId
              ? { ...p, roomId, status: 'available' }
              : p
          )
        );
      }
    }

    // Handle disconnect events (from presence webhook processing)
    if (eventName === 'participant.disconnected' || eventName === 'student.disconnected') {
      const messageData = latestEvent.data || latestEvent;
      const eventData = messageData.Data || messageData.data || messageData;

      const userId = eventData.UserId ?? eventData.userId;

      if (userId !== undefined) {
        setParticipants(prev =>
          prev.map(p =>
            p.userId === userId
              ? { ...p, status: 'disconnected' }
              : p
          )
        );
      }
    }

    // Handle student ended exam event
    if (eventName === 'student.ended_exam') {
      const messageData = latestEvent.data || latestEvent;
      const eventData = messageData.Data || messageData.data || messageData;

      const userId = eventData.UserId ?? eventData.userId;

      if (userId !== undefined) {
        setParticipants(prev =>
          prev.map(p =>
            p.userId === userId
              ? { ...p, status: 'left', roomId: null }
              : p
          )
        );
      }
    }
  }, [events]);

  const handlePublish = async () => {
    if (!targetUserId || !messageEvent) return;

    const parsed = parseMessagingToken(token);
    if (!parsed) return;

    const sessionInstanceId = Object.keys(parsed.capabilities)[0]?.split(':')[1];
    if (!sessionInstanceId) return;

    // Get tenantId from channel name
    const tenantId = Object.keys(parsed.capabilities)[0]?.split(':')[0];
    const channelName = `${tenantId}:${sessionInstanceId}:user:${targetUserId}`;

    try {
      const data = JSON.parse(messageData);
      await onPublishMessage(channelName, messageEvent, data);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="tab-panel manager-tab">
      <div className="tab-grid">
        <div className="tab-column-left">
          <ApiTester
            endpoints={[ENDPOINTS.MANAGER.JOIN_SESSION, ENDPOINTS.MANAGER.GET_OBSERVER_TOKENS]}
            role="manager"
            onTokenExtracted={onTokenExtracted}
          />

          <div className="connection-controls">
            <button
              onClick={onConnect}
              disabled={!token || connectionStatus === 'connected'}
              className="btn btn-primary"
            >
              Connect
            </button>
            <button
              onClick={onDisconnect}
              disabled={connectionStatus !== 'connected'}
              className="btn btn-danger"
            >
              Disconnect
            </button>
            {/* Show reconnect button if user has new token but is already connected */}
            {token && connectionStatus === 'connected' && (
              <button
                onClick={() => {
                  onDisconnect();
                  setTimeout(() => onConnect(), 500);
                }}
                className="btn btn-warning"
              >
                Reconnect
              </button>
            )}
          </div>

          <ConnectionStatus
            status={connectionStatus}
            subscribedChannels={subscribedChannels}
            presenceStatus={presenceStatus}
            error={error}
          />

          {/* Message Publishing */}
          {connectionStatus === 'connected' && (
            <div className="publish-section">
              <div className="section-header">Publish Message</div>
              <div className="publish-form">
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Target User ID"
                  className="input-field"
                />
                <input
                  type="text"
                  value={messageEvent}
                  onChange={(e) => setMessageEvent(e.target.value)}
                  placeholder="Event Name"
                  className="input-field"
                />
                <textarea
                  value={messageData}
                  onChange={(e) => setMessageData(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="textarea-field"
                  rows={3}
                />
                <button onClick={handlePublish} className="btn btn-primary">
                  Publish
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="tab-column-right">
          {token && <TokenInspector token={token} role="manager" />}
          {/* ParticipantsList shows participants from backend events */}
          <ParticipantsList participants={participants} title="Session Participants (from events)" />
          {/* PresenceMonitor shows Ably real-time presence (for comparison/debugging) */}
          <PresenceMonitor members={presenceMembers} title="Ably Presence (real-time)" />
          <EventLog events={events} clearEvents={clearEvents} role="manager" />
        </div>
      </div>
    </div>
  );
}

/**
 * Presence Webhook Monitor Tab
 */
function PresenceTab({
  events,
  presenceMembers,
  clearEvents
}) {
  const [webhookPayload, setWebhookPayload] = useState(JSON.stringify({
    items: [{
      webhookId: "test123",
      source: "channel.presence",
      timestamp: Date.now(),
      data: {
        channelId: "1:42:session",
        presence: [{
          id: "msg123",
          clientId: "5",
          action: 3,
          timestamp: Date.now(),
          data: '{"tenantId":1,"joinedParticipantId":123}'
        }]
      }
    }]
  }, null, 2));
  const [webhookResponse, setWebhookResponse] = useState(null);
  const [webhookError, setWebhookError] = useState(null);

  const handleSendWebhook = async () => {
    try {
      setWebhookError(null);
      setWebhookResponse(null);

      const apiUrl = localStorage.getItem('apiBaseUrl') || 'https://localhost:7288';
      const authToken = localStorage.getItem('authToken') || '';

      const response = await fetch(`${apiUrl}/ably/presence-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: webhookPayload
      });

      const data = await response.json();
      setWebhookResponse({
        status: response.status,
        data
      });
    } catch (err) {
      setWebhookError(err.message);
    }
  };

  return (
    <div className="tab-panel presence-tab">
      <div className="tab-grid">
        <div className="tab-column-left">
          <div className="webhook-simulator">
            <div className="section-header">Webhook Simulator</div>
            <p className="section-info">
              POST /ably/presence-events
            </p>
            <textarea
              value={webhookPayload}
              onChange={(e) => setWebhookPayload(e.target.value)}
              placeholder="Webhook payload..."
              className="textarea-field"
              rows={10}
            />
            <button
              onClick={handleSendWebhook}
              className="btn btn-primary"
            >
              Send Webhook
            </button>

            {webhookError && (
              <div className="error-box">
                ⚠️ {webhookError}
              </div>
            )}

            {webhookResponse && (
              <div className="success-box">
                ✓ Webhook sent - Status: {webhookResponse.status}
                <pre>{JSON.stringify(webhookResponse.data, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="tab-column-right">
          <PresenceMonitor members={presenceMembers} title="Presence Members" />
          <EventLog events={events} clearEvents={clearEvents} role="presence" />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Panel Component
 */
function SettingsPanel({ onClose }) {
  const [autoConnect, setAutoConnect] = useState(
    localStorage.getItem('autoConnect') === 'true'
  );
  const [autoScroll, setAutoScroll] = useState(
    localStorage.getItem('autoScroll') !== 'false'
  );
  const [maxEvents, setMaxEvents] = useState(
    parseInt(localStorage.getItem('maxEvents') || '500', 10)
  );

  const handleSaveSettings = () => {
    localStorage.setItem('autoConnect', autoConnect);
    localStorage.setItem('autoScroll', autoScroll);
    localStorage.setItem('maxEvents', maxEvents);
    onClose();
  };

  const handleClearAllData = () => {
    if (confirm('Clear all stored data? This cannot be undone.')) {
      localStorage.clear();
      alert('All data cleared');
    }
  };

  return (
    <div className="settings-panel">
      <div className="section-header">Settings</div>

      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoConnect}
            onChange={(e) => setAutoConnect(e.target.checked)}
          />
          Auto-connect after API call
        </label>
      </div>

      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll event log
        </label>
      </div>

      <div className="settings-group">
        <label>Max events to keep:</label>
        <input
          type="number"
          value={maxEvents}
          onChange={(e) => setMaxEvents(parseInt(e.target.value, 10))}
          min="100"
          max="10000"
          className="input-field"
        />
      </div>

      <div className="settings-actions">
        <button onClick={handleSaveSettings} className="btn btn-primary">
          Save
        </button>
        <button onClick={handleClearAllData} className="btn btn-danger">
          Clear All Data
        </button>
        <button onClick={onClose} className="btn">
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Screen Share View Component - renders a participant's screen share
 */
function ScreenShareView({ userId, displayName, isCurrentUser, attachScreenShareView, detachScreenShareView }) {
  const containerRef = useRef(null);
  const [isAttaching, setIsAttaching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const attachShare = async () => {
      if (!containerRef.current) {
        console.log(`⚠️ Container not ready for user ${userId}`);
        return;
      }

      if (!isMounted) return;

      console.log(`📌 Attempting to attach share view for user ${userId} (${displayName})`);

      try {
        // Clear any existing content
        containerRef.current.innerHTML = '';

        setIsAttaching(true);
        setError(null);

        const success = await attachScreenShareView(userId, containerRef.current);

        if (success && isMounted) {
          console.log(`✅ Screen share attached successfully for ${displayName}`);
          setIsAttaching(false);
        } else if (isMounted) {
          console.log(`❌ Failed to attach share view for ${displayName}`);
          setError('Failed to attach share view');
          setIsAttaching(false);
        }
      } catch (err) {
        console.error(`❌ Error attaching share view for ${displayName}:`, err);
        if (isMounted) {
          setError(err.message || 'Unknown error');
          setIsAttaching(false);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(attachShare, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      console.log(`🔌 Detaching share view for user ${userId}`);
      detachScreenShareView(userId);
    };
  }, [userId, attachScreenShareView, detachScreenShareView, displayName]);

  return (
    <div className="screen-share-item">
      <div className="screen-share-header">
        <span className="screen-share-name">
          {displayName}'s Screen {isCurrentUser && '(You)'}
        </span>
        <span className="screen-share-badge">🖥️ Sharing</span>
      </div>
      <div
        ref={containerRef}
        className="screen-share-container"
        style={{
          width: '100%',
          minHeight: '360px',
          background: '#1a1a1a',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {isAttaching && (
          <div style={{ color: '#888', fontSize: '14px' }}>
            Loading screen share...
          </div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: '14px' }}>
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Remote Participant Video Component
 */
function RemoteVideo({ participant, stream, currentUserId, addLog }) {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  // Render video when participant starts their video
  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    if (participant.userId === currentUserId) return; // Skip self

    const renderVideo = async () => {
      if (participant.bVideoOn && !isRendering) {
        try {
          addLog(`Rendering video for ${participant.displayName}...`);
          await stream.renderVideo(
            canvasRef.current,
            participant.userId,
            320,
            180,
            0,
            0,
            2
          );
          setIsRendering(true);
          addLog(`Video rendered for ${participant.displayName}`, 'success');
        } catch (err) {
          addLog(`Failed to render ${participant.displayName}: ${err.message}`, 'error');
        }
      } else if (!participant.bVideoOn && isRendering) {
        try {
          await stream.stopRenderVideo(canvasRef.current, participant.userId);
          setIsRendering(false);
        } catch (err) {
          console.error('Failed to stop render:', err);
        }
      }
    };

    renderVideo();
  }, [participant.bVideoOn, participant.userId, participant.displayName, stream, currentUserId, isRendering, addLog]);

  // Skip rendering self
  if (participant.userId === currentUserId) return null;

  return (
    <div className="remote-video-item">
      <div className="remote-video-header">
        <span className="remote-video-name">{participant.displayName || `User ${participant.userId}`}</span>
        <span className="remote-video-status">
          {participant.bVideoOn && <span title="Video On">📹</span>}
          {participant.muted === false && <span title="Audio On">🎤</span>}
        </span>
      </div>
      <div className="remote-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={320}
          height={180}
          className={`remote-video-canvas ${participant.bVideoOn ? 'active' : ''}`}
        />
        {!participant.bVideoOn && (
          <div className="remote-video-placeholder">
            <span>📷 Camera Off</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Video Tab Component for testing Zoom Video SDK
 */
function VideoTab() {
  const canvasRef = useRef(null);
  const shareVideoRef = useRef(null);
  const [apiResponse, setApiResponse] = useState(null);
  const [userName, setUserName] = useState(() => localStorage.getItem('zoomUserName') || 'Test User');
  const [logs, setLogs] = useState([]);

  const {
    status,
    error,
    participants,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    screenShares,
    isRecording,
    currentUser,
    sessionInfo,
    initialize,
    join,
    leave,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    attachScreenShareView,
    detachScreenShareView,
    startRecording,
    stopRecording,
    stream,
    client
  } = useZoomVideo();

  // Add log entry
  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }].slice(-50)); // Keep last 50 logs
  }, []);

  // Handle token received from API
  const handleTokenExtracted = useCallback((tokenData, endpoint, fullResponse) => {
    setApiResponse(fullResponse);
    addLog(`Received video token for topic: ${tokenData?.topicName || 'unknown'}`, 'success');
  }, [addLog]);

  // Handle join session
  const handleJoin = async () => {
    if (!apiResponse?.videoToken) {
      addLog('No video token available. Call an API endpoint first.', 'error');
      return;
    }

    const { token, topicName } = apiResponse.videoToken;

    addLog(`Initializing Zoom SDK...`);
    const initialized = await initialize();
    if (!initialized) {
      addLog('Failed to initialize Zoom SDK', 'error');
      return;
    }

    addLog(`Joining session: ${topicName}`);
    localStorage.setItem('zoomUserName', userName);
    const joined = await join(topicName, token, userName);

    if (joined) {
      addLog(`Successfully joined session as "${userName}"`, 'success');
    } else {
      addLog('Failed to join session', 'error');
    }
  };

  // Handle leave session
  const handleLeave = async () => {
    addLog('Leaving session...');
    await leave();
    addLog('Left session', 'info');
  };

  // Handle start video
  const handleStartVideo = async () => {
    if (!canvasRef.current) {
      addLog('Canvas element not found', 'error');
      return;
    }

    addLog('Starting video...');
    const started = await startVideo(canvasRef.current);
    if (started) {
      addLog('Video started successfully', 'success');
    } else {
      addLog('Failed to start video', 'error');
    }
  };

  // Handle stop video
  const handleStopVideo = async () => {
    addLog('Stopping video...');
    const stopped = await stopVideo(canvasRef.current);
    if (stopped) {
      addLog('Video stopped', 'info');
    }
  };

  // Handle toggle audio
  const handleToggleAudio = async () => {
    const newState = !isAudioOn;
    addLog(newState ? 'Unmuting audio...' : 'Muting audio...');

    if (newState) {
      await startAudio();
    } else {
      await stopAudio();
    }
  };

  // Handle start screen share
  const handleStartScreenShare = async () => {
    addLog('Starting screen share...');

    // Always use video element for screen sharing
    if (!shareVideoRef.current) {
      addLog('Screen share video element not found', 'error');
      return;
    }

    const started = await startScreenShare(shareVideoRef.current);
    if (started) {
      addLog('Screen sharing started successfully', 'success');
    } else {
      addLog('Failed to start screen share', 'error');
    }
  };

  // Handle stop screen share
  const handleStopScreenShare = async () => {
    addLog('Stopping screen share...');
    const stopped = await stopScreenShare();
    if (stopped) {
      addLog('Screen sharing stopped', 'info');
    }
  };

  // Handle start recording
  const handleStartRecording = async () => {
    addLog('Starting cloud recording...');
    const started = await startRecording();
    if (started) {
      addLog('Recording start command sent. Waiting for confirmation...', 'success');

      // Set a timeout to check if recording actually started
      setTimeout(() => {
        if (!isRecording) {
          addLog('⚠️ Recording did not start. Possible reasons:', 'error');
          addLog('1. ISO Video feature is NOT enabled on your Zoom account', 'error');
          addLog('2. Contact Zoom Developer Support to enable "ISO Video for V-SDK"', 'error');
          addLog('3. Or check if you are the host of this session', 'error');
        }
      }, 5000); // Wait 5 seconds for recording to start
    } else {
      addLog('Failed to start recording - check error message above', 'error');
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    addLog('Stopping cloud recording...');
    const stopped = await stopRecording();
    if (stopped) {
      addLog('Recording stop command sent. Waiting for confirmation...', 'success');
    } else {
      addLog('Failed to stop recording', 'error');
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Log errors
  useEffect(() => {
    if (error) {
      addLog(error, 'error');
    }
  }, [error, addLog]);

  // Log recording status changes
  useEffect(() => {
    if (isRecording) {
      addLog('✅ RECORDING STARTED - Cloud recording is now active', 'success');
    } else if (logs.length > 0 && logs.some(log => log.message.includes('RECORDING STARTED'))) {
      // Only log stopped if we previously logged started
      addLog('⏹️ RECORDING STOPPED - Cloud recording has ended', 'info');
    }
  }, [isRecording, addLog]);

  return (
    <div className="tab-panel video-tab">
      <div className="tab-grid">
        {/* Left Column: API and Controls */}
        <div className="tab-column-left">
          {/* Help tip */}
          <div className="help-tip">
            <span className="help-tip-icon">🎥</span>
            <div>
              <strong>Zoom Video SDK Test:</strong> First call the GetHostVideoToken or GetObserverTokens
              endpoint to get a video token. Then enter your display name and click "Join Session".
              Once connected, you can start your video and audio.
            </div>
          </div>

          {/* API Tester */}
          <ApiTester
            endpoints={[ENDPOINTS.VIDEO.GET_HOST_TOKEN, ENDPOINTS.VIDEO.GET_OBSERVER_TOKENS]}
            role="video"
            onTokenExtracted={handleTokenExtracted}
          />

          {/* User Name Input */}
          <div className="video-settings">
            <div className="section-header">Session Settings</div>
            <div className="settings-group">
              <label>Display Name:</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your display name"
                className="input-field"
                disabled={status === 'connected'}
              />
            </div>
          </div>

          {/* Connection Controls */}
          <div className="video-controls">
            <div className="section-header">Connection</div>
            <div className="control-buttons">
              <button
                onClick={handleJoin}
                disabled={!apiResponse?.videoToken || status === 'connected' || status === 'connecting'}
                className="btn btn-primary"
              >
                {status === 'connecting' ? 'Connecting...' : 'Join Session'}
              </button>
              <button
                onClick={handleLeave}
                disabled={status !== 'connected'}
                className="btn btn-danger"
              >
                Leave Session
              </button>
            </div>

            {/* Status Display */}
            <div className={`video-status status-${status}`}>
              <span className="status-indicator"></span>
              <span>Status: {status}</span>
            </div>

            {sessionInfo && (
              <div className="session-info">
                <div><strong>Topic:</strong> {sessionInfo.topic}</div>
                {currentUser && <div><strong>User ID:</strong> {currentUser.userId}</div>}
              </div>
            )}
          </div>

          {/* Media Controls */}
          {status === 'connected' && (
            <div className="media-controls">
              <div className="section-header">Media Controls</div>
              <div className="control-buttons">
                <button
                  onClick={isVideoOn ? handleStopVideo : handleStartVideo}
                  className={`btn ${isVideoOn ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isVideoOn ? '📹 Stop Video' : '📹 Start Video'}
                </button>
                <button
                  onClick={handleToggleAudio}
                  className={`btn ${isAudioOn ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isAudioOn ? '🎤 Mute Audio' : '🎤 Unmute Audio'}
                </button>
                <button
                  onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
                  className={`btn ${isScreenSharing ? 'btn-danger' : 'btn-warning'}`}
                >
                  {isScreenSharing ? '🖥️ Stop Share' : '🖥️ Share Screen'}
                </button>
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`btn ${isRecording ? 'btn-danger' : 'btn-success'}`}
                >
                  {isRecording ? '⏹️ Stop Recording' : '⏺️ Start Recording'}
                </button>
              </div>
              {/* Recording Status Display */}
              <div style={{
                marginTop: '15px',
                padding: '12px',
                borderRadius: '6px',
                background: isRecording ? '#c53030' : '#2d3748',
                color: 'white',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                {isRecording ? (
                  <>
                    <span className="recording-dot" style={{
                      width: '12px',
                      height: '12px',
                      background: 'white',
                      borderRadius: '50%',
                      animation: 'pulse-dot 1.5s ease-in-out infinite'
                    }}></span>
                    <span>🔴 RECORDING ACTIVE</span>
                  </>
                ) : (
                  <span>⚫ Recording Not Active</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Video and Participants */}
        <div className="tab-column-right">
          {/* Camera Video */}
          <div className="video-container">
            <div className="section-header">
              My Camera
              {isVideoOn && <span className="live-indicator">LIVE</span>}
            </div>
            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className={`video-canvas ${isVideoOn ? 'active' : ''}`}
              />
              {!isVideoOn && status === 'connected' && (
                <div className="video-placeholder">
                  <span>Camera Off</span>
                  <button onClick={handleStartVideo} className="btn btn-small">
                    Start Video
                  </button>
                </div>
              )}
              {status !== 'connected' && (
                <div className="video-placeholder">
                  <span>Not Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* My Screen Share - shown in dedicated video element */}
          <div className="video-container">
            <div className="section-header">
              My Screen Share
              {isScreenSharing && <span className="live-indicator">SHARING</span>}
            </div>
            <div className="canvas-wrapper">
              <video
                ref={shareVideoRef}
                width={640}
                height={360}
                className={`video-canvas ${isScreenSharing ? 'active' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#2d3748'
                }}
                autoPlay
                playsInline
              />
              {!isScreenSharing && status === 'connected' && (
                <div className="video-placeholder">
                  <span>Not Sharing</span>
                  <button onClick={handleStartScreenShare} className="btn btn-small">
                    Share Screen
                  </button>
                </div>
              )}
              {status !== 'connected' && (
                <div className="video-placeholder">
                  <span>Not Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* Other Users' Screen Shares */}
          <div className="screen-shares-container">
            <div className="section-header">
              Other Screen Shares ({screenShares.filter(s => !s.isCurrentUser).length})
              <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '10px', color: '#888' }}>
                Multiple simultaneous shares enabled
              </span>
            </div>
            <div className="screen-shares-grid">
              {screenShares.filter(s => !s.isCurrentUser).length === 0 ? (
                <div className="empty-state">
                  <p>No other users sharing screens.</p>
                  <p style={{ marginTop: '10px', color: '#888', fontSize: '13px' }}>
                    Open another browser and start screen sharing to see it here!
                  </p>
                </div>
              ) : (
                screenShares
                  .filter(s => !s.isCurrentUser)
                  .map((share) => (
                    <ScreenShareView
                      key={share.userId}
                      userId={share.userId}
                      displayName={share.displayName}
                      isCurrentUser={false}
                      attachScreenShareView={attachScreenShareView}
                      detachScreenShareView={detachScreenShareView}
                    />
                  ))
              )}
            </div>
          </div>

          {/* Remote Participants Video */}
          <div className="remote-videos-container">
            <div className="section-header">
              Remote Participants ({participants.filter(p => p.userId !== currentUser?.userId).length})
            </div>
            <div className="remote-videos-grid">
              {participants.filter(p => p.userId !== currentUser?.userId).length === 0 ? (
                <div className="empty-state">No other participants yet. Open another browser tab and join with a different token!</div>
              ) : (
                participants
                  .filter(p => p.userId !== currentUser?.userId)
                  .map((p) => (
                    <RemoteVideo
                      key={p.userId}
                      participant={p}
                      stream={stream}
                      currentUserId={currentUser?.userId}
                      addLog={addLog}
                    />
                  ))
              )}
            </div>
          </div>

          {/* All Participants List */}
          <div className="video-participants">
            <div className="section-header">
              All Participants ({participants.length})
            </div>
            <div className="participants-list">
              {participants.length === 0 ? (
                <div className="empty-state">No participants yet</div>
              ) : (
                participants.map((p) => (
                  <div key={p.userId} className="participant-item">
                    <span className="participant-name">
                      {p.displayName || `User ${p.userId}`}
                      {p.userId === currentUser?.userId && ' (You)'}
                    </span>
                    <span className="participant-status">
                      {p.bVideoOn && '📹'}
                      {p.muted === false && '🎤'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="video-logs">
            <div className="section-header">
              Logs
              <button onClick={clearLogs} className="btn btn-small">Clear</button>
            </div>
            <div className="logs-container">
              {logs.length === 0 ? (
                <div className="empty-state">No logs yet</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`log-entry log-${log.type}`}>
                    <span className="log-time">[{log.timestamp}]</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Direct Join Tab Component - Join with raw token (no backend needed)
 */
function DirectJoinTab() {
  const canvasRef = useRef(null);
  const shareVideoRef = useRef(null);
  const [rawToken, setRawToken] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('directJoinUserName') || 'Test User');
  const [sessionTopic, setSessionTopic] = useState(() => localStorage.getItem('directJoinTopic') || '');
  const [logs, setLogs] = useState([]);

  const {
    status,
    error,
    participants,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    screenShares,
    isRecording,
    currentUser,
    sessionInfo,
    initialize,
    join,
    leave,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    attachScreenShareView,
    detachScreenShareView,
    startRecording,
    stopRecording,
    stream,
    client
  } = useZoomVideo();

  // Add log entry
  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }].slice(-50)); // Keep last 50 logs
  }, []);

  // Handle join session with direct token
  const handleDirectJoin = async () => {
    if (!rawToken.trim() || !sessionTopic.trim()) {
      addLog('Please provide both token and session topic', 'error');
      return;
    }

    addLog(`Initializing Zoom SDK...`);
    const initialized = await initialize();
    if (!initialized) {
      addLog('Failed to initialize Zoom SDK', 'error');
      return;
    }

    addLog(`Joining session: ${sessionTopic}`);
    localStorage.setItem('directJoinUserName', userName);
    localStorage.setItem('directJoinTopic', sessionTopic);

    const joined = await join(sessionTopic, rawToken, userName);

    if (joined) {
      addLog(`Successfully joined session as "${userName}"`, 'success');
    } else {
      addLog('Failed to join session', 'error');
    }
  };

  // Handle leave session
  const handleLeave = async () => {
    addLog('Leaving session...');
    await leave();
    addLog('Left session', 'info');
  };

  // Handle start video
  const handleStartVideo = async () => {
    if (!canvasRef.current) {
      addLog('Canvas element not found', 'error');
      return;
    }

    addLog('Starting video...');
    const started = await startVideo(canvasRef.current);
    if (started) {
      addLog('Video started successfully', 'success');
    } else {
      addLog('Failed to start video', 'error');
    }
  };

  // Handle stop video
  const handleStopVideo = async () => {
    addLog('Stopping video...');
    const stopped = await stopVideo(canvasRef.current);
    if (stopped) {
      addLog('Video stopped', 'info');
    }
  };

  // Handle toggle audio
  const handleToggleAudio = async () => {
    const newState = !isAudioOn;
    addLog(newState ? 'Unmuting audio...' : 'Muting audio...');

    if (newState) {
      await startAudio();
    } else {
      await stopAudio();
    }
  };

  // Handle start screen share
  const handleStartScreenShare = async () => {
    addLog('Starting screen share...');

    if (!shareVideoRef.current) {
      addLog('Screen share video element not found', 'error');
      return;
    }

    const started = await startScreenShare(shareVideoRef.current);
    if (started) {
      addLog('Screen sharing started successfully', 'success');
    } else {
      addLog('Failed to start screen share', 'error');
    }
  };

  // Handle stop screen share
  const handleStopScreenShare = async () => {
    addLog('Stopping screen share...');
    const stopped = await stopScreenShare();
    if (stopped) {
      addLog('Screen sharing stopped', 'info');
    }
  };

  // Handle start recording
  const handleStartRecording = async () => {
    addLog('Starting cloud recording...');
    const started = await startRecording();
    if (started) {
      addLog('Recording start command sent. Waiting for confirmation...', 'success');
    } else {
      addLog('Failed to start recording - check error message above', 'error');
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    addLog('Stopping cloud recording...');
    const stopped = await stopRecording();
    if (stopped) {
      addLog('Recording stop command sent. Waiting for confirmation...', 'success');
    } else {
      addLog('Failed to stop recording', 'error');
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Log errors
  useEffect(() => {
    if (error) {
      addLog(error, 'error');
    }
  }, [error, addLog]);

  // Log recording status changes
  useEffect(() => {
    if (isRecording) {
      addLog('✅ RECORDING STARTED - Cloud recording is now active', 'success');
    } else if (logs.length > 0 && logs.some(log => log.message.includes('RECORDING STARTED'))) {
      addLog('⏹️ RECORDING STOPPED - Cloud recording has ended', 'info');
    }
  }, [isRecording, addLog]);

  return (
    <div className="tab-panel video-tab">
      <div className="tab-grid">
        {/* Left Column: Token Input and Controls */}
        <div className="tab-column-left">
          {/* Help tip */}
          <div className="help-tip">
            <span className="help-tip-icon">🔗</span>
            <div>
              <strong>Direct Join (No Backend Needed):</strong> Get a video token from your backend on another device,
              then paste it here along with the session topic. Perfect for testing from multiple devices without
              deploying your backend!
            </div>
          </div>

          {/* Token Input */}
          <div className="video-settings">
            <div className="section-header">Session Details</div>
            <div className="settings-group">
              <label>Session Topic (e.g., "1-room-2"):</label>
              <input
                type="text"
                value={sessionTopic}
                onChange={(e) => setSessionTopic(e.target.value)}
                placeholder="1-room-2"
                className="input-field"
                disabled={status === 'connected'}
              />
            </div>
            <div className="settings-group">
              <label>Video Token (JWT):</label>
              <textarea
                value={rawToken}
                onChange={(e) => setRawToken(e.target.value)}
                placeholder="Paste your JWT token here (e.g., eyJhbGciOiJIUzI1NiIs...)"
                className="textarea-field"
                rows={4}
                disabled={status === 'connected'}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <div className="settings-group">
              <label>Display Name:</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your display name"
                className="input-field"
                disabled={status === 'connected'}
              />
            </div>
          </div>

          {/* Connection Controls */}
          <div className="video-controls">
            <div className="section-header">Connection</div>
            <div className="control-buttons">
              <button
                onClick={handleDirectJoin}
                disabled={!rawToken.trim() || !sessionTopic.trim() || status === 'connected' || status === 'connecting'}
                className="btn btn-primary"
              >
                {status === 'connecting' ? 'Connecting...' : 'Join Session'}
              </button>
              <button
                onClick={handleLeave}
                disabled={status !== 'connected'}
                className="btn btn-danger"
              >
                Leave Session
              </button>
            </div>

            {/* Status Display */}
            <div className={`video-status status-${status}`}>
              <span className="status-indicator"></span>
              <span>Status: {status}</span>
            </div>

            {sessionInfo && (
              <div className="session-info">
                <div><strong>Topic:</strong> {sessionInfo.topic}</div>
                {currentUser && <div><strong>User ID:</strong> {currentUser.userId}</div>}
              </div>
            )}
          </div>

          {/* Media Controls */}
          {status === 'connected' && (
            <div className="media-controls">
              <div className="section-header">Media Controls</div>
              <div className="control-buttons">
                <button
                  onClick={isVideoOn ? handleStopVideo : handleStartVideo}
                  className={`btn ${isVideoOn ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isVideoOn ? '📹 Stop Video' : '📹 Start Video'}
                </button>
                <button
                  onClick={handleToggleAudio}
                  className={`btn ${isAudioOn ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isAudioOn ? '🎤 Mute Audio' : '🎤 Unmute Audio'}
                </button>
                <button
                  onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
                  className={`btn ${isScreenSharing ? 'btn-danger' : 'btn-warning'}`}
                >
                  {isScreenSharing ? '🖥️ Stop Share' : '🖥️ Share Screen'}
                </button>
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`btn ${isRecording ? 'btn-danger' : 'btn-success'}`}
                >
                  {isRecording ? '⏹️ Stop Recording' : '⏺️ Start Recording'}
                </button>
              </div>
              {/* Recording Status Display */}
              <div style={{
                marginTop: '15px',
                padding: '12px',
                borderRadius: '6px',
                background: isRecording ? '#c53030' : '#2d3748',
                color: 'white',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                {isRecording ? (
                  <>
                    <span className="recording-dot" style={{
                      width: '12px',
                      height: '12px',
                      background: 'white',
                      borderRadius: '50%',
                      animation: 'pulse-dot 1.5s ease-in-out infinite'
                    }}></span>
                    <span>🔴 RECORDING ACTIVE</span>
                  </>
                ) : (
                  <span>⚫ Recording Not Active</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Video and Participants */}
        <div className="tab-column-right">
          {/* Camera Video */}
          <div className="video-container">
            <div className="section-header">
              My Camera
              {isVideoOn && <span className="live-indicator">LIVE</span>}
            </div>
            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className={`video-canvas ${isVideoOn ? 'active' : ''}`}
              />
              {!isVideoOn && status === 'connected' && (
                <div className="video-placeholder">
                  <span>Camera Off</span>
                  <button onClick={handleStartVideo} className="btn btn-small">
                    Start Video
                  </button>
                </div>
              )}
              {status !== 'connected' && (
                <div className="video-placeholder">
                  <span>Not Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* My Screen Share */}
          <div className="video-container">
            <div className="section-header">
              My Screen Share
              {isScreenSharing && <span className="live-indicator">SHARING</span>}
            </div>
            <div className="canvas-wrapper">
              <video
                ref={shareVideoRef}
                width={640}
                height={360}
                className={`video-canvas ${isScreenSharing ? 'active' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#2d3748'
                }}
                autoPlay
                playsInline
              />
              {!isScreenSharing && status === 'connected' && (
                <div className="video-placeholder">
                  <span>Not Sharing</span>
                  <button onClick={handleStartScreenShare} className="btn btn-small">
                    Share Screen
                  </button>
                </div>
              )}
              {status !== 'connected' && (
                <div className="video-placeholder">
                  <span>Not Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* Other Users' Screen Shares */}
          <div className="screen-shares-container">
            <div className="section-header">
              Other Screen Shares ({screenShares.filter(s => !s.isCurrentUser).length})
              <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '10px', color: '#888' }}>
                Multiple simultaneous shares enabled
              </span>
            </div>
            <div className="screen-shares-grid">
              {screenShares.filter(s => !s.isCurrentUser).length === 0 ? (
                <div className="empty-state">
                  <p>No other users sharing screens.</p>
                  <p style={{ marginTop: '10px', color: '#888', fontSize: '13px' }}>
                    Other participants' screen shares will appear here!
                  </p>
                </div>
              ) : (
                screenShares
                  .filter(s => !s.isCurrentUser)
                  .map((share) => (
                    <ScreenShareView
                      key={share.userId}
                      userId={share.userId}
                      displayName={share.displayName}
                      isCurrentUser={false}
                      attachScreenShareView={attachScreenShareView}
                      detachScreenShareView={detachScreenShareView}
                    />
                  ))
              )}
            </div>
          </div>

          {/* Remote Participants Video */}
          <div className="remote-videos-container">
            <div className="section-header">
              Remote Participants ({participants.filter(p => p.userId !== currentUser?.userId).length})
            </div>
            <div className="remote-videos-grid">
              {participants.filter(p => p.userId !== currentUser?.userId).length === 0 ? (
                <div className="empty-state">No other participants yet. Share this setup with another device!</div>
              ) : (
                participants
                  .filter(p => p.userId !== currentUser?.userId)
                  .map((p) => (
                    <RemoteVideo
                      key={p.userId}
                      participant={p}
                      stream={stream}
                      currentUserId={currentUser?.userId}
                      addLog={addLog}
                    />
                  ))
              )}
            </div>
          </div>

          {/* All Participants List */}
          <div className="video-participants">
            <div className="section-header">
              All Participants ({participants.length})
            </div>
            <div className="participants-list">
              {participants.length === 0 ? (
                <div className="empty-state">No participants yet</div>
              ) : (
                participants.map((p) => (
                  <div key={p.userId} className="participant-item">
                    <span className="participant-name">
                      {p.displayName || `User ${p.userId}`}
                      {p.userId === currentUser?.userId && ' (You)'}
                    </span>
                    <span className="participant-status">
                      {p.bVideoOn && '📹'}
                      {p.muted === false && '🎤'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="video-logs">
            <div className="section-header">
              Logs
              <button onClick={clearLogs} className="btn btn-small">Clear</button>
            </div>
            <div className="logs-container">
              {logs.length === 0 ? (
                <div className="empty-state">No logs yet</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`log-entry log-${log.type}`}>
                    <span className="log-time">[{log.timestamp}]</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
