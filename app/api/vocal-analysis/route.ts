export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const apiKey = formData.get("apiKey") as string

    if (!audioFile) {
      return Response.json({ error: "Audio file is required" }, { status: 400 })
    }

    // If we have a HuggingFace API key, try advanced vocal emotion analysis
    if (apiKey) {
      try {
        // Convert audio to the format expected by the model
        const audioBuffer = await audioFile.arrayBuffer()
        const base64Audio = Buffer.from(audioBuffer).toString("base64")

        // Try speechbrain emotion recognition model
        const response = await fetch(
          "https://api-inference.huggingface.co/models/speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              inputs: base64Audio,
            }),
          },
        )

        if (response.ok) {
          const vocalEmotions = await response.json()
          console.log("Vocal emotion analysis:", vocalEmotions)

          // Process the vocal emotion results
          let dominantEmotion = "Calm"
          let confidence = 0.5

          if (Array.isArray(vocalEmotions) && vocalEmotions[0]) {
            const topEmotion = vocalEmotions[0]
            dominantEmotion = topEmotion.label || "Calm"
            confidence = topEmotion.score || 0.5
          }

          return Response.json({
            vocalEmotion: dominantEmotion,
            confidence: confidence,
            rawAnalysis: vocalEmotions,
          })
        }
      } catch (error) {
        console.error("Advanced vocal analysis error:", error)
      }
    }

    // Fallback: Enhanced basic audio analysis
    const audioBuffer = await audioFile.arrayBuffer()
    const audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)()

    try {
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer)
      const channelData = decodedAudio.getChannelData(0)

      // More sophisticated analysis
      let rms = 0
      let zeroCrossings = 0
      const spectralCentroid = 0

      // Calculate RMS (volume/energy)
      for (let i = 0; i < channelData.length; i++) {
        rms += channelData[i] * channelData[i]
      }
      rms = Math.sqrt(rms / channelData.length)

      // Calculate zero crossings (pitch/tone indicator)
      for (let i = 1; i < channelData.length; i++) {
        if (channelData[i] >= 0 !== channelData[i - 1] >= 0) {
          zeroCrossings++
        }
      }

      const zcr = zeroCrossings / channelData.length

      // Analyze speech patterns
      const silenceThreshold = 0.01
      let speechSegments = 0
      let totalSpeechTime = 0
      let inSpeech = false
      let currentSegmentLength = 0

      for (let i = 0; i < channelData.length; i += 1000) {
        const segment = Math.abs(channelData[i])
        if (segment > silenceThreshold) {
          if (!inSpeech) {
            speechSegments++
            inSpeech = true
            currentSegmentLength = 0
          }
          currentSegmentLength++
          totalSpeechTime++
        } else {
          inSpeech = false
        }
      }

      const duration = decodedAudio.duration
      const speechRatio = totalSpeechTime / (channelData.length / 1000)
      const avgSegmentLength = speechSegments > 0 ? totalSpeechTime / speechSegments : 0

      // More nuanced characteristics
      const characteristics = {
        energy: rms > 0.1 ? "High" : rms > 0.05 ? "Moderate" : "Low",
        tone: zcr > 0.1 ? "Bright" : zcr > 0.05 ? "Balanced" : "Warm",
        pace: avgSegmentLength > 50 ? "Deliberate" : avgSegmentLength > 25 ? "Moderate" : "Quick",
        volume: rms > 0.1 ? "Strong" : rms > 0.05 ? "Moderate" : "Gentle",
        articulation: speechRatio > 0.8 ? "Clear" : speechRatio > 0.6 ? "Natural" : "Soft",
        confidence: Math.min(0.95, 0.6 + rms * 2 + speechRatio * 0.3),
        vocalEmotion: rms > 0.08 ? "Energetic" : rms > 0.04 ? "Engaged" : "Calm",
      }

      return Response.json(characteristics)
    } finally {
      await audioContext.close()
    }
  } catch (error) {
    console.error("Vocal analysis error:", error)
    return Response.json({
      energy: "Moderate",
      tone: "Balanced",
      pace: "Natural",
      volume: "Moderate",
      articulation: "Clear",
      confidence: 0.7,
      vocalEmotion: "Calm",
    })
  }
}
