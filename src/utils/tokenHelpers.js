/**
 * Utility functions for parsing and validating Ably tokens
 */

import { parseChannelName } from './channelHelpers.js';

/**
 * Parses MessagingTokenRequest and extracts details
 * @param {object} messagingTokenRequest - The token request object
 * @returns {object|null} Parsed token details or null
 */
export function parseMessagingToken(messagingTokenRequest) {
  if (!messagingTokenRequest || typeof messagingTokenRequest !== "object") {
    return null;
  }

  const { tokenData, expiresAt, clientId } = messagingTokenRequest;

  if (!tokenData) {
    return null;
  }

  // Parse capabilities from token data
  let capabilities = {};
  if (tokenData && tokenData.capability) {
    try {
      capabilities = typeof tokenData.capability === "string"
        ? JSON.parse(tokenData.capability)
        : tokenData.capability;
    } catch (e) {
      console.error("Failed to parse capabilities:", e);
    }
  }

  // Calculate expiration info
  const expiresAtDate = new Date(expiresAt);
  const expiresInMs = expiresAtDate - Date.now();
  const expiresInMinutes = Math.floor(expiresInMs / 60000);

  // Determine status
  let status = "Valid";
  if (expiresInMs < 0) {
    status = "Expired";
  } else if (expiresInMs < 300000) { // 5 minutes
    status = "Expiring Soon";
  }

  return {
    clientId,
    capabilities,
    expiresAt: expiresAtDate,
    expiresInMs,
    expiresInMinutes,
    status,
    rawTokenData: tokenData,
    formattedExpiry: formatExpiry(expiresInMinutes)
  };
}

/**
 * Formats expiry time in a human-readable format
 * @param {number} expiresInMinutes
 * @returns {string}
 */
export function formatExpiry(expiresInMinutes) {
  if (expiresInMinutes < 0) {
    return "Expired";
  }
  if (expiresInMinutes === 0) {
    return "Expires in < 1 minute";
  }
  if (expiresInMinutes === 1) {
    return "Expires in 1 minute";
  }
  if (expiresInMinutes < 60) {
    return `Expires in ${expiresInMinutes} minutes`;
  }

  const hours = Math.floor(expiresInMinutes / 60);
  const mins = expiresInMinutes % 60;
  if (hours === 1 && mins === 0) {
    return "Expires in 1 hour";
  }
  if (hours === 1) {
    return `Expires in 1 hour ${mins} minutes`;
  }
  if (mins === 0) {
    return `Expires in ${hours} hours`;
  }
  return `Expires in ${hours} hours ${mins} minutes`;
}

/**
 * Formats capabilities for display
 * @param {object} capabilities - Channel capabilities object
 * @returns {array} Array of { channel, capabilities: array, parsed: object }
 */
export function formatCapabilities(capabilities) {
  return Object.entries(capabilities).map(([channel, caps]) => ({
    channel,
    capabilities: Array.isArray(caps) ? caps : [caps],
    parsed: parseChannelName(channel),
    displayName: getCapabilityDisplayName(channel, caps)
  }));
}

/**
 * Gets a display name for a capability entry
 * @param {string} channel
 * @param {array|string} capabilities
 * @returns {string}
 */
export function getCapabilityDisplayName(channel, capabilities) {
  const parsed = parseChannelName(channel);
  const caps = Array.isArray(capabilities) ? capabilities.join(", ") : capabilities;

  if (parsed.scope === "tenant-wide") {
    return `Tenant User ${parsed.userId} (${caps})`;
  }

  const resourceName = {
    session: "Session",
    user: "User",
    room: "Room",
    managers: "Managers",
    stage_availability: "Stage Availability"
  }[parsed.resource] || parsed.resource;

  let base = resourceName;
  if (parsed.roomId) base += ` ${parsed.roomId}`;
  if (parsed.userId) base += ` ${parsed.userId}`;
  if (parsed.stageId) base += ` ${parsed.stageId}`;

  return `${base} (${caps})`;
}

/**
 * Validates token is not expired
 * @param {object} messagingTokenRequest
 * @returns {boolean}
 */
export function isTokenValid(messagingTokenRequest) {
  if (!messagingTokenRequest) return false;
  const parsed = parseMessagingToken(messagingTokenRequest);
  return parsed && parsed.status !== "Expired";
}

/**
 * Checks if token will expire soon (< 5 minutes)
 * @param {object} messagingTokenRequest
 * @returns {boolean}
 */
export function isTokenExpiringSoon(messagingTokenRequest) {
  if (!messagingTokenRequest) return false;
  const parsed = parseMessagingToken(messagingTokenRequest);
  return parsed && parsed.expiresInMs > 0 && parsed.expiresInMs < 300000;
}

/**
 * Extracts channel names from capabilities
 * @param {object} capabilities
 * @returns {array} Array of channel names
 */
export function getChannelNames(capabilities) {
  return Object.keys(capabilities || {});
}

/**
 * Gets capability type (subscribe, publish, presence) as array
 * @param {string|array} capability
 * @returns {array}
 */
export function normalizeCapability(capability) {
  if (Array.isArray(capability)) {
    return capability;
  }
  if (typeof capability === "string") {
    return [capability];
  }
  return [];
}

/**
 * Checks if a capability includes a specific type
 * @param {string|array} capability
 * @param {string} type - "subscribe", "publish", "presence"
 * @returns {boolean}
 */
export function hasCapability(capability, type) {
  const normalized = normalizeCapability(capability);
  return normalized.includes(type);
}

/**
 * Generates a human-readable summary of token capabilities
 * @param {object} capabilities
 * @returns {string}
 */
export function summarizeCapabilities(capabilities) {
  const channels = Object.entries(capabilities);
  if (channels.length === 0) return "No channels";
  if (channels.length === 1) {
    const [channel, caps] = channels[0];
    const capList = normalizeCapability(caps).join(", ");
    return `1 channel: ${capList}`;
  }

  const parsed = channels.map(([ch, caps]) => ({
    resourceType: parseChannelName(ch).resource,
    capabilities: normalizeCapability(caps)
  }));

  // Count unique resource types
  const uniqueResources = new Set(parsed.map(p => p.resourceType));

  return `${channels.length} channels (${Array.from(uniqueResources).join(", ")})`;
}

/**
 * Compares two token capability sets to find differences
 * @param {object} oldCapabilities
 * @param {object} newCapabilities
 * @returns {object} { added: [], removed: [], unchanged: [] }
 */
export function compareCapabilities(oldCapabilities = {}, newCapabilities = {}) {
  const oldChannels = new Set(Object.keys(oldCapabilities));
  const newChannels = new Set(Object.keys(newCapabilities));

  const added = Array.from(newChannels).filter(ch => !oldChannels.has(ch));
  const removed = Array.from(oldChannels).filter(ch => !newChannels.has(ch));
  const unchanged = Array.from(oldChannels).filter(ch => newChannels.has(ch));

  return { added, removed, unchanged };
}
