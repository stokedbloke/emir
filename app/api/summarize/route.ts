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
    const prompt = `Provide a brief paraphrased summary of this personal share. You are a simple and attentive active listener. Do not provide praise, disapproval or commentary of any sort. Capture the main points and feelings expressed. Be specific and avoid generic statements  The summary should make the listener feel heard, without any judgement and wihout any words that event slightly could be received as judgement. The paraphrase should be differnt than the speech provided, and be in first person tense. Paraphrase the text regardless of length, language or speaking style.\n\n${transcript}`

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

    let summary = text?.trim();

    // Fallback if LLM returns empty or generic response
    if (
      !summary ||
      summary.toLowerCase().includes("please provide the personal share") ||
      summary.toLowerCase().includes("i need the text") ||
      summary.length < 3 // Too short to be meaningful
    ) {
      // Simple fallback: echo or basic paraphrase
      summary = transcript
        ? `I heard: "${transcript}".`
        : "No meaningful content was provided to summarize.";
    }

    return Response.json({ summary });
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
