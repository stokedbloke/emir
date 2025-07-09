// API Route: Generate speech audio from text using Google Text-to-Speech API
// Receives a POST request with { text, languageCode, gender } and returns audioContent (base64 MP3).
// Environment variables used (private, server-side only):
//   GOOGLE_API_KEY
//
// Returns: { audioContent: string } on success, or { error: ... } on failure.
//
export async function POST(request: Request) {
  try {
    // Parse text, languageCode, and gender from request body
    const { text, languageCode = "en-US", gender = "FEMALE" } = await request.json();

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    // Use Google Text-to-Speech API (requires GOOGLE_API_KEY)
    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return Response.json({ error: "Google API key not configured" }, { status: 500 })
    }

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode, ssmlGender: gender },
          audioConfig: { audioEncoding: "MP3" }
        })
      }
    );

    const data = await response.json();
    // Log and check response
    console.log("Google TTS response:", data);
    if (data.audioContent) {
      // Return audio content (base64 MP3)
      return Response.json({ audioContent: data.audioContent });
    } else {
      return Response.json({ error: "TTS failed" }, { status: 500 });
    }
  } catch (error) {
    // Catch-all error handler
    console.error("Google TTS error:", error);
    return Response.json({ error: "Failed to generate speech" }, { status: 500 });
  }
} 