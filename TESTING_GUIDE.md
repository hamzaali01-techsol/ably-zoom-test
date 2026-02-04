# Testing Guide - Recording & Screen Sharing

This guide explains how to test the new Zoom Video SDK features added to the app.

## 🆕 New Features Added

### 1. **Cloud Recording** ⏺️
- Start/Stop cloud recording
- Visual recording indicator with pulsing animation
- Individual participant recording (ISO Video)
- Automatic event handling for recording status

### 2. **Screen Sharing** 🖥️
- Share your screen with other participants
- Browser-native screen picker
- Canvas-based rendering

### 3. **Enhanced Video Controls** 📹
- Updated UI with emoji icons
- Better button states and colors
- Real-time status tracking

## 🚀 How to Test Multiple Participants

### Method 1: Multiple Browser Tabs (Easiest)

1. **Start the dev server:**
   ```bash
   cd E:\PPE_Test\zoom-test
   npm run dev
   ```

2. **Open multiple tabs:**
   - Tab 1: http://localhost:5173 (Assessor/Host)
   - Tab 2: http://localhost:5173 (Student 1)
   - Tab 3: http://localhost:5173 (Student 2)

3. **Get JWT tokens for each participant:**

   **Tab 1 - Assessor:**
   - Go to "Video" tab
   - Click "Get Host Video Token"
   - Enter credentials and session ID
   - Copy the token

   **Tab 2 - Student 1:**
   - Use your backend to get a student token:
   ```bash
   curl -X POST https://localhost:7288/student-session/join \
     -H "Authorization: Bearer STUDENT1_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"sessionId": 123}'
   ```
   - Manually paste the `videoToken.token` in the Video tab

   **Tab 3 - Student 2:**
   - Same as Student 1, but with a different auth token

4. **Join the same session:**
   - All tabs must use the same topic name
   - Each tab should have a unique username
   - Click "Join Session" in each tab

5. **Test features:**
   - **Tab 1 (Assessor):** Click "Start Recording" (only hosts can start recording)
   - **All tabs:** Start video to see each other
   - **Any tab:** Click "Share Screen" to test screen sharing
   - **Tab 1:** Click "Stop Recording" when done

### Method 2: Incognito Windows

1. **Regular window:** Open http://localhost:5173
2. **Incognito window 1:** Press Ctrl+Shift+N (Chrome) or Ctrl+Shift+P (Firefox)
3. **Incognito window 2:** Open another incognito window
4. Follow the same steps as Method 1

### Method 3: Different Browsers

- **Chrome:** Host/Assessor
- **Firefox:** Student 1
- **Edge:** Student 2
- **Brave:** Student 3

### Method 4: Multiple Devices

- **Desktop:** Assessor
- **Laptop:** Student 1
- **Phone:** Student 2
- **Tablet:** Student 3

## 📝 Testing Checklist

### Recording Features

- [ ] **Start Recording (Host only)**
  - Click "Start Recording" button
  - Recording indicator appears with pulsing red dot
  - Console shows "Cloud recording started"

- [ ] **Stop Recording (Host only)**
  - Click "Stop Recording" button
  - Recording indicator disappears
  - Console shows "Cloud recording stopped"

- [ ] **Individual Participant Recording**
  - Join with multiple participants
  - Start recording
  - All participants with `CloudRecordingElection=1` are recorded separately
  - Check Zoom dashboard for individual recording files

### Screen Sharing Features

- [ ] **Start Screen Share**
  - Click "Share Screen" button
  - Browser prompts for screen selection
  - Select screen/window/tab to share
  - Other participants see the shared screen

- [ ] **Stop Screen Share**
  - Click "Stop Share" button
  - Screen sharing ends
  - Video feed resumes (if was active)

### Video & Audio Features

- [ ] **Start Video**
  - Click "Start Video"
  - Camera turns on
  - Video appears in canvas
  - Other participants see your video

- [ ] **Stop Video**
  - Click "Stop Video"
  - Camera turns off
  - Canvas shows placeholder

- [ ] **Mute/Unmute Audio**
  - Click "Unmute Audio"
  - Microphone activates
  - Click "Mute Audio"
  - Microphone mutes

### Multi-Participant Scenarios

- [ ] **2 Participants**
  - Both join same session
  - Both see each other in participant list
  - Both can see each other's video

- [ ] **3+ Participants**
  - All join same session
  - Remote videos grid shows all participants
  - Recording captures all participants individually

- [ ] **Host + Students**
  - Host starts recording
  - All students' videos are recorded
  - Host's video is also recorded
  - Recording indicator visible to all

- [ ] **Observers (Managers)**
  - Observer joins session
  - Observer can see all participants
  - Observer is NOT recorded (as expected)

## ⚙️ Configuration

### JWT Token Parameters

The backend automatically sets these parameters:

**For Hosts (Assessors):**
```json
{
  "cloud_recording_option": 1,      // Enable ISO Video
  "cloud_recording_election": 1,     // Record this host
  "role_type": 1                     // Host role
}
```

**For Students:**
```json
{
  "cloud_recording_election": 1,     // Record this student
  "role_type": 0                     // Participant role
}
```

**For Observers:**
```json
{
  "cloud_recording_option": 1,       // Enable ISO Video
  // No cloud_recording_election     // Don't record observer
  "role_type": 1                     // Host role
}
```

## 🐛 Troubleshooting

### "Failed to start recording"
**Cause:** ISO Video not enabled on Zoom account
**Solution:** Contact Zoom Developer Support to enable "ISO Video for V-SDK"

### "No video showing"
**Cause:** Camera permissions blocked
**Solution:** Allow camera access in browser settings

### "Screen share not working"
**Cause:** Browser doesn't support screen sharing
**Solution:** Use Chrome, Firefox, or Edge (latest versions)

### "Participants can't see each other"
**Cause:** Not using the same topic name
**Solution:** Ensure all participants use the same topic from the JWT token

### "Recording indicator not showing"
**Cause:** Recording event not received
**Solution:** Check browser console for errors, verify ISO Video is enabled

## 📊 Expected Behavior

### Recording Flow

1. **Host starts recording** → Recording indicator appears for all participants
2. **Backend events** → `recording-change` event with `action: "started"`
3. **Participants recorded** → All with `cloud_recording_election=1` are recorded
4. **Host stops recording** → Recording indicator disappears
5. **Files available** → Check Zoom dashboard for individual recording files

### Screen Sharing Flow

1. **User clicks "Share Screen"** → Browser prompts for screen selection
2. **User selects screen** → Screen sharing starts
3. **Other participants** → See shared screen in video canvas
4. **User stops sharing** → Video feed resumes

## 🎯 Test Scenarios

### Scenario 1: Basic Recording Test
1. Open 2 browser tabs
2. Join as Host in Tab 1
3. Join as Student in Tab 2
4. Host starts recording
5. Both start video
6. Wait 30 seconds
7. Host stops recording
8. Check Zoom dashboard for 2 separate recording files

### Scenario 2: Screen Share Test
1. Open 3 browser tabs
2. All join same session
3. All start video
4. Tab 1 starts screen sharing
5. Tab 2 and Tab 3 should see Tab 1's screen
6. Tab 1 stops screen sharing
7. All see each other's videos again

### Scenario 3: Full Feature Test
1. Open 3 browser tabs (1 Host, 2 Students)
2. All join same session
3. All start video and audio
4. Host starts recording
5. Student 1 starts screen sharing
6. Wait 1 minute
7. Student 1 stops screen sharing
8. Host stops recording
9. Verify 3 individual recordings in Zoom dashboard

## 📚 Resources

- [Zoom Video SDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- [Cloud Recording Guide](https://developers.zoom.us/docs/video-sdk/web/recording/)
- [Individual Recording (ISO Video)](https://developers.zoom.us/docs/video-sdk/auth/#payload)

## 🔗 Quick Links

**Backend Endpoints:**
- Student Join: `POST /student-session/join`
- Assessor Join: `POST /assessor-session/join`
- Get Host Token: `POST /room/get-host-video-token`
- Get Observer Tokens: `POST /room/get-room-observer-tokens`

**Frontend Routes:**
- Dev Server: http://localhost:5173
- Video Tab: http://localhost:5173 (then click "Video" tab)
