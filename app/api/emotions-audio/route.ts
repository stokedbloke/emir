import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { audioBlob } = await request.json();

    if (!audioBlob) {
      return NextResponse.json({ error: "Audio blob is required" }, { status: 400 });
    }

    const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!huggingfaceApiKey) {
      console.error("HuggingFace API key not found");
      return NextResponse.json({ error: "HuggingFace API key not configured" }, { status: 500 });
    }

    // Convert base64 audio to buffer for HuggingFace API
    const audioBuffer = Buffer.from(audioBlob.split(',')[1], 'base64');

    try {
      // Use HuggingFace audio emotion recognition model
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for audio processing

      const response = await fetch("https://api-inference.huggingface.co/models/superb/wav2vec2-base-superb-er", {
        headers: {
          Authorization: `Bearer ${huggingfaceApiKey}`,
          "Content-Type": "application/octet-stream",
        },
        method: "POST",
        body: audioBuffer,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Audio emotion analysis result:", result);

      // Process the audio emotion results
      if (Array.isArray(result) && result.length > 0) {
        const emotions = result[0].map((item: any) => ({
          emotion: item.label,
          confidence: item.score
        }));

        return NextResponse.json({ emotions });
      } else {
        throw new Error("Unexpected audio emotion analysis result format");
      }

    } catch (error) {
      // Log HuggingFace fetch error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("HuggingFace audio emotion API timeout after 15 seconds, using fallback analysis");
      } else {
        console.error("HuggingFace audio emotion API error:", error);
      }

      // Fallback to basic audio analysis
      return NextResponse.json({ 
        emotions: [
          { emotion: 'Neutral', confidence: 0.5 },
          { emotion: 'Calm', confidence: 0.3 },
          { emotion: 'Focused', confidence: 0.2 }
        ],
        fallback: true
      });
    }

  } catch (error) {
    console.error("Audio emotion analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze audio emotions" }, { status: 500 });
  }
}
