export async function POST(request: Request) {
  try {
    const { text, apiKey, languageCode = "en-US", gender = "FEMALE" } = await request.json();

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
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