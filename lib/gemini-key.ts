// The key used for Gemini (summaries and emotion analysis).
//
// GOOGLE_API_KEY_2, when set, takes over the Gemini calls. GOOGLE_API_KEY stays
// in use for Google Speech-to-Text and Text-to-Speech, which need those APIs
// enabled on the key's project and so cannot simply move to another key.
export function geminiApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY_2 || process.env.GOOGLE_API_KEY || undefined;
}
