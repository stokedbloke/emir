export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const apiKey = formData.get("apiKey") as string
    const service = (formData.get("service") as string) || "google"

    if (!audioFile || !apiKey) {
      return Response.json({ error: "Audio file and API key are required" }, { status: 400 })
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    if (service === "google") {
      // Use Google Cloud Speech-to-Text API
      const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode: "en-US",
            enableAutomaticPunctuation: true,
            model: "latest_long",
          },
          audio: {
            content: base64Audio,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Google Speech-to-Text error:", errorData)
        return Response.json({ transcript: "" })
      }

      const data = await response.json()

      if (data.results && data.results.length > 0) {
        const transcript = data.results.map((result: any) => result.alternatives[0].transcript).join(" ")
        return Response.json({ transcript })
      } else {
        return Response.json({ transcript: "" })
      }
    }

    // Fallback for other services or if Google fails
    return Response.json({ transcript: "" })
  } catch (error) {
    console.error("Transcription error:", error)
    // Always return a fallback response instead of error
    return Response.json({ transcript: "" })
  }
}
