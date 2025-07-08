export async function POST(request: Request) {
  try {
    const { text, languageCode = "en-US", gender = "FEMALE" } = await request.json();

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

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
    console.log("Google TTS response:", data);
    console.log("Google TTS full response:", JSON.stringify(data, null, 2));
    if (data.audioContent) {
      console.log("Audio file size:", data.audioContent.length, "type:", "audio/mpeg");
      return Response.json({ audioContent: data.audioContent });
    } else {
      return Response.json({ error: "TTS failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("Google TTS error:", error);
    return Response.json({ error: "Failed to generate speech" }, { status: 500 });
  }
} 