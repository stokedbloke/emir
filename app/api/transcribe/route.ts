// API Route: Transcribe audio using Google Speech-to-Text API
// Receives a POST request with audio (as FormData) and optional service (default: google).
// Environment variables used (private, server-side only):
//   GOOGLE_API_KEY
//
// Returns: { transcript: string } on success, or { error: ... } on failure.
//
export async function POST(request: Request) {
  try {
    // Parse audio file and service from form data
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const service = (formData.get("service") as string) || "google"

    if (!audioFile) {
      return Response.json({ error: "Audio file is required" }, { status: 400 })
    }

    // Convert audio to base64 for Google API
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    if (service === "google") {
      // Use Google Cloud Speech-to-Text API (requires GOOGLE_API_KEY)
      const googleApiKey = process.env.GOOGLE_API_KEY
      if (!googleApiKey) {
        return Response.json({ transcript: "" })
      }
      
      const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`, {
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
        // Log and return error if Google API fails
        const errorData = await response.json()
        console.error("Google Speech-to-Text error:", errorData)
        return Response.json({ transcript: "" })
      }

      const data = await response.json()

      if (data.results && data.results.length > 0) {
        // Extract transcript from results
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
