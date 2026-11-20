// Extracted type definitions from app/page.tsx
// Generated during refactoring - do not edit manually

// Delivery stats measured from the recording. tone, pitch and volume hold a
// short label; the numbers they are derived from sit beside them. Reflections
// saved before the numbers existed carry only the old estimated labels, which
// are not shown.
export interface VocalCharacteristics {
  pace?: string
  wordsPerMinute?: number
  // Share of the recording (0-1) spent in pauses of half a second or longer.
  pauseRatio?: number
  longestPauseSeconds?: number
  tone?: string
  // Zero crossings per second while speaking: a rough stand-in for brightness.
  brightnessHz?: number
  pitch?: string
  // Typical (median) voice pitch and how far it moves, in semitones.
  pitchHz?: number
  pitchVariationSemitones?: number
  volume?: string
  // Average speaking level relative to the loudest the recording format allows (0 dB).
  levelDb?: number
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
