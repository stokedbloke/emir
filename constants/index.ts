// Extracted constants from app/page.tsx
// Generated during refactoring - do not edit manually

export const API_ENDPOINTS = {
  STATUS: '/api/status',
  GLOBAL_SETTINGS: '/api/global-settings',
  REFLECTION: '/api/reflection',
  TRANSCRIBE: '/api/transcribe',
  SUMMARIZE: '/api/summarize',
  EMOTIONS_HYBRID: '/api/emotions-hybrid',
  VOICE_ELEVENLABS: '/api/voice/elevenlabs',
  VOICE_ELEVENLABS_VOICES: '/api/voice/elevenlabs/voices',
  VOICE_CLONE: '/api/voice-clone',
  VOICE_CLONE_IMPROVE: '/api/voice-clone/improve',
  VOICE_CLONE_DELETE: '/api/voice-clone/delete'
} as const;

export const AUDIO_CONSTANTS = {
  SAMPLE_RATE: 48000,
  MIME_TYPE: 'audio/webm;codecs=opus',
  MIME_TYPE_FALLBACK: 'audio/webm'
} as const;

export const UI_CONSTANTS = {
  BREATHING_CYCLE_MS: 3000,
  API_TIMEOUT_MS: 15000
} as const;

export const DEFAULT_VALUES = {
  ELEVENLABS_VOICE_ID: 'pNInz6obpgDQGcFmaJgB',
  USER_VOICE_CLONE_PREFIX: 'em-voice-clone-',
  ADMIN_SECRET_KEY: 'admin-secret'
} as const;

export const SPEECH_TRIGGERS = [
  "i am complete",
  "i'm complete"
] as const;
