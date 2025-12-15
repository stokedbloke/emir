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
  console.log('=== SUMMARIZE API CALLED ===');
  try {
    // Parse transcript and service from request body
    const { transcript, service = "openai" } = await request.json()
    console.log("Summarize service requested:", service);
    console.log("Transcript length:", transcript?.length);

    if (!transcript) {
      console.error("No transcript provided");
      return Response.json({ error: "Transcript is required" }, { status: 400 })
    }

    // Build the summary prompt

    const prompt = `CRITICAL: You must rephrase this personal reflection EXCLUSIVELY in first person using "I" statements. 

RULES:
- Respond in first person perspective.
- NEVER use any second/third person pronouns to refer to the speaker. Only use second/third person pronouns if he speaker uses them to refer to someone else
- NEVER say "what I'm hearing" or "I understand that you..."
- Write as if you are the person is speaking about their own experience
- Be specific and avoid generic statements
- Capture all main points in a crisp, concise summary
- Do not add emotions, feelings, or interpretations not in the original
- Make the person feel heard without judgement or advice
- Maintain the same meaning and emotional tone
- Paraphrase regardless of length, language or speaking or singing style

Original: ${transcript}

Rephrased reflection (FIRST PERSON ONLY):`

    //const prompt = 'You are a simple and attentive active listener. Provide a brief paraphrased summary of this personal share in first person tense. Do not provide praise, disapproval or commentary of any sort. Use "I" statements throughout. Do not refer to the person in second or third person. Be specific and avoid generic statements. The summary should make the person feel heard, without any words that even slightly could be received as judgement or advice. The rephrasing should be different than the original speech but maintain the same meaning and emotional tone. Always use first person perspective. Paraphrase the text regardless of length, language or speaking/singing style.\n\nOriginal: ${transcript}\n\nRephrased reflection:'
    //const prompt = `Rephrase this personal reflection in first person, as if the person is speaking about their own thoughts and feelings. Use "I" statements throughout. Do not use "you" or refer to the person in second or third person. Capture the main points and feelings expressed. Be specific and avoid generic statements. The summary should make the person feel heard, without any judgement nor advice. The rephrasing should be different than the original speech but maintain the same meaning and emotional tone. Always use first person perspective.\n\nOriginal: ${transcript}\n\nRephrased reflection:`

    // Select LLM model based on requested service
    console.log("Selecting LLM model for service:", service);
    let model
    switch (service) {
      case "claude":
        // Use Anthropic Claude (requires ANTHROPIC_API_KEY)
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY
        if (!anthropicApiKey) {
          console.error("Claude API key not configured");
          return Response.json({ error: "Claude API key not configured" }, { status: 500 })
        }
        const anthropic = createAnthropic({ apiKey: anthropicApiKey })
        model = anthropic("claude-3-haiku-20240307")
        console.log("Using Claude model");
        break
      case "gemini":
        // Use Google Gemini (requires GOOGLE_API_KEY)
        const googleApiKey = process.env.GOOGLE_API_KEY
        console.log("Google API key present:", !!googleApiKey);
        if (!googleApiKey) {
          console.error("Google API key not configured");
          return Response.json({ error: "Google API key not configured" }, { status: 500 })
        }
        const google = createGoogleGenerativeAI({ apiKey: googleApiKey })

        // [CHANGE: 2025-12-14] Switched from 'gemini-2.0-flash-exp' to 'gemini-flash-latest'
        // REASON: The 'exp' model has 0 free tier quota, causing 500 errors. 'gemini-flash-latest' includes free tier.
        // RISK: 'latest' alias tracks the newest model, which might introduce slight behavioral changes over time.
        // DEBT: Model name is hardcoded. Should ideally be moved to an environment variable or constants file.
        model = google("gemini-flash-latest")
        console.log("Using Gemini model: gemini-flash-latest");
        break
      default:
        // Use OpenAI (requires OPENAI_API_KEY)
        const openaiApiKey = process.env.OPENAI_API_KEY
        if (!openaiApiKey) {
          console.error("OpenAI API key not configured");
          return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
        }
        const openai = createOpenAI({ apiKey: openaiApiKey })
        model = openai("gpt-4o-mini")
        console.log("Using OpenAI model");
    }

    // Generate summary using the selected LLM
    console.log("Calling generateText...");
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.7,
    })
    console.log("generateText completed");

    let summary = text?.trim();

    // Debug logging to see what Gemini is actually returning
    console.log("Gemini raw response:", text);
    console.log("Gemini trimmed response:", summary);

    // Fallback if LLM returns empty or generic response
    if (
      !summary ||
      summary.toLowerCase().includes("please provide the personal share") ||
      summary.toLowerCase().includes("i need the text") ||
      summary.length < 3 // Too short to be meaningful
    ) {
      console.warn("LLM returned empty or invalid response, using fallback");
      // Simple fallback: echo or basic paraphrase
      summary = transcript
        ? `I heard: "${transcript}".`
        : "No meaningful content was provided to summarize.";
    }

    // Success response
    console.log("Returning summary, length:", summary.length);
    return Response.json({ summary });
  } catch (error) {
    // Catch-all error handler
    console.error("=== SUMMARIZATION ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Full error object:", JSON.stringify(error, null, 2));
    return Response.json(
      {
        error: "Failed to generate summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
