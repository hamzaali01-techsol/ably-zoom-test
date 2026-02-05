import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomVideo from '@zoom/videosdk';

/**
 * Custom hook for managing Zoom Video SDK connection and video
 */
export function useZoomVideo() {
  const clientRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState('disconnected'); // disconnected, initializing, connecting, connected, error
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false); // Track current sharing state for event handlers
  const [screenShares, setScreenShares] = useState([]); // Track all active screen shares: [{userId, displayName}]
  const [isRecording, setIsRecording] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [streamState, setStreamState] = useState(null); // Track stream as state for React reactivity
  const [multipleSharesEnabled, setMultipleSharesEnabled] = useState(null); // null = unknown, true = enabled, false = disabled
  const recordingClientRef = useRef(null);
  const shareVideoElementRef = useRef(null); // Store reference to share video element for auto-restart
  const autoRestartShareRef = useRef(false); // Flag to indicate if we should auto-restart share

  /**
   * Initialize the Zoom Video SDK client
   */
  const initialize = useCallback(async () => {
    if (clientRef.current) {
      console.log('Zoom client already initialized');
      return true;
    }

    try {
      setStatus('initializing');
      setError(null);

      // Create the client
      clientRef.current = ZoomVideo.createClient();

      // Initialize with language and region
      await clientRef.current.init('en-US', 'Global', { patchJsMedia: true });

      console.log('Zoom Video SDK initialized successfully');
      setStatus('disconnected');
      return true;
    } catch (err) {
      console.error('Failed to initialize Zoom Video SDK:', err);
      setError(`Initialization failed: ${err.message}`);
      setStatus('error');
      clientRef.current = null;
      return false;
    }
  }, []);

  /**
   * Join a video session
   * @param {string} topic - The session topic name
   * @param {string} token - The JWT token from backend
   * @param {string} userName - Display name for the user
   * @param {string} password - Optional session password
   */
  const join = useCallback(async (topic, token, userName, password = '') => {
    if (!clientRef.current) {
      const initialized = await initialize();
      if (!initialized) {
        return false;
      }
    }

    try {
      setStatus('connecting');
      setError(null);

      // Join the session
      await clientRef.current.join(topic, token, userName, password);

      // Get media stream
      streamRef.current = clientRef.current.getMediaStream();
      setStreamState(streamRef.current); // Also set as state for React reactivity

      // Get recording client
      recordingClientRef.current = clientRef.current.getRecordingClient();
      console.log('Recording client initialized:', recordingClientRef.current ? 'Yes' : 'No');

      // Get current user info
      const user = clientRef.current.getCurrentUserInfo();
      setCurrentUser(user);

      // Get session info
      const session = clientRef.current.getSessionInfo();
      setSessionInfo({
        topic: session.topic || topic,
        sessionId: session.sessionId,
        password: session.password
      });

      // Get initial participants
      const users = clientRef.current.getAllUser();
      setParticipants(users);

      // Enable multiple simultaneous screen shares
      try {
        // CRITICAL: Check if user is host (only host can set share privilege)
        const userInfo = clientRef.current.getCurrentUserInfo();
        console.log('User info:', userInfo);
        console.log('Is host?', userInfo?.isHost);

        if (userInfo?.isHost) {
          // Only host can set share privilege - SharePrivilege values: 0 = OneShare (default), 1 = MultipleShare
          console.log('🎯 Current user IS host - setting share privilege to MultipleShare');
          await streamRef.current.setSharePrivilege(1);
          console.log('✅ Multiple screen share privilege set to MultipleShare (1)');

          // Verify the privilege was set
          const currentPrivilege = await streamRef.current.getSharePrivilege?.();
          console.log('✅ Verified current share privilege:', currentPrivilege, currentPrivilege === 1 ? '(MultipleShare)' : '(OneShare)');

          if (currentPrivilege === 1) {
            setMultipleSharesEnabled(true);
          } else {
            console.error('❌ WARNING: Share privilege is NOT set to MultipleShare! Current value:', currentPrivilege);
            console.error('This means only ONE person can share at a time.');
            setMultipleSharesEnabled(false);
          }
        } else {
          console.warn('⚠️ Current user is NOT host. Cannot set share privilege.');
          console.warn('⚠️ Multiple simultaneous screen shares will only work if the HOST enables it.');
          console.warn('⚠️ If you need multiple shares, make sure the FIRST person to join sets it up.');

          // Check current privilege (read-only for non-hosts)
          const currentPrivilege = await streamRef.current.getSharePrivilege?.();
          console.log('📊 Current share privilege:', currentPrivilege, currentPrivilege === 1 ? '(MultipleShare ✅)' : '(OneShare ⚠️ - only one user can share at a time)');
          setMultipleSharesEnabled(currentPrivilege === 1);
        }
      } catch (err) {
        console.error('❌ Failed to check/set screen share privilege:', err);
        console.error('This could prevent multiple simultaneous shares from working');
        setMultipleSharesEnabled(false);
      }

      // Re-check share privilege after a delay to handle race conditions
      // (in case another user sets it after we join)
      setTimeout(async () => {
        try {
          if (!streamRef.current) return;
          const currentPrivilege = await streamRef.current.getSharePrivilege?.();
          console.log('🔄 Re-checked share privilege after delay:', currentPrivilege, currentPrivilege === 1 ? '(MultipleShare ✅)' : '(OneShare ⚠️)');
          setMultipleSharesEnabled(currentPrivilege === 1);
        } catch (err) {
          console.error('Failed to re-check share privilege:', err);
        }
      }, 3000); // Check again after 3 seconds

      // Set up event listeners
      setupEventListeners();

      setStatus('connected');
      console.log('Joined Zoom session:', topic);
      return true;
    } catch (err) {
      console.error('Failed to join session:', err);
      setError(`Join failed: ${err.message}`);
      setStatus('error');
      return false;
    }
  }, [initialize]);

  /**
   * Set up event listeners for participant and media changes
   */
  const setupEventListeners = useCallback(() => {
    if (!clientRef.current) return;

    // User added
    clientRef.current.on('user-added', (payload) => {
      console.log('User added:', payload);
      setParticipants(clientRef.current.getAllUser());
    });

    // User removed
    clientRef.current.on('user-removed', (payload) => {
      console.log('User removed:', payload);
      setParticipants(clientRef.current.getAllUser());
    });

    // User updated
    clientRef.current.on('user-updated', (payload) => {
      console.log('User updated:', payload);
      setParticipants(clientRef.current.getAllUser());
    });

    // Peer video state change
    clientRef.current.on('peer-video-state-change', (payload) => {
      console.log('Peer video state change:', payload);
      setParticipants(clientRef.current.getAllUser());
    });

    // Connection change
    clientRef.current.on('connection-change', (payload) => {
      console.log('Connection change:', payload);
      if (payload.state === 'Closed') {
        setStatus('disconnected');
        setParticipants([]);
        setCurrentUser(null);
      }
    });

    // Recording change
    clientRef.current.on('recording-change', (payload) => {
      console.log('Recording change event received:', payload);
      console.log('Payload type:', typeof payload);
      console.log('Payload.action:', payload?.action);
      console.log('Payload value:', payload);

      // Handle different payload formats
      // Format 1: { action: 'started' } or { action: 'stopped' }
      // Format 2: 'Recording' or 'Stopped'
      const isStarted =
        payload?.action === 'started' ||
        payload === 'Recording' ||
        (typeof payload === 'string' && payload.toLowerCase().includes('recording'));

      const isStopped =
        payload?.action === 'stopped' ||
        payload === 'Stopped' ||
        (typeof payload === 'string' && payload.toLowerCase().includes('stopped'));

      if (isStarted) {
        console.log('✅ Setting recording state to TRUE');
        setIsRecording(true);
      } else if (isStopped) {
        console.log('⏹️ Setting recording state to FALSE');
        setIsRecording(false);
      } else {
        console.warn('Unknown recording-change payload format:', payload);
      }
    });

    // Active share change (screen sharing) - for own screen share state tracking
    clientRef.current.on('active-share-change', (payload) => {
      console.log('🔵 Active share change:', payload);
      const currentUserId = clientRef.current.getCurrentUserInfo()?.userId;

      if (payload.userId === currentUserId) {
        const isActive = payload.state === 'Active';
        const wasSharing = isScreenSharingRef.current;

        setIsScreenSharing(isActive);
        isScreenSharingRef.current = isActive;

        if (wasSharing && !isActive) {
          console.log('🔵 ⚠️ WARNING: Current user screen sharing was FORCIBLY STOPPED!');
          console.log('🔵 This likely means another user started sharing and Zoom stopped yours.');
          console.log('🔵 Multiple simultaneous shares is NOT working properly!');
          console.log('🔵 Possible causes:');
          console.log('🔵   1. Share privilege not set correctly (must be set by host)');
          console.log('🔵   2. Account does not support multiple simultaneous shares');
          console.log('🔵   3. SDK version issue');
        } else {
          console.log(`🔵 Current user screen sharing: ${isActive ? 'started' : 'stopped'}`);
        }
        // Note: screenShares is managed manually in startShareScreen/stopShareScreen
      } else {
        console.log(`🔵 Active share change for OTHER user ${payload.userId}: ${payload.state}`);

        // DIAGNOSTIC: Check if this affects our local video element
        if (payload.state === 'Active' && isScreenSharingRef.current) {
          console.log('🔍 DIAGNOSTIC: Another user started sharing while we are sharing');
          console.log('🔍 Checking our video element status...');
          // This will be logged by the component that holds the video ref
        }
      }
    });

    // Peer share state change - for multiple simultaneous screen shares (OTHER users)
    clientRef.current.on('peer-share-state-change', (payload) => {
      console.log('🟢 Peer share state change:', JSON.stringify(payload, null, 2));
      // Zoom SDK uses 'action' not 'state' in this event!
      const { userId, action, state } = payload;
      const shareState = action || state; // Try both properties
      const currentUserId = clientRef.current.getCurrentUserInfo()?.userId;

      console.log(`🟢 Peer share: userId=${userId}, action=${action}, state=${state}, shareState=${shareState}, currentUserId=${currentUserId}`);

      // IMPORTANT: If we receive a Stop event for the current user via peer-share-state-change,
      // it means Zoom forcibly stopped our share (another user started sharing in OneShare mode)
      if (userId === currentUserId && shareState === 'Stop') {
        console.log('🟢 ⚠️ CRITICAL: Received Stop event for CURRENT USER via peer-share-state-change');
        console.log('🟢 This means another participant started sharing and Zoom stopped your share.');
        console.log('🟢 Multiple simultaneous shares is NOT working - Zoom is in OneShare mode!');
        // Don't skip this - we need to update our state
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setScreenShares(prev => prev.filter(s => s.userId !== currentUserId));
        return;
      }

      // Skip current user for Start events - they're handled manually in startShareScreen
      if (userId === currentUserId) {
        console.log('🟢 Skipping peer-share-state-change Start for current user (handled manually)');
        return;
      }

      if (shareState === 'Start') {
        // Add peer to screen shares list
        const allUsers = clientRef.current.getAllUser();
        console.log('🟢 All users:', allUsers);
        const user = allUsers.find(u => u.userId === userId);
        console.log(`🟢 Found user object:`, user);

        setScreenShares(prev => {
          // Check if already in list
          if (prev.find(s => s.userId === userId)) {
            console.log(`🟢 Peer user ${userId} already in screenShares list`);
            return prev;
          }
          console.log(`🟢 ✅ Adding peer user ${userId} (${user?.displayName}) to screenShares`);
          const newShare = {
            userId,
            displayName: user?.displayName || `User ${userId}`,
            isCurrentUser: false
          };
          console.log(`🟢 New share object:`, newShare);
          return [...prev, newShare];
        });
      } else if (shareState === 'Stop') {
        // Remove peer from screen shares list
        console.log(`🟢 ❌ Removing peer user ${userId} from screenShares`);
        setScreenShares(prev => prev.filter(s => s.userId !== userId));
      }
    });
  }, []);

  /**
   * Start video (turn on camera)
   * @param {HTMLCanvasElement|HTMLVideoElement} element - The element to render video to
   */
  const startVideo = useCallback(async (element) => {
    if (!streamRef.current || !currentUser) {
      setError('Not connected to a session');
      return false;
    }

    try {
      // Check if SharedArrayBuffer is available (needed for canvas)
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      console.log('🎥 Starting video - SharedArrayBuffer available:', hasSharedArrayBuffer);
      console.log('🎥 Element type:', element?.tagName, element instanceof HTMLCanvasElement ? '(Canvas)' : element instanceof HTMLVideoElement ? '(Video)' : '(Unknown)');

      if (hasSharedArrayBuffer && element instanceof HTMLCanvasElement) {
        // Use canvas rendering (preferred)
        console.log('🎥 Attempting canvas rendering...');
        await streamRef.current.startVideo();
        await streamRef.current.renderVideo(
          element,
          currentUser.userId,
          element.width,
          element.height,
          0,
          0,
          3 // Quality level (1-3)
        );
        console.log('✅ Canvas rendering successful');
      } else if (element instanceof HTMLVideoElement) {
        // Use video element (fallback)
        console.log('🎥 Using video element rendering...');
        await streamRef.current.startVideo({ videoElement: element });
        console.log('✅ Video element rendering successful');
      } else {
        // Try canvas anyway, but fallback to attachVideo on error
        console.log('🎥 Trying canvas without SharedArrayBuffer...');
        try {
          await streamRef.current.startVideo();
          if (element instanceof HTMLCanvasElement) {
            await streamRef.current.renderVideo(
              element,
              currentUser.userId,
              element.width,
              element.height,
              0,
              0,
              3
            );
          }
          console.log('✅ Canvas rendering successful (without SAB)');
        } catch (canvasErr) {
          console.warn('⚠️ Canvas rendering failed, trying attachVideo as fallback:', canvasErr);
          // Fallback to attachVideo (modern method for video elements)
          await streamRef.current.startVideo();
          // Note: attachVideo would need a video element, not canvas
          throw new Error('Canvas not supported. Please use a video element or enable SharedArrayBuffer.');
        }
      }

      setIsVideoOn(true);
      console.log('✅ Video started successfully');
      return true;
    } catch (err) {
      console.error('❌ Failed to start video:', err);
      console.error('Error details:', {
        message: err.message,
        type: err.type,
        reason: err.reason,
        code: err.code,
        errorCode: err.errorCode
      });
      setError(`Start video failed: ${err.message || err.reason || 'Unknown error'}`);
      return false;
    }
  }, [currentUser]);

  /**
   * Stop video (turn off camera)
   * @param {HTMLCanvasElement} canvas - The canvas element (for stopping render)
   */
  const stopVideo = useCallback(async (canvas) => {
    if (!streamRef.current) return;

    try {
      if (canvas && currentUser) {
        await streamRef.current.stopRenderVideo(canvas, currentUser.userId);
      }
      await streamRef.current.stopVideo();
      setIsVideoOn(false);
      console.log('Video stopped');
      return true;
    } catch (err) {
      console.error('Failed to stop video:', err);
      setError(`Stop video failed: ${err.message}`);
      return false;
    }
  }, [currentUser]);

  /**
   * Start audio (unmute microphone)
   */
  const startAudio = useCallback(async () => {
    if (!streamRef.current) {
      setError('Not connected to a session');
      return false;
    }

    try {
      await streamRef.current.startAudio();
      setIsAudioOn(true);
      console.log('Audio started');
      return true;
    } catch (err) {
      console.error('Failed to start audio:', err);
      setError(`Start audio failed: ${err.message}`);
      return false;
    }
  }, []);

  /**
   * Stop audio (mute microphone)
   */
  const stopAudio = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      await streamRef.current.stopAudio();
      setIsAudioOn(false);
      console.log('Audio stopped');
      return true;
    } catch (err) {
      console.error('Failed to stop audio:', err);
      setError(`Stop audio failed: ${err.message}`);
      return false;
    }
  }, []);

  /**
   * Toggle audio mute state
   */
  const toggleAudio = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      if (isAudioOn) {
        await streamRef.current.muteAudio();
      } else {
        await streamRef.current.unmuteAudio();
      }
      setIsAudioOn(!isAudioOn);
      return true;
    } catch (err) {
      console.error('Failed to toggle audio:', err);
      setError(`Toggle audio failed: ${err.message}`);
      return false;
    }
  }, [isAudioOn]);

  /**
   * Render a participant's video to a canvas
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @param {number} userId - The user ID to render
   */
  const renderParticipantVideo = useCallback(async (canvas, userId) => {
    if (!streamRef.current) return false;

    try {
      await streamRef.current.renderVideo(
        canvas,
        userId,
        canvas.width,
        canvas.height,
        0,
        0,
        2 // Quality level
      );
      return true;
    } catch (err) {
      console.error('Failed to render participant video:', err);
      return false;
    }
  }, []);

  /**
   * Stop rendering a participant's video
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @param {number} userId - The user ID to stop rendering
   */
  const stopRenderParticipantVideo = useCallback(async (canvas, userId) => {
    if (!streamRef.current) return false;

    try {
      await streamRef.current.stopRenderVideo(canvas, userId);
      return true;
    } catch (err) {
      console.error('Failed to stop render participant video:', err);
      return false;
    }
  }, []);

  /**
   * Start screen sharing
   * @param {HTMLVideoElement|HTMLCanvasElement} element - Video or canvas element for screen share
   * @param {boolean} isAutoRestart - Internal flag to indicate this is an auto-restart attempt
   */
  const startScreenShare = useCallback(async (element, isAutoRestart = false) => {
    if (!streamRef.current) {
      setError('Not connected to a session');
      return false;
    }

    try {
      const currentUser = clientRef.current.getCurrentUserInfo();

      // Check what element type the browser supports
      const useVideoElement = streamRef.current.isStartShareScreenWithVideoElement?.() ?? true;
      console.log(`🖥️ Browser supports video element for share: ${useVideoElement}`);

      // Validate element type
      if (useVideoElement) {
        if (!element || !(element instanceof HTMLVideoElement)) {
          console.error('Video element required but got:', element?.constructor?.name);
          setError('Video element required for screen sharing on this browser');
          return false;
        }
      } else {
        if (!element || !(element instanceof HTMLCanvasElement)) {
          console.error('Canvas element required but got:', element?.constructor?.name);
          setError('Canvas element required for screen sharing on this browser');
          return false;
        }
      }

      // Store reference for potential auto-restart
      shareVideoElementRef.current = element;

      console.log(`🖥️ Starting screen share with element type: ${element.constructor.name}${isAutoRestart ? ' (AUTO-RESTART)' : ''}`);

      // Start screen sharing with simultaneousShareView option
      // Per Zoom SDK docs: simultaneousShareView enables viewing multiple users' shares
      // Required when using setSharePrivilege(MultipleShare)
      await streamRef.current.startShareScreen(element, {
        simultaneousShareView: true
      });

      setIsScreenSharing(true);
      isScreenSharingRef.current = true;
      autoRestartShareRef.current = true; // Enable auto-restart for this share session
      console.log('✅ Screen sharing started successfully with simultaneousShareView');

      // Monitor the MediaStream tracks for the own share preview
      // This helps detect when tracks unexpectedly end (e.g., when another user starts sharing)
      if (element instanceof HTMLVideoElement && element.srcObject) {
        const mediaStream = element.srcObject;
        const tracks = mediaStream.getTracks();
        console.log(`🖥️ Monitoring ${tracks.length} MediaStream tracks for own share`);

        tracks.forEach((track, idx) => {
          console.log(`🖥️ Track ${idx}: kind=${track.kind}, readyState=${track.readyState}`);

          // Monitor track ended event
          track.addEventListener('ended', async () => {
            console.warn(`⚠️ Track ${idx} (${track.kind}) ENDED unexpectedly!`);

            // Check if all tracks have ended
            const allEnded = tracks.every(t => t.readyState === 'ended');
            if (allEnded && isScreenSharingRef.current) {
              console.warn('⚠️ All tracks ended while we were sharing');

              // Check if we should auto-restart
              if (autoRestartShareRef.current && shareVideoElementRef.current) {
                console.log('🔄 AUTO-RESTART: Attempting to restart screen share...');

                // Brief delay to let Zoom SDK stabilize
                await new Promise(resolve => setTimeout(resolve, 500));

                // First, clean up the old share state
                try {
                  await streamRef.current.stopShareScreen();
                } catch (stopErr) {
                  console.warn('🔄 Cleanup stopShareScreen (may already be stopped):', stopErr);
                }

                // Update state before restart
                setIsScreenSharing(false);
                isScreenSharingRef.current = false;
                setScreenShares(prev => prev.filter(s => s.userId !== currentUser.userId));

                // Wait a bit more before restart
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Note: Auto-restart requires user gesture in most browsers
                // We'll just notify the user instead of auto-restarting
                console.warn('⚠️ Screen share was stopped by the system (possibly due to SDK limitation).');
                console.warn('⚠️ Multiple simultaneous shares may not be fully supported in this SDK version.');
                setError('Screen share stopped. Click "Share Screen" to restart.');
                autoRestartShareRef.current = false;
              } else {
                setIsScreenSharing(false);
                isScreenSharingRef.current = false;
                setScreenShares(prev => prev.filter(s => s.userId !== currentUser.userId));
              }
            }
          });
        });
      }

      // Manually add current user to screenShares since events might not fire reliably
      setScreenShares(prev => {
        if (prev.find(s => s.userId === currentUser.userId)) {
          return prev;
        }
        console.log(`📌 Manually adding current user ${currentUser.userId} to screenShares`);
        return [...prev, {
          userId: currentUser.userId,
          displayName: currentUser.displayName || `User ${currentUser.userId}`,
          isCurrentUser: true
        }];
      });

      return true;
    } catch (err) {
      console.error('Failed to start screen share:', err);
      console.error('Error details:', {
        message: err.message,
        type: err.type,
        reason: err.reason,
        code: err.code
      });
      setError(`Start screen share failed: ${err.message || err.reason || 'Unknown error'}`);
      return false;
    }
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const currentUser = clientRef.current.getCurrentUserInfo();

      await streamRef.current.stopShareScreen();
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      console.log('✅ Screen sharing stopped');

      // Manually remove current user from screenShares
      if (currentUser) {
        console.log(`📌 Manually removing current user ${currentUser.userId} from screenShares`);
        setScreenShares(prev => prev.filter(s => s.userId !== currentUser.userId));
      }

      return true;
    } catch (err) {
      console.error('Failed to stop screen share:', err);
      setError(`Stop screen share failed: ${err.message}`);
      return false;
    }
  }, []);

  /**
   * Attach a screen share view for a specific user
   * @param {number} userId - The user ID whose screen share to render
   * @param {HTMLElement} container - The container element (should be video-player-container)
   * @returns {Promise<{success: boolean, element?: HTMLElement}>}
   */
  const attachScreenShareView = useCallback(async (userId, container) => {
    if (!streamRef.current) {
      console.error('Stream not available');
      return { success: false };
    }

    try {
      console.log(`📺 Calling stream.attachShareView(${userId})...`);

      // attachShareView returns a video-player element that must be placed in a video-player-container
      const videoPlayerElement = await streamRef.current.attachShareView(userId);

      console.log(`📺 attachShareView returned:`, videoPlayerElement);
      console.log(`📺 Element type:`, videoPlayerElement?.tagName);
      console.log(`📺 Element HTML:`, videoPlayerElement?.outerHTML?.substring(0, 200));

      if (videoPlayerElement && container) {
        // Append the video-player element to the container
        container.appendChild(videoPlayerElement);
        console.log(`✅ Attached screen share view for user ${userId}`);

        // The video-player is a custom element from Zoom SDK
        // It contains a shadow DOM with the actual video element
        // We need to ensure it's properly sized and visible

        // Set explicit dimensions on the video-player element
        videoPlayerElement.style.width = '100%';
        videoPlayerElement.style.height = '100%';
        videoPlayerElement.style.minHeight = '360px';
        videoPlayerElement.style.display = 'block';

        // Try to access the internal video element (may be in shadow DOM)
        const tryPlayVideo = async () => {
          // Method 1: Direct video element
          let videoEl = videoPlayerElement.querySelector('video');

          // Method 2: Shadow DOM
          if (!videoEl && videoPlayerElement.shadowRoot) {
            videoEl = videoPlayerElement.shadowRoot.querySelector('video');
          }

          // Method 3: Check if videoPlayerElement itself has video methods
          if (!videoEl && typeof videoPlayerElement.play === 'function') {
            try {
              await videoPlayerElement.play();
              console.log('📺 Called play() on video-player element');
            } catch (playErr) {
              console.warn('📺 play() on video-player failed:', playErr);
            }
          }

          if (videoEl) {
            console.log('📺 Found internal video element');
            console.log('📺 Video srcObject:', videoEl.srcObject);
            console.log('📺 Video readyState:', videoEl.readyState);
            console.log('📺 Video paused:', videoEl.paused);

            videoEl.setAttribute('autoplay', '');
            videoEl.setAttribute('playsinline', '');
            videoEl.muted = true; // Mute to allow autoplay

            try {
              await videoEl.play();
              console.log('📺 Video play() called successfully');
            } catch (playErr) {
              console.warn('📺 Auto-play may be blocked:', playErr);
            }
          } else {
            console.log('📺 No internal video element found (Zoom SDK handles playback)');
          }
        };

        // Try immediately and also after a short delay
        await tryPlayVideo();
        setTimeout(tryPlayVideo, 500);

        // Log container state
        console.log('📺 Container children count:', container.children.length);
        console.log('📺 Container innerHTML length:', container.innerHTML.length);

        return { success: true, element: videoPlayerElement };
      }

      console.warn(`📺 attachShareView returned falsy element or no container`);
      return { success: false };
    } catch (err) {
      console.error(`❌ Failed to attach screen share view for user ${userId}:`, err);
      console.error('Error details:', {
        message: err.message,
        type: err.type,
        reason: err.reason
      });
      return { success: false, error: err };
    }
  }, []);

  /**
   * Detach a screen share view for a specific user
   * IMPORTANT: detachShareView returns the element, which must be removed from DOM
   * @param {number} userId - The user ID whose screen share to stop rendering
   * @returns {Promise<HTMLElement|null>} The detached element (caller should remove from DOM)
   */
  const detachScreenShareView = useCallback(async (userId) => {
    if (!streamRef.current) return null;

    try {
      // Per Zoom SDK docs: detachShareView returns the element that was detached
      // The caller is responsible for removing it from the DOM
      const element = await streamRef.current.detachShareView(userId);
      console.log(`🔌 Detached screen share view for user ${userId}, element:`, element);
      return element;
    } catch (err) {
      console.error(`Failed to detach screen share view for user ${userId}:`, err);
      return null;
    }
  }, []);

  /**
   * Start cloud recording
   */
  const startRecording = useCallback(async () => {
    if (!recordingClientRef.current) {
      setError('Recording client not available');
      return false;
    }

    if (!clientRef.current) {
      setError('Client not initialized');
      return false;
    }

    try {
      // Get current user info to check if host
      const currentUserInfo = clientRef.current.getCurrentUserInfo();
      console.log('Current user info:', currentUserInfo);
      console.log('Is host?', currentUserInfo?.isHost);

      // Check if we can get recording status
      const canStartRecording = recordingClientRef.current.canStartRecording?.();
      console.log('Can start recording?', canStartRecording);

      console.log('Calling startCloudRecording()...');
      const result = await recordingClientRef.current.startCloudRecording();
      console.log('startCloudRecording() result:', result);

      // Check if recording actually started
      // The SDK should fire a recording-change event if successful
      console.log('Cloud recording command sent - waiting for recording-change event...');

      // Note: isRecording state will be updated by the 'recording-change' event
      return true;
    } catch (err) {
      console.error('Failed to start recording - Full error:', err);
      console.error('Error type:', err.type);
      console.error('Error reason:', err.reason);
      console.error('Error code:', err.errorCode);

      let errorMessage = 'Start recording failed: ';

      if (err.type === 'IMPROPER_MEETING_STATE') {
        errorMessage += 'Recording cannot be started. This usually means:\n';
        errorMessage += '1. ISO Video feature is NOT enabled on your Zoom account\n';
        errorMessage += '2. You need to contact Zoom Developer Support to enable it\n';
        errorMessage += '3. Or you are not the host of this session';
      } else if (err.reason) {
        errorMessage += err.reason;
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Unknown error';
      }

      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Stop cloud recording
   */
  const stopRecording = useCallback(async () => {
    if (!recordingClientRef.current) {
      setError('Recording client not available');
      return false;
    }

    try {
      await recordingClientRef.current.stopCloudRecording();
      console.log('Cloud recording stopped');
      // Note: isRecording state will be updated by the 'recording-change' event
      return true;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError(`Stop recording failed: ${err.message}`);
      return false;
    }
  }, []);

  /**
   * Leave the session
   */
  const leave = useCallback(async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.leave();
      }
    } catch (err) {
      console.error('Error leaving session:', err);
    } finally {
      streamRef.current = null;
      recordingClientRef.current = null;
      setStreamState(null);
      setStatus('disconnected');
      setParticipants([]);
      setCurrentUser(null);
      setSessionInfo(null);
      setIsVideoOn(false);
      setIsAudioOn(false);
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setScreenShares([]);
      setIsRecording(false);
      setMultipleSharesEnabled(null);
      setError(null);
    }
  }, []);

  /**
   * Clean up and destroy the client
   */
  const destroy = useCallback(async () => {
    await leave();
    if (clientRef.current) {
      clientRef.current = null;
    }
  }, [leave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  // Debug: Log screenShares changes
  useEffect(() => {
    console.log('📊 screenShares updated:', screenShares);
  }, [screenShares]);

  return {
    // State
    status,
    error,
    participants,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    screenShares, // Array of all active screen shares
    isRecording,
    currentUser,
    sessionInfo,
    multipleSharesEnabled, // null = unknown, true = enabled, false = disabled

    // Methods
    initialize,
    join,
    leave,
    destroy,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    attachScreenShareView,
    detachScreenShareView,
    startRecording,
    stopRecording,
    renderParticipantVideo,
    stopRenderParticipantVideo,

    // Refs (for advanced usage)
    client: clientRef.current,
    stream: streamState, // Use state for React reactivity
  };
}
