// Extracted type definitions from app/page.tsx
// Generated during refactoring - do not edit manually

export interface VocalCharacteristics {
  tone: string
  pace: string
  pitch: string
  volume: string
  confidence: number
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
}

export type GlobalSettings = {
  summary_service: string;
  tts_service: string;
  elevenlabs_voice_id?: string;
  google_lang?: string;
  google_gender?: string;
  hume_voice?: string;
};
