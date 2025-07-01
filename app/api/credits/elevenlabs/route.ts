export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()

    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch ElevenLabs subscription")
    }

    const data = await response.json()
    const remainingCharacters = data.character_limit - data.character_count

    return Response.json({ credits: remainingCharacters })
  } catch (error) {
    console.error("ElevenLabs credits check error:", error)
    return Response.json({ error: "Failed to check credits" }, { status: 500 })
  }
}
