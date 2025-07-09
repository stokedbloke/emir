// API Route: Generate speech audio from text using Hume.ai Text-to-Speech API
// Receives a POST request with { text, voice } and returns audio (audio/mpeg).
// Environment variables used (private, server-side only):
//   HUME_API_KEY
//
// Returns: audio/mpeg stream on success, or { error: ... } on failure.
//
export async function POST(request: Request) {
  try {
    // Parse text and voice from request body
    const { text, voice = "ITO" } = await request.json()

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    // Use Hume.ai TTS API (requires HUME_API_KEY)
    const humeApiKey = process.env.HUME_API_KEY
    if (!humeApiKey) {
      return Response.json({ error: "Hume API key not configured" }, { status: 500 })
    }

    // Call Hume.ai API
    const response = await fetch("https://api.hume.ai/v0/evi/chat", {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": humeApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        config: {
          voice: {
            provider: "HUME_AI",
            name: voice,
          },
        },
      }),
    })

    if (!response.ok) {
      // Log and return error if Hume API fails
      throw new Error("Failed to generate speech with Hume")
    }

    // Return audio buffer as audio/mpeg
    const audioBuffer = await response.arrayBuffer()
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    // Catch-all error handler
    console.error("Hume TTS error:", error)
    return Response.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
