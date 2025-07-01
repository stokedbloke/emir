export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return Response.json({ error: "API key is required" }, { status: 400 })
    }

    // Google AI Studio / Gemini API doesn't have a direct usage/credits endpoint
    // But we can test the key validity by making a small request to the models endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 403) {
        return Response.json({ error: "Invalid API key" }, { status: 403 })
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // If we can list models, the key is valid
    // Google doesn't provide usage limits in their API, so we'll return a status message
    if (data.models && data.models.length > 0) {
      return Response.json({
        credits: "API Key Valid - Usage limits managed in Google AI Studio",
        models: data.models.length,
      })
    } else {
      return Response.json({ error: "No models available" }, { status: 400 })
    }
  } catch (error) {
    console.error("Gemini credits check error:", error)
    return Response.json(
      {
        error: "Failed to validate API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
