// Extracted type definitions from app/page.tsx
// Generated during refactoring - do not edit manually

// Measured delivery stats. Reflections saved before these were measured only
// carry the old estimated labels (tone, pitch, volume), which are no longer shown.
export interface VocalCharacteristics {
  pace?: string
  wordsPerMinute?: number
  // Share of the recording (0-1) spent in pauses of half a second or longer.
  pauseRatio?: number
  longestPauseSeconds?: number
  tone?: string
  pitch?: string
  volume?: string
  confidence?: number
}

export interface EmotionAnalysis {
  emotion: string
  confidence: number
  sources?: string[] // Optional for backward compatibility
}

export interface SessionData {
  id: string
  timestamp: Date
  transcript: string
  summary: string
  emotions: EmotionAnalysis[]
  vocalCharacteristics: VocalCharacteristics
  audioBlob?: Blob
  recordingDuration?: number
  threadId?: string
  parentSessionId?: string
  }

export type GlobalSettings = {
  summary_service: string;
  tts_service: string;
  elevenlabs_voice_id?: string;
  google_lang?: string;
  google_gender?: string;
  hume_voice?: string;
};
