import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export async function POST(request: Request) {
  try {
    const { transcript, service = "openai", apiKey } = await request.json()

    if (!apiKey) {
      return Response.json({ error: "API key is required" }, { status: 400 })
    }

    // Short, concise prompt for 50-word summary
    const prompt = `Provide a brief, empathetic 50-word reflection on this personal sharing. Focus on key insights and emotional themes with warmth and understanding:\n\n${transcript}`

    let model
    switch (service) {
      case "claude":
        const anthropic = createAnthropic({ apiKey })
        model = anthropic("claude-3-haiku-20240307")
        break
      case "gemini":
        const google = createGoogleGenerativeAI({ apiKey })
        model = google("gemini-1.5-flash")
        break
      default:
        const openai = createOpenAI({ apiKey })
        model = openai("gpt-4o-mini")
    }

    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 80, // Limit to ensure ~50 words
      temperature: 0.7,
    })

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Summarization error:", error)
    return Response.json(
      {
        error: "Failed to generate summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
