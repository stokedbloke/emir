// API Route: Summarize user transcript using LLMs (OpenAI, Anthropic, Google Gemini)
// Receives a POST request with { transcript, service } and returns a summary string.
// Environment variables used (all private, server-side only):
//   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
//
// Returns: { summary: string } on success, or { error: ... } on failure.
//
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export async function POST(request: Request) {
  try {
    // Parse transcript and service from request body
    const { transcript, service = "openai" } = await request.json()
    console.log("Summarize service requested:", service);

    if (!transcript) {
      return Response.json({ error: "Transcript is required" }, { status: 400 })
    }

    // Build the summary prompt

    const prompt = `You are a simple and attentive active listener. 
                    Rephrase this personal reflection in first person. 
                    Use "I" statements. 
                    Do not paraphrase the users share in second or third person. 
                    Be specific and avoid generic statements.
                    Aim for a crisp and concise but complete summary that captures all the main points.
                    Do not add emotions, feelings, or interpretations that are not obvious from the original text.
                    The summary should make the person feel heard, without any judgement or advice. 
                    The rephrasing should be different than the original speech but maintain the same meaning and emotional tone.
                    Paraphrase the text regardless of length, language or speaking/singing style.

    Original: ${transcript}
    
    Rephrased reflection:` 

    //const prompt = 'You are a simple and attentive active listener. Provide a brief paraphrased summary of this personal share in first person tense. Do not provide praise, disapproval or commentary of any sort. Use "I" statements throughout. Do not refer to the person in second or third person. Be specific and avoid generic statements. The summary should make the person feel heard, without any words that even slightly could be received as judgement or advice. The rephrasing should be different than the original speech but maintain the same meaning and emotional tone. Always use first person perspective. Paraphrase the text regardless of length, language or speaking/singing style.\n\nOriginal: ${transcript}\n\nRephrased reflection:'
    //const prompt = `Rephrase this personal reflection in first person, as if the person is speaking about their own thoughts and feelings. Use "I" statements throughout. Do not use "you" or refer to the person in second or third person. Capture the main points and feelings expressed. Be specific and avoid generic statements. The summary should make the person feel heard, without any judgement nor advice. The rephrasing should be different than the original speech but maintain the same meaning and emotional tone. Always use first person perspective.\n\nOriginal: ${transcript}\n\nRephrased reflection:`

    // Select LLM model based on requested service
    let model
    switch (service) {
      case "claude":
        // Use Anthropic Claude (requires ANTHROPIC_API_KEY)
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY
        if (!anthropicApiKey) {
          return Response.json({ error: "Claude API key not configured" }, { status: 500 })
        }
        const anthropic = createAnthropic({ apiKey: anthropicApiKey })
        model = anthropic("claude-3-haiku-20240307")
        break
      case "gemini":
        // Use Google Gemini (requires GOOGLE_API_KEY)
        const googleApiKey = process.env.GOOGLE_API_KEY
        if (!googleApiKey) {
          return Response.json({ error: "Google API key not configured" }, { status: 500 })
        }
        const google = createGoogleGenerativeAI({ apiKey: googleApiKey })
        model = google("gemini-1.5-flash")
        break
      default:
        // Use OpenAI (requires OPENAI_API_KEY)
        const openaiApiKey = process.env.OPENAI_API_KEY
        if (!openaiApiKey) {
          return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
        }
        const openai = createOpenAI({ apiKey: openaiApiKey })
        model = openai("gpt-4o-mini")
    }

    // Generate summary using the selected LLM
    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 300, // Increased from 80 to allow ~200-250 words
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

    // Success response
    return Response.json({ summary });
  } catch (error) {
    // Catch-all error handler
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
