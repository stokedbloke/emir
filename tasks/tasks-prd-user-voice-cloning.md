## Relevant Files

- `app/components/VoiceCloneOptIn.tsx` - UI for opt-in, consent, and progress bar.
- `app/components/VoiceRecorder.tsx` - Handles audio recording and progress tracking.
- `app/api/voice-clone/route.ts` - API route for handling ElevenLabs voice clone creation and status.
- `app/api/voice-clone/delete.ts` - API route for deleting user voice clone and data.
- `app/api/voice/tts.ts` - API route for TTS playback using cloned or default voice.
- `app/components/FeedbackRating.tsx` - UI for 1–3 rating feedback below summary.
- `app/api/feedback/route.ts` - API route for storing feedback in Supabase.
- `app/components/PrivacyModal.tsx` - Modal or popup for privacy/data usage info.
- `lib/supabase/voiceClone.ts` - Supabase helpers for storing clone status, progress, and feedback.
- `lib/elevenlabs/client.ts` - Helper for ElevenLabs API integration.
- `app/components/__tests__/VoiceCloneOptIn.test.tsx` - Unit tests for opt-in UI.
- `app/components/__tests__/VoiceRecorder.test.tsx` - Unit tests for recording logic.
- `app/components/__tests__/FeedbackRating.test.tsx` - Unit tests for feedback UI.
- `app/api/voice-clone/__tests__/route.test.ts` - API tests for voice clone creation/deletion.
- `app/api/feedback/__tests__/route.test.ts` - API tests for feedback storage.

### Notes
- All API keys and sensitive logic must remain server-side.
- Use environment variables for ElevenLabs API keys.
- Unit tests should be placed alongside the code files they are testing.

## Tasks

- [ ] 1.0 Voice Cloning Opt-In & Consent Flow
  - [ ] 1.1 Create UI for opt-in with clear consent and privacy messaging (`VoiceCloneOptIn.tsx`).
  - [ ] 1.2 Add logic to store user opt-in status in Supabase.
  - [ ] 1.3 Implement modal or popup for privacy/data usage info (`PrivacyModal.tsx`).
  - [ ] 1.4 Add ability for user to opt out and delete their voice clone.

- [ ] 2.0 Audio Recording & Progress Tracking
  - [ ] 2.1 Build audio recorder component for in-app recording (`VoiceRecorder.tsx`).
  - [ ] 2.2 Show progress bar/percentage for voice clone readiness.
  - [ ] 2.3 Enforce minimum audio length (per ElevenLabs requirements).
  - [ ] 2.4 Allow user to restart/retry the recording process.
  - [ ] 2.5 Store audio samples and progress in Supabase.

- [ ] 3.0 Integration with ElevenLabs API for Voice Cloning & TTS
  - [ ] 3.1 Implement backend API route to upload audio and request voice clone (`voice-clone/route.ts`).
  - [ ] 3.2 Poll ElevenLabs for clone status and update progress.
  - [ ] 3.3 Store clone status and voice ID in Supabase.
  - [ ] 3.4 Implement API route for deleting user voice clone from ElevenLabs and Supabase (`voice-clone/delete.ts`).
  - [ ] 3.5 Add error handling and fallback logic for API failures.

- [ ] 4.0 Personalized TTS Playback & Fallback Logic
  - [ ] 4.1 Update TTS API route to use cloned voice if available, else use global/default voice (`voice/tts.ts`).
  - [ ] 4.2 Update frontend to use personalized TTS for opted-in users.
  - [ ] 4.3 Add fallback to default TTS if clone is unavailable or deleted.
  - [ ] 4.4 Notify user if provider fails and revert to default settings.

- [ ] 5.0 User Feedback Collection & Storage
  - [ ] 5.1 Add 1–3 rating UI below summary for summary accuracy and voice pleasantness (`FeedbackRating.tsx`).
  - [ ] 5.2 Store feedback ratings in Supabase, tied to user/session and reflection (`feedback/route.ts`).
  - [ ] 5.3 Allow users to skip feedback (not required).
  - [ ] 5.4 Display average feedback (optional, for admin/analytics).

- [ ] 6.0 Privacy, Data Deletion, and Transparency UI
  - [ ] 6.1 Implement privacy/data usage modal or popup (`PrivacyModal.tsx`).
  - [ ] 6.2 Add clear UI for deleting voice clone and all associated data.
  - [ ] 6.3 Ensure all deletion actions are confirmed and irreversible.
  - [ ] 6.4 Document privacy/data retention policies in the UI. 