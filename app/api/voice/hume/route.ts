export async function POST(request: Request) {
  try {
    const { text, apiKey } = await request.json()

    // Hume.ai TTS integration
    const response = await fetch("https://api.hume.ai/v0/evi/chat", {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        config: {
          voice: {
            provider: "HUME_AI",
            name: "ITO",
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate speech with Hume")
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    console.error("Hume TTS error:", error)
    return Response.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
