/**
 * Service wrapper for Ably SDK operations
 */

import * as Ably from "ably";

/**
 * Creates an Ably Realtime client with token authentication
 * @param {object} tokenData - The token data from backend (the actual TokenRequest object)
 * @param {string} clientId - Client identifier (typically user ID)
 * @returns {Ably.Realtime} Ably client instance
 */
export function createAblyClient(tokenData, clientId) {
  if (!tokenData) {
    throw new Error("Token data is required to create Ably client");
  }

  // Handle both wrapped token (MessagingTokenRequest) and raw token data
  // If tokenData has a tokenData property, it's a MessagingTokenRequest wrapper
  const actualTokenData = tokenData.tokenData || tokenData;

  // Get clientId from token if not provided
  const resolvedClientId = clientId || actualTokenData.clientId || "anonymous";

  console.log("[Ably] Creating client with clientId:", resolvedClientId);
  console.log("[Ably] Token data:", actualTokenData);

  return new Ably.Realtime({
    authCallback: (tokenParams, callback) => {
      // Return token data to Ably for authentication
      console.log("[Ably] Auth callback invoked");
      callback(null, actualTokenData);
    },
    clientId: String(resolvedClientId),
    echoMessages: false, // Don't receive own published messages
    log: {
      level: 4, // Info level for debugging
      handler: (msg) => {
        if (msg.level >= 2) {
          console.log(`[Ably ${msg.level}] ${msg.message}`);
        }
      }
    }
  });
}

/**
 * Subscribes to a channel and specific event
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {string} eventName - Event name (optional - subscribe to all if not specified)
 * @param {function} callback - Callback for received messages
 * @returns {Ably.RealtimeChannel} Channel reference
 */
export function subscribeToChannel(client, channelName, eventName, callback) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  const channel = client.channels.get(channelName);

  if (eventName) {
    // Subscribe to specific event
    channel.subscribe(eventName, callback);
  } else {
    // Subscribe to all events on channel
    channel.subscribe(callback);
  }

  return channel;
}

/**
 * Unsubscribes from a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 */
export function unsubscribeFromChannel(client, channelName) {
  if (!client || !channelName) return;

  try {
    const channel = client.channels.get(channelName);
    channel.unsubscribe();
  } catch (e) {
    console.error(`Failed to unsubscribe from ${channelName}:`, e);
  }
}

/**
 * Enters presence on a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {object} presenceData - Data to include in presence
 * @returns {Promise<void>}
 */
export async function enterPresence(client, channelName, presenceData) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  console.log(`[Ably] Entering presence on ${channelName} with data:`, presenceData);
  const channel = client.channels.get(channelName);
  await channel.presence.enter(presenceData);
  console.log(`[Ably] Successfully entered presence on ${channelName}`);
}

/**
 * Subscribes to presence events on a channel
 * Must be called before or after entering presence to track other members
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {object} callbacks - Object with enter, leave, update callbacks
 * @returns {Ably.RealtimeChannel} Channel reference
 */
export function subscribeToPresence(client, channelName, callbacks = {}) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  const channel = client.channels.get(channelName);

  // Subscribe to individual presence events
  if (callbacks.enter) {
    channel.presence.subscribe("enter", callbacks.enter);
  }
  if (callbacks.leave) {
    channel.presence.subscribe("leave", callbacks.leave);
  }
  if (callbacks.update) {
    channel.presence.subscribe("update", callbacks.update);
  }

  // If a general callback is provided, subscribe to all events
  if (callbacks.all) {
    channel.presence.subscribe(callbacks.all);
  }

  return channel;
}

/**
 * Unsubscribes from presence events
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 */
export function unsubscribeFromPresence(client, channelName) {
  if (!client || !channelName) return;

  try {
    const channel = client.channels.get(channelName);
    channel.presence.unsubscribe();
  } catch (e) {
    console.error(`Failed to unsubscribe from presence on ${channelName}:`, e);
  }
}

/**
 * Leaves presence on a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @returns {Promise<void>}
 */
export async function leavePresence(client, channelName) {
  if (!client || !channelName) return;

  try {
    const channel = client.channels.get(channelName);
    await channel.presence.leave();
    console.log(`[Ably] Left presence on ${channelName}`);
  } catch (e) {
    console.error(`Failed to leave presence on ${channelName}:`, e);
  }
}

/**
 * Updates presence data on a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {object} presenceData - New presence data
 * @returns {Promise<void>}
 */
export async function updatePresence(client, channelName, presenceData) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  const channel = client.channels.get(channelName);
  await channel.presence.update(presenceData);
}

/**
 * Publishes a message to a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {string} eventName - Event name
 * @param {object} data - Event data
 * @returns {Promise<void>}
 */
export async function publishMessage(client, channelName, eventName, data) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  const channel = client.channels.get(channelName);
  await channel.publish(eventName, data);
}

/**
 * Gets presence members on a channel
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @returns {Promise<array>} Array of presence members
 */
export async function getPresenceMembers(client, channelName) {
  if (!client || !channelName) {
    throw new Error("Client and channel name are required");
  }

  const channel = client.channels.get(channelName);
  return await channel.presence.get();
}

/**
 * Handles connection state changes
 * @param {Ably.Realtime} client - Ably client
 * @param {function} callback - Called with (stateChange) when connection state changes
 * @returns {function} Unsubscribe function
 */
export function onConnectionStateChange(client, callback) {
  if (!client || !callback) {
    throw new Error("Client and callback are required");
  }

  client.connection.on(callback);

  // Return unsubscribe function
  return () => {
    client.connection.off(callback);
  };
}

/**
 * Closes Ably connection
 * @param {Ably.Realtime} client - Ably client
 * @returns {Promise<void>}
 */
export async function closeConnection(client) {
  if (!client) return;

  try {
    client.close();
  } catch (e) {
    console.error("Failed to close Ably connection:", e);
  }
}

/**
 * Gets current connection state
 * @param {Ably.Realtime} client - Ably client
 * @returns {string} Connection state (initialized, connecting, connected, disconnected, suspended, closing, closed, failed)
 */
export function getConnectionState(client) {
  if (!client) return "unknown";
  return client.connection.state;
}

/**
 * Waits for connection to be established
 * @param {Ably.Realtime} client - Ably client
 * @param {number} timeoutMs - Timeout in milliseconds (default 30000)
 * @returns {Promise<boolean>} True if connected, false if timeout
 */
export function waitForConnection(client, timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (!client) {
      resolve(false);
      return;
    }

    // Check if already connected
    if (client.connection.state === "connected") {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = onConnectionStateChange(client, (stateChange) => {
      console.log("[Ably] Connection state changed:", stateChange.current);
      if (stateChange.current === "connected") {
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
      } else if (stateChange.current === "failed" || stateChange.current === "closed") {
        clearTimeout(timeout);
        unsubscribe();
        resolve(false);
      }
    });
  });
}

/**
 * Checks if channel is attached (subscribed)
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @returns {boolean}
 */
export function isChannelAttached(client, channelName) {
  if (!client || !channelName) return false;

  const channel = client.channels.get(channelName);
  return channel && channel.state === "attached";
}

/**
 * Waits for a channel to be attached
 * @param {Ably.Realtime} client - Ably client
 * @param {string} channelName - Channel name
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if attached, false if timeout/failed
 */
export function waitForChannelAttach(client, channelName, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!client || !channelName) {
      resolve(false);
      return;
    }

    const channel = client.channels.get(channelName);

    // Check if already attached
    if (channel.state === "attached") {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      channel.off(stateHandler);
      resolve(false);
    }, timeoutMs);

    const stateHandler = (stateChange) => {
      console.log(`[Ably] Channel ${channelName} state:`, stateChange.current);
      if (stateChange.current === "attached") {
        clearTimeout(timeout);
        channel.off(stateHandler);
        resolve(true);
      } else if (stateChange.current === "failed") {
        clearTimeout(timeout);
        channel.off(stateHandler);
        resolve(false);
      }
    };

    channel.on(stateHandler);
  });
}
