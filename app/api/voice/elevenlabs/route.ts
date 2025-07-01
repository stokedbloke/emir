export async function POST(request: Request) {
  try {
    const { text, apiKey, voiceId = "pNInz6obpgDQGcFmaJgB" } = await request.json()

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
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
      throw new Error("Failed to generate speech")
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    console.error("ElevenLabs TTS error:", error)
    return Response.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
