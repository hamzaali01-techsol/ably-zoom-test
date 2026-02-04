import React from 'react';

/**
 * Displays participants from backend API response and message events.
 * Unlike PresenceMonitor (which uses Ably presence API), this component
 * tracks participants via backend-published events like student.joined_session.
 */
export function ParticipantsList({ participants, title = "Session Participants" }) {
  if (!participants || participants.length === 0) {
    return (
      <div className="participants-list">
        <div className="section-header">{title}</div>
        <div className="no-participants">
          No participants yet. When users join, they will appear here.
        </div>
      </div>
    );
  }

  // Group participants by role
  const groupedByRole = participants.reduce((acc, p) => {
    const role = p.role || 'Unknown';
    if (!acc[role]) acc[role] = [];
    acc[role].push(p);
    return acc;
  }, {});

  const roleOrder = ['Student', 'Assessor', 'Manager'];
  const sortedRoles = Object.keys(groupedByRole).sort((a, b) => {
    const indexA = roleOrder.indexOf(a);
    const indexB = roleOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available': return '#22c55e';
      case 'disconnected': return '#ef4444';
      case 'on-break': return '#f59e0b';
      case 'left': return '#6b7280';
      default: return '#3b82f6';
    }
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'student': return '👤';
      case 'assessor': return '📋';
      case 'manager': return '👔';
      default: return '❓';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="participants-list">
      <div className="section-header">
        {title}
        <span className="participant-count">({participants.length})</span>
      </div>

      {sortedRoles.map(role => (
        <div key={role} className="participant-group">
          <div className="participant-group-header">
            {getRoleIcon(role)} {role}s ({groupedByRole[role].length})
          </div>
          <div className="participant-items">
            {groupedByRole[role].map((participant) => (
              <div key={participant.userId} className="participant-item">
                <div className="participant-main">
                  <span className="participant-name">
                    {participant.name || `User ${participant.userId}`}
                  </span>
                  <span
                    className="participant-status"
                    style={{ color: getStatusColor(participant.status) }}
                  >
                    {participant.status || 'unknown'}
                  </span>
                </div>
                <div className="participant-details">
                  <span className="participant-id">ID: {participant.userId}</span>
                  {participant.roomId && (
                    <span className="participant-room">Room: {participant.roomId}</span>
                  )}
                  {participant.joinedAt && (
                    <span className="participant-time">
                      Joined: {formatTime(participant.joinedAt)}
                    </span>
                  )}
                  {participant.isRejoin && (
                    <span className="participant-rejoin">Rejoined</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
