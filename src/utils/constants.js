/**
 * Centralized constants for API endpoints, event names, and channel patterns
 */

export const ENDPOINTS = {
  STUDENT: {
    JOIN_SESSION: {
      method: "POST",
      path: "/student-session/{sessionId}/join",
      pathParams: ["sessionId"],
      bodyParams: [],
      tokenField: "messagingTokenRequest",
      description: "Join session as student and receive Ably token"
    },
    JOIN_ROOM: {
      method: "POST",
      path: "/student-session/{sessionInstanceId}/join-room",
      pathParams: ["sessionInstanceId"],
      bodyParams: [],
      tokenField: "messagingTokenRequest",
      description: "Join room as student - get updated token with room channel"
    }
  },
  ASSESSOR: {
    JOIN_SESSION: {
      method: "POST",
      path: "/assessor-session/{sessionId}/join",
      pathParams: ["sessionId"],
      bodyParams: [],
      tokenField: "messagingTokenRequest",
      description: "Join session as assessor and receive Ably token"
    },
    START_LOOKING: {
      method: "POST",
      path: "/assessor-session/{sessionInstanceId}/start-looking",
      pathParams: ["sessionInstanceId"],
      bodyParams: [],
      tokenField: "tokenRequest",
      description: "Start looking for students - get stage availability token"
    }
  },
  MANAGER: {
    JOIN_SESSION: {
      method: "POST",
      path: "/manager-session/{sessionId}/join",
      pathParams: ["sessionId"],
      bodyParams: [],
      tokenField: "messagingTokenRequest",
      description: "Join session as manager and receive Ably token with wildcard access"
    },
    GET_OBSERVER_TOKENS: {
      method: "GET",
      path: "/session-instance/{sessionInstanceId}/room/{roomId}/observer-tokens",
      pathParams: ["sessionInstanceId", "roomId"],
      bodyParams: [],
      tokenField: "videoToken",
      description: "Get video token for observing a specific room"
    }
  },
  WEBHOOK: {
    PRESENCE_EVENT: {
      method: "POST",
      path: "/ably/presence-events",
      bodyParams: ["items"],
      description: "Send presence webhook to backend"
    }
  },
  VIDEO: {
    GET_HOST_TOKEN: {
      method: "GET",
      path: "/room/host-video-token",
      pathParams: [],
      bodyParams: [],
      tokenField: "videoToken",
      description: "Get video token for host (assessor assigned to room)"
    },
    GET_OBSERVER_TOKENS: {
      method: "GET",
      path: "/session-instance/{sessionInstanceId}/room/{roomId}/observer-tokens",
      pathParams: ["sessionInstanceId", "roomId"],
      bodyParams: [],
      tokenField: "videoToken",
      description: "Get video token for observing a specific room (manager)"
    },
    ASSESSOR_JOIN: {
      method: "POST",
      path: "/assessor-session/{sessionId}/join",
      pathParams: ["sessionId"],
      bodyParams: [],
      tokenField: "videoToken",
      description: "Join session as assessor (includes video token)"
    },
    STUDENT_JOIN: {
      method: "POST",
      path: "/student-session/{sessionId}/join",
      pathParams: ["sessionId"],
      bodyParams: [],
      tokenField: "videoToken",
      description: "Join session as student (includes video token)"
    }
  }
};

export const EVENT_NAMES = {
  STUDENT_JOINED_SESSION: "student.joined_session",
  STUDENT_JOINED_ROOM: "student.joined_room",
  STUDENT_ENDED_EXAM: "student.ended_exam",
  ASSESSOR_JOINED_ROOM: "assessor.joined_room",
  MANAGER_JOINED_SESSION: "manager.joined_session",
  BATCH_COMPLETED: "batch.completed",
  STAGE_ASSIGNMENTS_STARTED: "session.stage_assignments_started",
  REJOIN_APPROVAL_REQUESTED: "rejoin.approval_requested",
  BREAK_REQUESTED: "break.requested",
  BREAK_ENDED: "break.ended",
  BREAK_APPROVED: "break.approved",
  BREAK_REJECTED: "break.rejected",
  RESUME_APPROVAL_REQUESTED: "resume.approval_requested",
  RESUME_APPROVED: "resume.approved",
  RESUME_REJECTED: "resume.rejected",
  AVAILABILITY_UPDATED: "availability.updated",
  STUDENT_CALLED_TO_ROOM: "student.called_to_room"
};

export const CHANNEL_PATTERNS = {
  SESSION: "{tenantId}:{sessionInstanceId}:session",
  USER: "{tenantId}:{sessionInstanceId}:user:{userId}",
  USER_TENANT_WIDE: "{tenantId}:user:{userId}",
  ROOM: "{tenantId}:{sessionInstanceId}:room:{roomId}",
  ROOM_WILDCARD: "{tenantId}:{sessionInstanceId}:room:*",
  MANAGERS: "{tenantId}:{sessionInstanceId}:managers",
  STAGE_AVAILABILITY: "{tenantId}:{sessionInstanceId}:stage_availability:{stageId}"
};

export const ROLE_COLORS = {
  student: "#3498db",    // Blue
  assessor: "#e74c3c",   // Red
  manager: "#2ecc71",    // Green
  presence: "#f39c12",   // Orange
  video: "#9b59b6",      // Purple
  directJoin: "#16a085"  // Teal
};

export const EVENT_COLORS = {
  "join": "#27ae60",          // Green
  "approval": "#f39c12",      // Orange
  "state_change": "#3498db",  // Blue
  "disconnect": "#e74c3c",    // Red
  "other": "#95a5a6"          // Gray
};

export const CONNECTION_STATES = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  FAILED: "failed"
};

export const CAPABILITY_TYPES = {
  SUBSCRIBE: "subscribe",
  PRESENCE: "presence",
  PUBLISH: "publish"
};

// Role-specific configurations
export const ROLE_CONFIGS = {
  student: {
    label: "Student",
    color: ROLE_COLORS.student,
    endpoints: [ENDPOINTS.STUDENT.JOIN_SESSION, ENDPOINTS.STUDENT.JOIN_ROOM],
    roleIndicator: "👤"
  },
  assessor: {
    label: "Assessor",
    color: ROLE_COLORS.assessor,
    endpoints: [ENDPOINTS.ASSESSOR.JOIN_SESSION, ENDPOINTS.ASSESSOR.START_LOOKING],
    roleIndicator: "👨‍🏫"
  },
  manager: {
    label: "Manager",
    color: ROLE_COLORS.manager,
    endpoints: [ENDPOINTS.MANAGER.JOIN_SESSION, ENDPOINTS.MANAGER.GET_OBSERVER_TOKENS],
    roleIndicator: "👨‍💼"
  },
  presence: {
    label: "Presence Monitor",
    color: ROLE_COLORS.presence,
    endpoints: [],
    roleIndicator: "📡"
  },
  video: {
    label: "Video Test",
    color: ROLE_COLORS.video,
    endpoints: [
      ENDPOINTS.VIDEO.ASSESSOR_JOIN,
      ENDPOINTS.VIDEO.STUDENT_JOIN,
      ENDPOINTS.VIDEO.GET_HOST_TOKEN,
      ENDPOINTS.VIDEO.GET_OBSERVER_TOKENS
    ],
    roleIndicator: "🎥"
  },
  directJoin: {
    label: "Direct Join",
    color: ROLE_COLORS.directJoin,
    endpoints: [],
    roleIndicator: "🔗"
  }
};
