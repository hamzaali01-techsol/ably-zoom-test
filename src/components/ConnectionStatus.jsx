import React from 'react';
import { CONNECTION_STATES } from '../utils/constants';

/**
 * Component for displaying connection status and subscribed channels
 */
export function ConnectionStatus({ status, subscribedChannels, presenceStatus, error }) {
  const getStatusColor = (state) => {
    switch (state) {
      case CONNECTION_STATES.CONNECTED:
        return '#27ae60'; // Green
      case CONNECTION_STATES.CONNECTING:
        return '#f39c12'; // Orange
      case CONNECTION_STATES.DISCONNECTED:
        return '#95a5a6'; // Gray
      case CONNECTION_STATES.FAILED:
        return '#e74c3c'; // Red
      default:
        return '#95a5a6';
    }
  };

  const getStatusLabel = (state) => {
    switch (state) {
      case CONNECTION_STATES.CONNECTED:
        return '● Connected';
      case CONNECTION_STATES.CONNECTING:
        return '◐ Connecting...';
      case CONNECTION_STATES.DISCONNECTED:
        return '○ Disconnected';
      case CONNECTION_STATES.FAILED:
        return '✕ Failed';
      default:
        return state;
    }
  };

  return (
    <div className="connection-status">
      <div className="section-header">Connection Status</div>

      {/* Status Badge */}
      <div className="status-badge-container">
        <div
          className="status-indicator"
          style={{ backgroundColor: getStatusColor(status) }}
        />
        <span className="status-label" style={{ color: getStatusColor(status) }}>
          {getStatusLabel(status)}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-box">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error.message}</span>
        </div>
      )}

      {/* Presence Status */}
      {presenceStatus && (
        <div className="presence-status">
          <span className="label">Presence:</span>
          <span className="value">{presenceStatus}</span>
        </div>
      )}

      {/* Subscribed Channels */}
      {subscribedChannels.length > 0 && (
        <div className="subscribed-channels">
          <div className="subsection-header">
            Subscribed Channels ({subscribedChannels.length})
          </div>
          <div className="channels-list">
            {subscribedChannels.map((ch, idx) => (
              <div key={idx} className="channel-item">
                <div className="channel-status">
                  {ch.status === 'attached' && <span className="status-dot attached">✓</span>}
                  {ch.status === 'attaching' && <span className="status-dot attaching">◐</span>}
                  {ch.status === 'failed' && <span className="status-dot failed">✕</span>}
                </div>
                <code className="channel-name">{ch.name}</code>
                {ch.error && <span className="channel-error">{ch.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
