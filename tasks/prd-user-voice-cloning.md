# User Voice Cloning for Personalized TTS

## Introduction/Overview
This feature enables users to opt in to a personalized text-to-speech (TTS) experience by cloning their own voice. Once a user has provided enough audio samples, the app will use their cloned voice to read back summaries and other TTS content. The process is transparent, privacy-focused, and includes a simple feedback mechanism for users to rate the accuracy and pleasantness of the TTS output. For the MVP, the ElevenLabs API will be used for voice cloning and TTS.

## Goals
- Allow users to opt in and record audio to create a personalized voice clone.
- Use the cloned voice for all TTS playback for that user (summaries, etc.) until they opt out.
- Provide clear progress feedback on voice clone readiness.
- Allow users to delete their voice clone and associated data at any time.
- Collect user feedback on TTS accuracy and voice pleasantness.
- Ensure privacy and transparency throughout the process.

## User Stories
- As a user, I want to opt in to voice cloning with clear consent, so I can hear summaries in my own voice.
- As a user, I want to see my progress toward a functional voice clone, so I know how much more audio is needed.
- As a user, I want to retry or restart the voice cloning process if I’m unsatisfied with the result.
- As a user, I want to delete my voice clone and all related data at any time.
- As a user, I want to quickly rate the summary and voice quality after playback, so the app can improve.
- As a user, I want to know how my voice data is used, stored, and deleted.

## Functional Requirements
1. The system must allow users to opt in to voice cloning with clear consent and privacy messaging.
2. The system must allow users to record audio samples directly in the app (minimum: 10 seconds, recommended: 30–60 seconds, per ElevenLabs docs).
3. The system must show a progress bar or percentage indicating how much more audio is needed for a functional clone.
4. The system must allow users to restart or retry the voice cloning process if unsatisfied.
5. The system must use the cloned voice for all TTS playback for that user once ready, until they opt out.
6. The system must allow users to delete their voice clone and all associated data at any time, with clear confirmation.
7. The system must provide a fallback to the global/default TTS voice if the clone is unavailable or deleted.
8. The system must display a 1–3 rating UI below each summary for users to rate (a) summary accuracy and (b) voice pleasantness. Ratings are optional and can be skipped.
9. The system must store feedback ratings in Supabase, tied to the user/session and reflection.
10. The system must provide clear, accessible information (e.g., popup or modal) about how voice data is used, stored, and deleted.
11. The system must handle provider/API failures gracefully, notify the user, and revert to default TTS if needed.

## Non-Goals (Out of Scope)
- Supporting multiple voice clones per user (only one active at a time).
- Allowing users to upload pre-recorded audio files (MVP: in-app recording only).
- Real-time voice cloning (some processing delay is acceptable).
- On-prem or open-source voice cloning for MVP (future consideration).

## Design Considerations
- Progress bar for voice clone readiness should be compact and non-intrusive (e.g., percentage or thin bar).
- Feedback UI should use simple stars or rounded numbers (1–3), with clear tooltips or minimal copy.
- Consent and privacy info should be accessible via a modal or popup, not blocking the main UI.
- Deletion of voice clone should require confirmation and explain consequences.

## Technical Considerations
- Use ElevenLabs API for voice cloning and TTS (see their docs for audio requirements and endpoints).
- Store user voice clone status, progress, and feedback in Supabase.
- Ensure all API keys and sensitive data are kept server-side.
- Provide a fallback to global TTS settings if the clone is unavailable or deleted.
- Plan for future support of open-source/self-hosted models if privacy/cost becomes a concern.

## Success Metrics
- % of users who successfully create a voice clone.
- Average user rating for summary accuracy and voice pleasantness.
- % of users who opt out or delete their voice clone.
- Number of provider/API failures and successful fallbacks.

## Open Questions
- Should we allow users to upload audio files in the future?
- What is the ideal minimum audio length for best results with ElevenLabs (verify in their docs)?
- Should we support scripted readouts to improve clone quality?
- How should we handle users who want to update their clone with new audio?
- What is the best way to communicate privacy and data retention policies? 