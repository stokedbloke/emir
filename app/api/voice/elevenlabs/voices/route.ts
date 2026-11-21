// API Route: Fetch the shared ElevenLabs voices available to every user.
// Receives a GET request and returns a list of voices for use in TTS.
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Only the admin (x-admin-secret header) gets the account's voice list. Visitors
// get an empty list: they can use the stock voice and their own clone, whose ID
// is kept in their browser, so there is nothing to list for them.
//
// Returns: { voices: Array<{ voice_id: string, name: string, category: string }> } on success, or { voices: [] } on failure.
//
import { isAdminRequest, type ElevenLabsVoice } from '@/lib/voice-ownership';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ voices: [] })
  }

  try {
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      return Response.json({ voices: [] })
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": elevenlabsApiKey },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch ElevenLabs voices")
    }

    const data = await response.json()
    const voices = ((data.voices || []) as ElevenLabsVoice[])
      .map((voice) => ({
        voice_id: voice.voice_id,
        name: voice.name || "Unnamed voice",
        category: voice.category || "",
      }))

    return Response.json({ voices })
  } catch (error) {
    console.error("ElevenLabs voices fetch error:", error)
    return Response.json({ voices: [] })
  }
}
