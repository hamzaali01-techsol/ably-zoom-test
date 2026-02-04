# Quick Start - Testing Recording with Multiple Participants

## 🚀 Setup (5 minutes)

### 1. Start Backend
```bash
cd E:\PPE_2\PPE
dotnet run
```
Backend will run at: https://localhost:7288

### 2. Start Frontend
```bash
cd E:\PPE_Test\zoom-test
npm run dev
```
Frontend will run at: http://localhost:5173

---

## 🎬 Test Recording (3 Participants)

### Step 1: Open 3 Browser Tabs
Open http://localhost:5173 in **3 separate tabs**

---

### Step 2: Tab 1 - Assessor (Host)

1. Go to **"Video"** tab
2. Click **"Join session as assessor"** endpoint
3. Fill in:
   - **Auth Token:** Your assessor auth token
   - **sessionId:** `123` (or your test session ID)
4. Click **"Call API"**
5. Wait for response with `videoToken`
6. Scroll down to **"Session Settings"**
7. Enter **Display Name:** `Assessor Host`
8. Click **"Join Session"**
9. Wait for "Connected" status
10. Click **"📹 Start Video"**
11. Click **"🎤 Unmute Audio"**
12. **✅ You can now start recording!** Click **"⏺️ Start Recording"**

---

### Step 3: Tab 2 - Student 1

1. Go to **"Video"** tab
2. Click **"Join session as student"** endpoint
3. Fill in:
   - **Auth Token:** Your student 1 auth token
   - **sessionId:** `123` (same as assessor)
4. Click **"Call API"**
5. Wait for response with `videoToken`
6. Enter **Display Name:** `Student One`
7. Click **"Join Session"**
8. Wait for "Connected" status
9. Click **"📹 Start Video"**
10. Click **"🎤 Unmute Audio"**

---

### Step 4: Tab 3 - Student 2

1. Go to **"Video"** tab
2. Click **"Join session as student"** endpoint
3. Fill in:
   - **Auth Token:** Your student 2 auth token
   - **sessionId:** `123` (same as others)
4. Click **"Call API"**
5. Wait for response with `videoToken`
6. Enter **Display Name:** `Student Two`
7. Click **"Join Session"**
8. Wait for "Connected" status
9. Click **"📹 Start Video"**
10. Click **"🎤 Unmute Audio"**

---

### Step 5: Verify Recording

**In Tab 1 (Assessor):**
- ✅ Recording indicator should show red pulsing dot
- ✅ "RECORDING IN PROGRESS" message visible

**In All Tabs:**
- ✅ All see each other's videos in "Remote Participants" section
- ✅ All see recording indicator
- ✅ Participant count shows "3"

---

### Step 6: Stop Recording

**In Tab 1 (Assessor):**
1. Click **"⏹️ Stop Recording"**
2. Recording indicator disappears from all tabs

---

### Step 7: Check Recordings

1. Log into Zoom Video SDK dashboard
2. Navigate to **Cloud Recordings**
3. Find your session recordings
4. **Verify:** 3 separate recording files (one for each participant)

---

## 🎥 Test Screen Sharing

**In any tab:**
1. Click **"🖥️ Share Screen"**
2. Browser prompts for screen selection
3. Select screen/window/tab to share
4. **Other tabs:** See shared screen in video area
5. Click **"🖥️ Stop Share"** to end sharing

---

## 🆘 Troubleshooting

### ❌ "Failed to start recording"
**Cause:** ISO Video not enabled on Zoom account
**Fix:** Contact Zoom Developer Support → Request "Enable ISO Video for V-SDK"

### ❌ "Invalid token" error when joining
**Cause:** JWT token expired or wrong topic
**Fix:**
1. Generate new token
2. Verify all participants use same topic name
3. Check token expiration time

### ❌ Can't see other participants' videos
**Cause:** Different topic names
**Fix:** Ensure all tabs use tokens from same session ID

### ❌ Manager can't start recording
**Cause:** Need to use observer token endpoint
**Fix:**
1. In Video tab, use "Get Observer Tokens" endpoint
2. Provide sessionInstanceId and roomId
3. Join as observer/manager

### ❌ Video not showing
**Cause:** Browser camera permissions blocked
**Fix:**
1. Check browser settings
2. Allow camera access
3. Refresh page

---

## 💡 Tips

### Multiple Tabs Testing
- Use **Incognito mode** to avoid session conflicts
- Use **different browsers** (Chrome, Firefox, Edge) for each participant
- **Mute audio** in tabs to avoid echo feedback

### Token Management
- Tokens expire after 24 hours by default
- Generate new tokens if expired
- Keep auth tokens secure

### Topic Names
- Topic format: `{tenantId}:{sessionInstanceId}:video:{roomId}`
- **All participants MUST use exact same topic**
- Topic comes from `videoToken.topicName` in API response

### Recording Files
- Individual recordings appear in Zoom dashboard
- Processing time: ~5-10 minutes after recording stops
- Files include video + audio for each participant

---

## 📋 Quick Commands Reference

### Get Assessor Token
```bash
curl -X POST https://localhost:7288/assessor-session/123/join \
  -H "Authorization: Bearer YOUR_ASSESSOR_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Student Token
```bash
curl -X POST https://localhost:7288/student-session/123/join \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Observer Token (Manager)
```bash
curl -X GET "https://localhost:7288/session-instance/456/room/789/observer-tokens" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN"
```

---

## ✅ Expected Results

After following this guide, you should have:
- ✅ 3 participants in same video session
- ✅ All videos visible to each other
- ✅ Recording started and stopped successfully
- ✅ 3 individual recording files in Zoom dashboard
- ✅ Screen sharing tested and working

---

## 🔗 Additional Resources

- **Full Testing Guide:** See `TESTING_GUIDE.md`
- **Technical Details:** See `CHANGELOG.md`
- **Backend Changes:** See `E:\PPE_2\PPE\RECORDING_UPDATES.md`
- **Zoom Docs:** https://developers.zoom.us/docs/video-sdk/

---

## ⚠️ Important Reminder

**Before Production:**
Revert the temporary manager recording change in:
`E:\PPE_2\PPE\Features\Room\GetRoomObserverTokens\Handler.cs`

Remove line:
```csharp
CloudRecordingElection = 1 // TEMPORARY
```

This ensures observers/managers are NOT recorded in production.
