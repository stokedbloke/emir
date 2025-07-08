export async function GET() {
  try {
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      return Response.json({ voices: [] })
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": elevenlabsApiKey }
    })

    if (!response.ok) {
      throw new Error("Failed to fetch ElevenLabs voices")
    }

    const data = await response.json()
    return Response.json({ voices: data.voices || [] })
  } catch (error) {
    console.error("ElevenLabs voices fetch error:", error)
    return Response.json({ voices: [] })
  }
} 