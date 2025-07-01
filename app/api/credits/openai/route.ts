export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()

    const response = await fetch("https://api.openai.com/v1/usage", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch OpenAI usage")
    }

    const data = await response.json()

    // Calculate remaining credits (this is simplified)
    const totalUsage = data.total_usage || 0
    const estimatedCredits = Math.max(0, 100 - totalUsage / 1000) // Simplified calculation

    return Response.json({ credits: estimatedCredits.toFixed(2) })
  } catch (error) {
    console.error("OpenAI credits check error:", error)
    return Response.json({ error: "Failed to check credits" }, { status: 500 })
  }
}
