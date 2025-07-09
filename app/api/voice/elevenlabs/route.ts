export async function POST(request: Request) {
  try {
    const { text, voiceId = "pNInz6obpgDQGcFmaJgB" } = await request.json()

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    console.log("ELEVENLABS_API_KEY present:", !!elevenlabsApiKey);
    if (!elevenlabsApiKey) {
      console.error("ElevenLabs API key missing!");
      return Response.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

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
      throw new Error("Failed to generate speech")
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (err) {
    console.warn("Falling back to browser TTS: ElevenLabs TTS error:", err);
    toast({
      title: "ElevenLabs TTS failed",
      description: "Falling back to browser voice. Check your ElevenLabs API key and quota.",
      variant: "destructive",
    });
  }
}
