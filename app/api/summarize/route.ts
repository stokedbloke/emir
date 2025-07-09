import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export async function POST(request: Request) {
  try {
    const { transcript, service = "openai" } = await request.json()
    console.log("Summarize service requested:", service);

    if (!transcript) {
      return Response.json({ error: "Transcript is required" }, { status: 400 })
    }

    // Short, concise prompt for 50-word summary
    const prompt = `Provide a brief paraphrased summary of this personal share. You are a simple and attentive active listener. Do not provide praise, disapproval or commentary of any sort. Capture the main points and feelings expressed. Be specific and avoid generic statements  The summary should make the listener feel heard, without any judgement and wihout any words that event slightly could be received as judgement. The paraphrase should be differnt than the speech provided, and be in first person tense. Paraphrase the text regardless of length, language or speaking style.\n\n${transcript}`

    let model
    switch (service) {
      case "claude":
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY
        if (!anthropicApiKey) {
          return Response.json({ error: "Claude API key not configured" }, { status: 500 })
        }
        const anthropic = createAnthropic({ apiKey: anthropicApiKey })
        model = anthropic("claude-3-haiku-20240307")
        break
      case "gemini":
        const googleApiKey = process.env.GOOGLE_API_KEY
        if (!googleApiKey) {
          return Response.json({ error: "Google API key not configured" }, { status: 500 })
        }
        const google = createGoogleGenerativeAI({ apiKey: googleApiKey })
        model = google("gemini-1.5-flash")
        break
      default:
        const openaiApiKey = process.env.OPENAI_API_KEY
        if (!openaiApiKey) {
          return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
        }
        const openai = createOpenAI({ apiKey: openaiApiKey })
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
