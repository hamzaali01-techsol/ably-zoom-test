import React, { useState } from 'react';
import { parseMessagingToken, formatCapabilities } from '../utils/tokenHelpers';

/**
 * Component for inspecting and displaying token details
 */
export function TokenInspector({ token, role }) {
  const [showRawJson, setShowRawJson] = useState(false);
  const parsed = parseMessagingToken(token);

  if (!parsed) {
    return (
      <div className="token-inspector">
        <div className="section-header">Token Inspector</div>
        <div className="empty-state">No token loaded</div>
      </div>
    );
  }

  const capabilities = formatCapabilities(parsed.capabilities);
  const statusColor = {
    'Valid': '#27ae60',
    'Expiring Soon': '#f39c12',
    'Expired': '#e74c3c'
  }[parsed.status];

  return (
    <div className="token-inspector">
      <div className="section-header">Token Inspector</div>

      <div className="token-info">
        {/* Status Badge */}
        <div className="info-row">
          <span className="label">Status:</span>
          <span
            className="badge status-badge"
            style={{ backgroundColor: statusColor }}
          >
            {parsed.status}
          </span>
        </div>

        {/* Expiration */}
        <div className="info-row">
          <span className="label">Expiration:</span>
          <span className="value">{parsed.formattedExpiry}</span>
        </div>

        {/* Client ID */}
        <div className="info-row">
          <span className="label">Client ID:</span>
          <code className="code-value">{parsed.clientId}</code>
        </div>

        {/* Channel Summary */}
        <div className="info-row">
          <span className="label">Channels:</span>
          <span className="value">{capabilities.length} channel(s)</span>
        </div>
      </div>

      {/* Capabilities Table */}
      {capabilities.length > 0 && (
        <div className="capabilities-section">
          <div className="subsection-header">Channel Capabilities</div>
          <div className="capabilities-list">
            {capabilities.map((cap, idx) => (
              <div key={idx} className="capability-item">
                <div className="capability-channel">
                  <code>{cap.channel}</code>
                </div>
                <div className="capability-caps">
                  {cap.capabilities.map((c, i) => (
                    <span key={i} className="cap-badge">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON */}
      <div className="raw-json-section">
        <button
          className="toggle-btn"
          onClick={() => setShowRawJson(!showRawJson)}
        >
          {showRawJson ? '▼' : '▶'} Raw Token Data
        </button>
        {showRawJson && (
          <pre className="raw-json">
            {JSON.stringify(parsed.rawTokenData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
