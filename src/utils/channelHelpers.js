/**
 * Utility functions for parsing and working with Ably channel names
 */

/**
 * Parses a channel name and extracts components
 * Example: "1:42:session" → { tenantId: 1, sessionInstanceId: 42, resource: "session" }
 * @param {string} channelName - The channel name to parse
 * @returns {object} Parsed channel components
 */
export function parseChannelName(channelName) {
  if (!channelName || typeof channelName !== "string") {
    return { raw: channelName };
  }

  const parts = channelName.split(":");

  if (parts.length < 2) {
    return { raw: channelName };
  }

  const result = {
    tenantId: parseInt(parts[0], 10),
    raw: channelName
  };

  // Tenant-wide user channel: {tenantId}:user:{userId}
  if (parts.length === 3 && parts[1] === "user") {
    result.scope = "tenant-wide";
    result.resource = "user";
    result.userId = parseInt(parts[2], 10);
    return result;
  }

  // Session-scoped channels: {tenantId}:{sessionInstanceId}:{resource}...
  if (parts.length >= 3) {
    result.sessionInstanceId = parseInt(parts[1], 10);
    result.scope = "session";
    result.resource = parts[2];

    if (parts.length === 4 && parts[2] !== "*") {
      // Resource with ID: room:{roomId}, user:{userId}, stage_availability:{stageId}
      const resourceId = parseInt(parts[3], 10);

      if (parts[2] === "room") {
        result.roomId = resourceId;
      } else if (parts[2] === "user") {
        result.userId = resourceId;
      } else if (parts[2] === "stage_availability") {
        // stage_availability:{sessionInstanceId}:{stageId}
        result.stageId = resourceId;
      }
    } else if (parts.length >= 5 && parts[2] === "stage_availability") {
      // stage_availability with stageId: {tenantId}:{sessionInstanceId}:stage_availability:{stageId}
      result.stageId = parseInt(parts[3], 10);
    }
  }

  return result;
}

/**
 * Formats a channel name for display with readable labels
 * @param {string} channelName - The channel name
 * @returns {string} Formatted channel name
 */
export function formatChannelName(channelName) {
  const parsed = parseChannelName(channelName);

  if (parsed.scope === "tenant-wide") {
    return `${parsed.tenantId} · User ${parsed.userId}`;
  }

  if (parsed.scope === "session") {
    let formatted = `${parsed.tenantId} · Session ${parsed.sessionInstanceId}`;

    if (parsed.resource === "session") {
      formatted += " · Session Channel";
    } else if (parsed.resource === "user") {
      formatted += ` · User ${parsed.userId}`;
    } else if (parsed.resource === "room") {
      formatted += ` · Room ${parsed.roomId}`;
    } else if (parsed.resource === "managers") {
      formatted += " · Managers";
    } else if (parsed.resource === "stage_availability") {
      formatted += ` · Stage Availability (Stage ${parsed.stageId})`;
    }

    return formatted;
  }

  return channelName;
}

/**
 * Checks if a channel name matches a wildcard pattern
 * Example: "1:42:room:101" matches "1:42:room:*"
 * @param {string} channelName - The channel name to test
 * @param {string} wildcardPattern - The wildcard pattern
 * @returns {boolean} True if matches
 */
export function matchesWildcard(channelName, wildcardPattern) {
  if (!wildcardPattern.includes("*")) {
    return channelName === wildcardPattern;
  }

  const regex = new RegExp("^" + wildcardPattern.replace(/\*/g, "[^:]*") + "$");
  return regex.test(channelName);
}

/**
 * Extracts the resource type from a channel name
 * @param {string} channelName
 * @returns {string} Resource type (session, user, room, managers, stage_availability)
 */
export function getResourceType(channelName) {
  const parsed = parseChannelName(channelName);
  return parsed.resource || "unknown";
}

/**
 * Checks if a channel supports presence capability
 * Only session channels support presence
 * @param {string} channelName
 * @returns {boolean}
 */
export function supportsPresence(channelName) {
  const parsed = parseChannelName(channelName);
  return parsed.resource === "session";
}

/**
 * Checks if a channel is a wildcard pattern
 * @param {string} channelName
 * @returns {boolean}
 */
export function isWildcardChannel(channelName) {
  return channelName && channelName.includes("*");
}

/**
 * Extracts numeric IDs from a channel name
 * @param {string} channelName
 * @returns {object} { tenantId, sessionInstanceId, roomId, userId, stageId }
 */
export function extractIds(channelName) {
  const parsed = parseChannelName(channelName);
  return {
    tenantId: parsed.tenantId,
    sessionInstanceId: parsed.sessionInstanceId,
    roomId: parsed.roomId,
    userId: parsed.userId,
    stageId: parsed.stageId
  };
}
