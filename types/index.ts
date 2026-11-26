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
  transcription?: TranscriptionInfo
  }

// How a recording was turned into words. "server" is Gemini transcribing the
// recording, "browser" is the browser's live speech recognition, "backup" is
// Google Speech-to-Text (used only when both of the others gave nothing).
export interface TranscriptionInfo {
  // "mixed": recorded in pieces, some transcribed by the server and some
  // filled in from the browser.
  source: "server" | "browser" | "backup" | "mixed"
  server_ms: number
  server_words: number
  browser_words: number
  // Why the server transcript was not available: too_large, timeout, network, http_<status>.
  server_problem?: string
  // For a recording made in pieces: how many, and how many of them used the
  // browser's words because the server's were missing or too few.
  pieces?: number
  pieces_from_browser?: number
  // The transcript that was not used, kept so the two can be compared.
  other_transcript?: string
}

export type GlobalSettings = {
  summary_service: string;
  tts_service: string;
  elevenlabs_voice_id?: string;
  google_lang?: string;
  google_gender?: string;
  hume_voice?: string;
};
