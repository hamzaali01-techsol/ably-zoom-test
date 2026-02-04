import { useState, useRef, useCallback, useEffect } from 'react';
import * as AblyService from '../services/ablyService';

/**
 * Custom hook for managing Ably connections
 * Handles connection lifecycle, channel subscriptions, presence, and event logging
 */
export function useAblyConnection() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [events, setEvents] = useState([]);
  const [subscribedChannels, setSubscribedChannels] = useState([]);
  const [presenceMembers, setPresenceMembers] = useState([]);
  const [error, setError] = useState(null);

  const ablyClient = useRef(null);
  const channels = useRef(new Map());
  const presenceChannels = useRef(new Set());
  const connectionUnsubscribe = useRef(null);
  const eventCounters = useRef(new Map());

  const MAX_EVENTS = 500;

  /**
   * Adds an event to the log
   */
  const addEvent = useCallback((eventData) => {
    setEvents((prev) => {
      const newEvents = [...prev, {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        ...eventData
      }];
      return newEvents.slice(-MAX_EVENTS);
    });

    // Update event counters
    const channelKey = eventData.channel;
    eventCounters.current.set(channelKey, (eventCounters.current.get(channelKey) || 0) + 1);
  }, []);

  /**
   * Connects to Ably with provided token
   */
  const connect = useCallback(async (tokenData, clientId) => {
    try {
      setConnectionStatus('connecting');
      setError(null);

      // Create Ably client
      ablyClient.current = AblyService.createAblyClient(tokenData, clientId);

      // Set up connection state listener
      connectionUnsubscribe.current = AblyService.onConnectionStateChange(
        ablyClient.current,
        (stateChange) => {
          setConnectionStatus(stateChange.current);

          if (stateChange.current === 'failed') {
            setError(new Error(stateChange.reason?.message || 'Connection failed'));
          }
        }
      );

      // Wait for connection to establish
      const connected = await AblyService.waitForConnection(ablyClient.current);
      if (!connected) {
        throw new Error('Connection timeout');
      }

      addEvent({
        channel: 'system',
        eventName: 'Connection established',
        data: { clientId, connectionId: ablyClient.current.connection.id }
      });

    } catch (err) {
      setConnectionStatus('failed');
      setError(err);
      console.error('Failed to connect to Ably:', err);
    }
  }, [addEvent]);

  /**
   * Disconnects from Ably
   */
  const disconnect = useCallback(async () => {
    try {
      // Unsubscribe from connection state changes
      if (connectionUnsubscribe.current) {
        connectionUnsubscribe.current();
        connectionUnsubscribe.current = null;
      }

      // Unsubscribe from all presence
      presenceChannels.current.forEach((channelName) => {
        AblyService.unsubscribeFromPresence(ablyClient.current, channelName);
      });
      presenceChannels.current.clear();

      // Close all channels
      channels.current.forEach((channel) => {
        try {
          channel.unsubscribe();
        } catch (e) {
          console.error('Error unsubscribing from channel:', e);
        }
      });
      channels.current.clear();
      eventCounters.current.clear();

      // Close Ably connection
      if (ablyClient.current) {
        await AblyService.closeConnection(ablyClient.current);
        ablyClient.current = null;
      }

      setConnectionStatus('disconnected');
      setSubscribedChannels([]);
      setPresenceMembers([]);

      addEvent({
        channel: 'system',
        eventName: 'Disconnected',
        data: {}
      });

    } catch (err) {
      console.error('Error during disconnect:', err);
    }
  }, [addEvent]);

  /**
   * Subscribes to a channel and optionally a specific event
   */
  const subscribeToChannel = useCallback(async (channelName, eventName = null) => {
    if (!ablyClient.current) {
      throw new Error('Not connected to Ably');
    }

    try {
      // Subscribe to channel
      const channel = AblyService.subscribeToChannel(
        ablyClient.current,
        channelName,
        eventName,
        (message) => {
          addEvent({
            channel: channelName,
            eventName: message.name,
            data: message.data,
            timestamp: new Date(message.timestamp)
          });
        }
      );

      // Track the channel
      channels.current.set(channelName, channel);
      eventCounters.current.set(channelName, 0);

      // Update subscribed channels list
      setSubscribedChannels((prev) => {
        const exists = prev.some(ch => ch.name === channelName);
        if (!exists) {
          return [...prev, { name: channelName, status: 'attaching', eventName }];
        }
        return prev;
      });

      // Wait for channel to attach
      const attached = await AblyService.waitForChannelAttach(ablyClient.current, channelName);

      if (!attached) {
        throw new Error('Channel attach timeout or failed');
      }

      // Update channel status to attached
      setSubscribedChannels((prev) =>
        prev.map(ch => ch.name === channelName ? { ...ch, status: 'attached' } : ch)
      );

      addEvent({
        channel: 'system',
        eventName: `Subscribed to ${channelName}`,
        data: { eventName, channelState: channel.state }
      });

      return channel;

    } catch (err) {
      console.error(`Failed to subscribe to ${channelName}:`, err);

      setSubscribedChannels((prev) =>
        prev.map(ch => ch.name === channelName ? { ...ch, status: 'failed', error: err.message } : ch)
      );

      throw err;
    }
  }, [addEvent]);

  /**
   * Unsubscribes from a channel
   */
  const unsubscribeFromChannel = useCallback((channelName) => {
    try {
      AblyService.unsubscribeFromChannel(ablyClient.current, channelName);
      channels.current.delete(channelName);
      eventCounters.current.delete(channelName);

      setSubscribedChannels((prev) =>
        prev.filter(ch => ch.name !== channelName)
      );

      addEvent({
        channel: 'system',
        eventName: `Unsubscribed from ${channelName}`,
        data: {}
      });
    } catch (err) {
      console.error(`Failed to unsubscribe from ${channelName}:`, err);
    }
  }, [addEvent]);

  /**
   * Enters presence on a channel and subscribes to presence events
   */
  const enterPresence = useCallback(async (channelName, presenceData) => {
    if (!ablyClient.current) {
      throw new Error('Not connected to Ably');
    }

    try {
      // First, subscribe to presence events so we catch all updates
      AblyService.subscribeToPresence(ablyClient.current, channelName, {
        all: (presenceMessage) => {
          const timestamp = new Date(presenceMessage.timestamp);

          // Handle presence action
          if (presenceMessage.action === 'enter' || presenceMessage.action === 'present') {
            setPresenceMembers((prev) => {
              const exists = prev.some(m => m.clientId === presenceMessage.clientId);
              if (!exists) {
                return [...prev, {
                  clientId: presenceMessage.clientId,
                  data: presenceMessage.data,
                  action: presenceMessage.action,
                  timestamp
                }];
              }
              return prev;
            });
          } else if (presenceMessage.action === 'leave') {
            setPresenceMembers((prev) =>
              prev.filter(m => m.clientId !== presenceMessage.clientId)
            );
          } else if (presenceMessage.action === 'update') {
            setPresenceMembers((prev) =>
              prev.map(m =>
                m.clientId === presenceMessage.clientId
                  ? { ...m, data: presenceMessage.data, action: presenceMessage.action, timestamp }
                  : m
              )
            );
          }

          // Log presence event
          addEvent({
            channel: channelName,
            eventName: `presence.${presenceMessage.action}`,
            data: {
              clientId: presenceMessage.clientId,
              presenceData: presenceMessage.data
            }
          });
        }
      });

      presenceChannels.current.add(channelName);

      // Now enter presence
      await AblyService.enterPresence(ablyClient.current, channelName, presenceData);

      // Fetch existing presence members
      try {
        const existingMembers = await AblyService.getPresenceMembers(ablyClient.current, channelName);

        if (existingMembers && existingMembers.length > 0) {
          setPresenceMembers((prev) => {
            const newMembers = [...prev];
            existingMembers.forEach((member) => {
              const exists = newMembers.some(m => m.clientId === member.clientId);
              if (!exists) {
                newMembers.push({
                  clientId: member.clientId,
                  data: member.data,
                  action: 'present',
                  timestamp: new Date()
                });
              }
            });
            return newMembers;
          });
        }
      } catch (e) {
        console.warn('[Hook] Failed to fetch existing presence members:', e);
      }

      addEvent({
        channel: 'system',
        eventName: `Entered presence on ${channelName}`,
        data: presenceData
      });

    } catch (err) {
      console.error(`Failed to enter presence on ${channelName}:`, err);
      throw err;
    }
  }, [addEvent]);

  /**
   * Leaves presence on a channel
   */
  const leavePresence = useCallback(async (channelName) => {
    if (!ablyClient.current) return;

    try {
      await AblyService.leavePresence(ablyClient.current, channelName);
      AblyService.unsubscribeFromPresence(ablyClient.current, channelName);
      presenceChannels.current.delete(channelName);

      addEvent({
        channel: 'system',
        eventName: `Left presence on ${channelName}`,
        data: {}
      });
    } catch (err) {
      console.error(`Failed to leave presence on ${channelName}:`, err);
    }
  }, [addEvent]);

  /**
   * Publishes a message to a channel
   */
  const publishMessage = useCallback(async (channelName, eventName, data) => {
    if (!ablyClient.current) {
      throw new Error('Not connected to Ably');
    }

    try {
      await AblyService.publishMessage(ablyClient.current, channelName, eventName, data);

      addEvent({
        channel: 'system',
        eventName: `Published to ${channelName}`,
        data: { eventName, data }
      });
    } catch (err) {
      console.error(`Failed to publish to ${channelName}:`, err);
      throw err;
    }
  }, [addEvent]);

  /**
   * Clears event log
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
    eventCounters.current.clear();
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (ablyClient.current) {
        disconnect();
      }
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    subscribeToChannel,
    unsubscribeFromChannel,
    enterPresence,
    leavePresence,
    publishMessage,
    connectionStatus,
    events,
    subscribedChannels,
    presenceMembers,
    error,
    clearEvents
  };
}
