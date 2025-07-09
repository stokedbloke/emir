// API Route: Fetch available voices from ElevenLabs API
// Receives a GET request and returns a list of voices (id, name) for use in TTS.
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Returns: { voices: Array<{ voice_id: string, name: string }> } on success, or { voices: [] } on failure.
//
export async function GET() {
  try {
    // Use ElevenLabs API key (must be set in env)
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      // Return empty list if API key is missing
      return Response.json({ voices: [] })
    }

    // Fetch voices from ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": elevenlabsApiKey }
    })

    if (!response.ok) {
      // Log and return empty list on error
      throw new Error("Failed to fetch ElevenLabs voices")
    }

    // Return list of voices
    const data = await response.json()
    return Response.json({ voices: data.voices || [] })
  } catch (error) {
    // Catch-all error handler
    console.error("ElevenLabs voices fetch error:", error)
    return Response.json({ voices: [] })
  }
} 