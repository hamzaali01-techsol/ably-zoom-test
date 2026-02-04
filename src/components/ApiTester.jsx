import React, { useState, useCallback } from 'react';
import { apiRequest, extractToken, saveRequestHistory, getRequestHistory, formatApiError } from '../services/apiService';

/**
 * Component for testing API endpoints
 */
export function ApiTester({ endpoints, role, onTokenExtracted, onAutoConnect }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints[0] || null);
  const [params, setParams] = useState({});
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResponse, setShowResponse] = useState(false);
  const [history, setHistory] = useState(() => getRequestHistory(role));
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('apiBaseUrl') || 'https://localhost:7288');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const [manualToken, setManualToken] = useState('');

  // Handle parameter change
  const handleParamChange = useCallback((paramName, value) => {
    setParams(prev => ({ ...prev, [paramName]: value }));
  }, []);

  // Handle endpoint selection
  const handleEndpointSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
    setParams({});
    setResponse(null);
    setError(null);
  };

  // Save API URL and token to localStorage
  const handleSaveSettings = () => {
    localStorage.setItem('apiBaseUrl', apiUrl);
    localStorage.setItem('authToken', authToken);
  };

  // Make API request
  const handleMakeRequest = async () => {
    if (!selectedEndpoint) return;

    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      // Temporarily set API base URL for this request
      localStorage.setItem('apiBaseUrl', apiUrl);
      localStorage.setItem('authToken', authToken);

      const result = await apiRequest(selectedEndpoint, params);
      setResponse(result);
      setShowResponse(true);

      // Save to history
      saveRequestHistory(role, selectedEndpoint.path, params);
      setHistory(getRequestHistory(role));

      // Extract and emit token if present
      if (selectedEndpoint.tokenField) {
        const token = extractToken(result, selectedEndpoint.tokenField);
        if (token) {
          // Pass token, endpoint, and full response
          onTokenExtracted(token, selectedEndpoint, result);
        }
      }
    } catch (err) {
      setError(err);
      setShowResponse(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle manual token input
  const handleManualToken = () => {
    try {
      const token = JSON.parse(manualToken);
      onTokenExtracted(token, null, null);
      setManualToken('');
    } catch (err) {
      setError(new Error('Invalid JSON in token input'));
    }
  };

  // Handle history selection
  const handleHistorySelect = (historyItem) => {
    setParams(historyItem.params);
  };

  if (!selectedEndpoint && endpoints.length === 0) {
    return (
      <div className="api-tester">
        <div className="section-header">API Tester</div>
        <div className="empty-state">No endpoints configured for this role</div>
      </div>
    );
  }

  return (
    <div className="api-tester">
      <div className="section-header">API Tester</div>

      {/* Settings */}
      <div className="api-settings">
        <div className="settings-group">
          <label>API Base URL:</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://localhost:7288"
            className="input-field"
          />
        </div>

        <div className="settings-group">
          <label>Auth Token:</label>
          <input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Bearer token"
            className="input-field"
          />
        </div>

        <button onClick={handleSaveSettings} className="btn btn-small">
          Save Settings
        </button>
      </div>

      {/* Endpoint Selection */}
      {endpoints.length > 0 && (
        <div className="endpoint-selector">
          <div className="subsection-header">Select Endpoint</div>
          <div className="endpoint-list">
            {endpoints.map((ep, idx) => (
              <button
                key={idx}
                className={`endpoint-btn ${selectedEndpoint === ep ? 'active' : ''}`}
                onClick={() => handleEndpointSelect(ep)}
                title={ep.description}
              >
                <span className="method">{ep.method}</span>
                <span className="path">{ep.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Endpoint Details */}
      {selectedEndpoint && (
        <div className="endpoint-details">
          <div className="subsection-header">
            {selectedEndpoint.method} {selectedEndpoint.path}
          </div>
          {selectedEndpoint.description && (
            <p className="endpoint-description">{selectedEndpoint.description}</p>
          )}

          {/* Path Parameters */}
          {selectedEndpoint.pathParams && selectedEndpoint.pathParams.length > 0 && (
            <div className="params-group">
              <div className="params-label">Path Parameters</div>
              {selectedEndpoint.pathParams.map(param => (
                <div key={param} className="param-input">
                  <label>{param}:</label>
                  <input
                    type="text"
                    value={params[param] || ''}
                    onChange={(e) => handleParamChange(param, e.target.value)}
                    placeholder={param}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Body Parameters */}
          {selectedEndpoint.bodyParams && selectedEndpoint.bodyParams.length > 0 && (
            <div className="params-group">
              <div className="params-label">Body Parameters</div>
              {selectedEndpoint.bodyParams.map(param => (
                <div key={param} className="param-input">
                  <label>{param}:</label>
                  <input
                    type="text"
                    value={params[param] || ''}
                    onChange={(e) => handleParamChange(param, e.target.value)}
                    placeholder={param}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={handleMakeRequest}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Loading...' : 'Send Request'}
            </button>

            {selectedEndpoint.tokenField && (
              <button
                onClick={() => onAutoConnect && onAutoConnect(response)}
                disabled={!response || error}
                className="btn"
              >
                Auto-Connect
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <div className="history-section">
          <div className="subsection-header">Recent Requests</div>
          <div className="history-list">
            {history.map((item, idx) => (
              <button
                key={idx}
                className="history-item"
                onClick={() => handleHistorySelect(item)}
                title={new Date(item.timestamp).toLocaleString()}
              >
                <span className="endpoint-name">{item.endpointName}</span>
                <span className="params-summary">
                  {Object.entries(item.params).map(([k, v]) => `${k}:${v}`).join(', ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Token Input */}
      <div className="manual-token-section">
        <div className="subsection-header">Manual Token Input</div>
        <textarea
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Paste token JSON here..."
          className="textarea-field"
          rows={4}
        />
        <button
          onClick={handleManualToken}
          disabled={!manualToken}
          className="btn"
        >
          Use Token
        </button>
      </div>

      {/* Response Display */}
      {showResponse && (
        <div className="response-section">
          <button
            className="toggle-btn"
            onClick={() => setShowResponse(!showResponse)}
          >
            {showResponse ? '▼' : '▶'} Response
          </button>

          {showResponse && (
            <>
              {error ? (
                <div className="error-box">
                  <span className="error-icon">⚠️</span>
                  <div>
                    <div className="error-title">{error.message}</div>
                    {error.response && (
                      <pre className="error-response">
                        {JSON.stringify(error.response, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <pre className="response-json">
                  {JSON.stringify(response, null, 2)}
                </pre>
              )}

              {response && selectedEndpoint.tokenField && extractToken(response, selectedEndpoint.tokenField) && (
                <div className="success-box">
                  ✓ Token extracted: {extractToken(response, selectedEndpoint.tokenField)?.clientId || 'success'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
