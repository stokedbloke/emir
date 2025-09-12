# BEHAVIOR BASELINE DOCUMENTATION

This document captures the exact behavior of the application before refactoring. Any changes to this behavior during refactoring will be considered regressions.

## 🎯 **CORE USER FLOWS**

### **Flow 1: Initial App Load**
1. **URL**: `http://localhost:3000`
2. **Expected Behavior**:
   - Shows "Preparing your space..." loading screen
   - Purple gradient background with animated pulse
   - Loading animation with ping effect
   - No user interaction possible during this state

### **Flow 2: Permission Request**
1. **Trigger**: After initial load completes
2. **Expected Behavior**:
   - Shows permission request screen
   - "Emotional Mirror" branding with logo
   - "Begin Your Journey" button
   - Privacy assurance message
   - Gradient background maintained

### **Flow 3: Recording Session**
1. **Trigger**: Click "Begin Your Journey" → Grant microphone permission
2. **Expected Behavior**:
   - Shows main recording interface
   - Large circular microphone button (purple gradient)
   - "Ready to listen to your voice" text
   - Gentle guidance box with tips
   - Header with branding and status badges

### **Flow 4: Active Recording**
1. **Trigger**: Click microphone button
2. **Expected Behavior**:
   - Button changes to red gradient with breathing animation
   - Timer appears inside button (MM:SS format)
   - "I'm here, actively listening..." text
   - Breathing ring animation around button
   - Speech recognition starts automatically

### **Flow 5: Recording Completion**
1. **Trigger**: Say "I'm complete" or click button again
2. **Expected Behavior**:
   - Recording stops immediately
   - Processing screen appears with progress bar
   - Stages: "Transcribing..." → "Generating summary..." → "Ready!"
   - Animated dots during processing
   - Progress bar fills from 0% to 100%

### **Flow 6: Summary Display**
1. **Trigger**: Processing completes
2. **Expected Behavior**:
   - Automatically switches to Summary tab
   - Shows reflection in blockquote format
   - "Listen" button with volume icon
   - "Clone Voice" button (blue)
   - TTS service badge showing actual service used
   - Auto-plays summary audio

### **Flow 7: Voice Cloning**
1. **Trigger**: Click "Clone Voice" button
2. **Expected Behavior**:
   - Button shows "Cloning..." with spinner
   - Toast notification: "Starting voice clone..."
   - Success toast: "Voice clone created! 🎉"
   - Button changes to "Replace Voice Clone" (green)
   - "Delete Clone" button appears (red)

### **Flow 8: Analysis Tab**
1. **Trigger**: Click "Analysis" tab
2. **Expected Behavior**:
   - Shows emotion analysis cards with confidence bars
   - Source badges (Hybrid, Text, Audio)
   - Vocal characteristics display (Tone, Pace, Pitch, Volume)
   - Tooltips on hover for explanations

### **Flow 9: History Tab**
1. **Trigger**: Click "History" tab (if sessions exist)
2. **Expected Behavior**:
   - Shows list of previous sessions
   - Each session shows transcript, summary, emotions
   - Click to select and view details
   - Word count and duration information

## 🎨 **UI/UX SPECIFICATIONS**

### **Color Scheme**
- **Background**: `bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100`
- **Primary Button**: `bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600`
- **Recording Button**: `bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600`
- **Text**: `text-gray-800` (headings), `text-gray-600` (body)

### **Animations**
- **Loading Pulse**: `animate-pulse` on purple circle
- **Loading Ping**: `animate-ping opacity-20` on outer ring
- **Breathing**: 3-second cycle between `scale-110` and `scale-125`
- **Processing Dots**: `animate-bounce` with staggered delays

### **Typography**
- **Main Heading**: `text-3xl font-bold`
- **Subheading**: `text-2xl font-bold`
- **Body Text**: `text-lg leading-relaxed`
- **Button Text**: `font-medium`

### **Spacing**
- **Main Container**: `space-y-12`
- **Card Padding**: `p-16` (recording), `p-12` (summary), `p-8` (others)
- **Button Size**: `w-40 h-40` (mic button), `px-6 py-3` (others)

## 🔧 **FUNCTIONAL SPECIFICATIONS**

### **Audio Processing**
- **Format**: WebM with Opus codec
- **Sample Rate**: 48kHz
- **Features**: Echo cancellation, noise suppression
- **Fallback**: Browser speech recognition if Google STT fails

### **TTS Priority**
1. User's voice clone (if available)
2. ElevenLabs default voice
3. Browser speech synthesis

### **Error Handling**
- **Microphone Denied**: Shows error message, retry button
- **Transcription Failed**: Falls back to browser recognition
- **TTS Failed**: Falls back to browser TTS
- **Network Error**: Shows toast notification

### **State Management**
- **Permission State**: `null` → `false` → `true`
- **Recording State**: `false` → `true` → `false`
- **Processing State**: `false` → `true` → `false`
- **Speaking State**: `false` → `true` → `false`

## 📱 **Responsive Behavior**
- **Desktop**: Full interface with all features
- **Mobile**: Same interface, touch-optimized buttons
- **Tablet**: Same as desktop

## ⚡ **Performance Expectations**
- **Initial Load**: < 5 seconds
- **Recording Start**: < 1 second
- **Processing**: < 10 seconds for typical 30-second recording
- **TTS Generation**: < 3 seconds

## 🧪 **Test Scenarios**

### **Happy Path**
1. Load app → Grant permission → Record → Complete → View summary → Listen → View analysis → Check history

### **Edge Cases**
1. Deny microphone permission
2. Network disconnection during processing
3. Very short recording (< 2 seconds)
4. Very long recording (> 5 minutes)
5. Multiple rapid recordings
6. Voice clone creation failure
7. TTS service unavailable

### **Error Scenarios**
1. Microphone access denied
2. Speech recognition fails
3. Transcription service down
4. Summary generation fails
5. Emotion analysis fails
6. TTS service fails

## 📊 **Success Criteria**
- ✅ All user flows work identically
- ✅ UI looks exactly the same
- ✅ Performance is maintained or improved
- ✅ No new errors or warnings
- ✅ All existing functionality preserved
- ✅ No breaking changes to API contracts
