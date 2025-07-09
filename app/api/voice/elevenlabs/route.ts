// API Route: Generate speech audio from text using ElevenLabs Text-to-Speech API
// Receives a POST request with { text, voiceId } and returns audio (audio/mpeg).
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Returns: audio/mpeg stream on success, or { error: ... } on failure.
//
export async function POST(request: Request) {
  try {
    // Parse text and voiceId from request body
    const { text, voiceId = "pNInz6obpgDQGcFmaJgB" } = await request.json()

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    // Use ElevenLabs TTS API (requires ELEVENLABS_API_KEY)
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    console.log("ELEVENLABS_API_KEY present:", !!elevenlabsApiKey);
    if (!elevenlabsApiKey) {
      console.error("ElevenLabs API key missing!");
      return Response.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": elevenlabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      // Log and return error if ElevenLabs API fails
      throw new Error("Failed to generate speech")
    }

    // Return audio buffer as audio/mpeg
    const audioBuffer = await response.arrayBuffer()
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (err) {
    // Catch-all error handler
    console.warn("Falling back to browser TTS: ElevenLabs TTS error:", err);
    return Response.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}
