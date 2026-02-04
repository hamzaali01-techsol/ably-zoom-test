import React from 'react';

/**
 * Component for monitoring presence members
 */
export function PresenceMonitor({ members, title = "Presence Members" }) {
  return (
    <div className="presence-monitor">
      <div className="section-header">{title}</div>

      {members && members.length === 0 ? (
        <div className="empty-state">No presence members</div>
      ) : (
        <div className="presence-list">
          {members && members.map((member, idx) => (
            <div key={idx} className="presence-member">
              <div className="member-header">
                <span className="member-id">👤 {member.clientId}</span>
                <span className={`member-action ${member.action}`}>
                  {member.action === 'enter' && '+ Joined'}
                  {member.action === 'present' && '● Present'}
                  {member.action === 'leave' && '- Left'}
                  {member.action === 'update' && '~ Updated'}
                </span>
              </div>

              {member.data && typeof member.data === 'object' && (
                <div className="member-data">
                  {Object.entries(member.data).map(([key, value]) => (
                    <div key={key} className="data-row">
                      <span className="data-key">{key}:</span>
                      <span className="data-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {member.timestamp && (
                <span className="member-time">
                  {new Date(member.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
