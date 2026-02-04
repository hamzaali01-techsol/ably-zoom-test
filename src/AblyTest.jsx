// import React, { useState, useRef } from 'react';
// import * as Ably from 'ably';

// /**
//  * A tester for Ably Token Requests.
//  * Works with the updated backend that returns properly formatted JSON tokens.
//  */
// function AblyTest() {
//   const [tokenInput, setTokenInput] = useState('');
//   const [isConnected, setIsConnected] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [connectionStatus, setConnectionStatus] = useState('Disconnected');
//   const [channelName, setChannelName] = useState('');
//   const [presenceStatus, setPresenceStatus] = useState('Not entered');
//   const ablyClient = useRef(null);
//   const channel = useRef(null);

//   const connectToAbly = async () => {
//     try {
//       setConnectionStatus('Processing Token...');

//       // Parse the backend response
//       const response = JSON.parse(tokenInput.trim());

//       // Extract the token data from the response
//       // The backend now returns properly structured JSON - no double-parsing needed!
//       const tokenData = response.messagingTokenRequest.tokenData;

//       // Validation: Ensure we have a valid TokenRequest object
//       if (!tokenData.keyName || !tokenData.mac) {
//         throw new Error("Invalid format: Missing 'keyName' or 'mac'. Ensure you are pasting the correct JSON.");
//       }

//       console.log('Token Object for Ably:', tokenData);

//       // Extract Channel Name from Capability
//       // The capability field is a string that needs to be parsed
//       const capabilityObj = typeof tokenData.capability === 'string'
//         ? JSON.parse(tokenData.capability)
//         : tokenData.capability;

//       // Find the session channel for presence (it has "presence" capability)
//       // Session channel format: "session.{sessionInstanceId}"
//       const allChannels = Object.keys(capabilityObj);
//       const sessionChannel = allChannels.find(ch => ch.startsWith('session.')) || allChannels[0];
//       const firstChannel = allChannels[0] || 'test-channel';

//       console.log('Available channels:', allChannels);
//       console.log('Session channel for presence:', sessionChannel);

//       setChannelName(firstChannel);

//       // Initialize Ably
//       setConnectionStatus('Connecting to Ably...');

//       ablyClient.current = new Ably.Realtime({
//         authCallback: (tokenParams, callback) => {
//           // Pass the token data directly to Ably
//           callback(null, tokenData);
//         },
//         clientId: tokenData.clientId || 'anonymous'
//       });

//       // Connection Event Listeners
//       ablyClient.current.connection.on((stateChange) => {
//         setConnectionStatus(stateChange.current);
//         console.log('Ably Connection State:', stateChange.current);

//         if (stateChange.current === 'connected') {
//           setIsConnected(true);
//           // Extract presence data from the API response
//           const presenceData = {
//             joinedParticipantId: response.joinedParticipantId || 'test-participant',
//             odooUserId: tokenData.clientId || 'test-user',
//             role: response.role || 'student'
//           };
//           // Enter presence on SESSION channel (for disconnect tracking)
//           // Subscribe to messages on the first channel
//           subscribeAndEnterPresence(firstChannel, sessionChannel, presenceData, setPresenceStatus);
//         } else if (stateChange.current === 'failed' || stateChange.current === 'disconnected') {
//           setIsConnected(false);
//         }
//       });

//     } catch (error) {
//       console.error('Connection Error:', error);
//       setConnectionStatus('Error: ' + error.message);
//       alert('Error parsing or connecting: ' + error.message);
//     }
//   };

// const subscribeAndEnterPresence = async (subscribeChannel, presenceChannel, presenceData, setPresenceStatus) => {
//   try {
//     // Subscribe to the first channel for messages
//     channel.current = ablyClient.current.channels.get(subscribeChannel);

//     channel.current.subscribe('student.ended_exam', (message) => {
//       const newMessage = {
//         timestamp: new Date().toLocaleTimeString(),
//         name: message.name,
//         data: typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : message.data,
//         id: message.id
//       };
//       setMessages(prev => [newMessage, ...prev]);
//     });

//     console.log(`Subscribed to: ${subscribeChannel}`);

//     // Enter presence on the SESSION channel (for disconnect tracking)
//     const sessionChannelRef = ablyClient.current.channels.get(presenceChannel);
//     console.log('Attempting to enter presence on session channel:', presenceChannel);
//     console.log('Presence data:', presenceData);
//     setPresenceStatus('Entering...');

//     try {
//       await sessionChannelRef.presence.enter({
//         joinedParticipantId: presenceData.joinedParticipantId,
//         odooUserId: presenceData.odooUserId,
//         role: presenceData.role,
//         tenantId: 1
//       });
//       console.log('Successfully entered presence on channel:', presenceChannel);
//       setPresenceStatus('Entered on ' + presenceChannel);
//     } catch (presenceError) {
//       console.error('Failed to enter presence:', presenceError);
//       setPresenceStatus('Failed: ' + presenceError.message);
//     }
//   } catch (error) {
//     console.error('Subscription Error:', error);
//   }
// };


//   const disconnect = () => {
//     if (ablyClient.current) {
//       ablyClient.current.close();
//       ablyClient.current = null;
//       channel.current = null;
//       setIsConnected(false);
//       setConnectionStatus('Disconnected');
//       setMessages([]);
//     }
//   };

//   return (
//     <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
//       <header style={{ borderBottom: '2px solid #eee', marginBottom: '20px' }}>
//         <h1>Ably Token Debugger</h1>
//         <p style={{ color: '#666' }}>Paste the complete JoinSession response JSON below to test the connection.</p>
//       </header>

//       {!isConnected ? (
//         <section>
//           <textarea
//             value={tokenInput}
//             onChange={(e) => setTokenInput(e.target.value)}
//             placeholder='Paste the complete JoinSession response JSON here (must include messagingTokenRequest field)...'
//             style={{
//               width: '100%',
//               minHeight: '200px',
//               padding: '12px',
//               fontFamily: 'monospace',
//               fontSize: '13px',
//               borderRadius: '8px',
//               border: '1px solid #ccc',
//               backgroundColor: '#fafafa'
//             }}
//           />
//           <div style={{ marginTop: '15px' }}>
//             <button
//               onClick={connectToAbly}
//               disabled={!tokenInput.trim()}
//               style={{
//                 padding: '12px 24px',
//                 backgroundColor: '#007bff',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '6px',
//                 cursor: 'pointer',
//                 fontWeight: 'bold'
//               }}
//             >
//               Connect to Ably
//             </button>
//             <span style={{ marginLeft: '15px', color: '#888' }}>Status: <strong>{connectionStatus}</strong></span>
//           </div>
//         </section>
//       ) : (
//         <section>
//           <div style={{ padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px', marginBottom: '20px' }}>
//             <p>✅ <strong>Connected</strong></p>
//             <p>Active Channel: <code>{channelName}</code></p>
//             <p>Presence Status: <strong style={{ color: presenceStatus === 'Entered' ? 'green' : presenceStatus.startsWith('Failed') ? 'red' : 'orange' }}>{presenceStatus}</strong></p>
//             <button onClick={disconnect} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
//               Disconnect
//             </button>
//           </div>

//           <h3>Messages</h3>
//           <div style={{ border: '1px solid #ddd', borderRadius: '8px', height: '400px', overflowY: 'auto', padding: '10px', backgroundColor: '#fff' }}>
//             {messages.length === 0 ? (
//               <p style={{ color: '#999', textAlign: 'center', marginTop: '50px' }}>Listening for messages on {channelName}...</p>
//             ) : (
//               messages.map((m, i) => (
//                 <div key={i} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
//                   <small style={{ color: '#888' }}>[{m.timestamp}]</small> <strong>{m.name || 'Event'}</strong>
//                   <pre style={{ backgroundColor: '#f4f4f4', padding: '8px', borderRadius: '4px', marginTop: '5px', overflowX: 'auto' }}>{m.data}</pre>
//                 </div>
//               ))
//             )}
//           </div>
//         </section>
//       )}
//     </div>
//   );
// }

// export default AblyTest;