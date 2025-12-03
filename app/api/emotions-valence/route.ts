import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { audioBlob } = await request.json();

    if (!audioBlob) {
      return NextResponse.json({ error: "Audio blob is required" }, { status: 400 });
    }

    const valenceApiKey = process.env.VALENCE_API_KEY;
    if (!valenceApiKey) {
      console.error("Valence API key not found");
      return NextResponse.json({ error: "Valence API key not configured" }, { status: 500 });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioBlob.split(',')[1], 'base64');

    // Create FormData for multipart/form-data upload
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch("https://api.getvalenceai.com/emotionprediction", {
      method: "POST",
      headers: {
        'x-api-key': valenceApiKey,
        ...formData.getHeaders(),
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Valence API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Valence API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Valence emotion analysis result:", result);

    // Transform to EmotionAnalysis format
    // Expected format: { main_emotion, confidence, all_predictions: { angry: 0.988, ... } }
    if (result.all_predictions) {
      const emotions = Object.entries(result.all_predictions)
        .map(([emotion, confidence]) => ({
          emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          confidence: confidence as number,
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Top 3 only

      return NextResponse.json({ emotions });
    } else {
      throw new Error("Unexpected Valence API response format");
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("Valence API timeout after 15 seconds");
    } else {
      console.error("Valence emotion API error:", error);
    }

    // Return empty array on failure (non-intrusive error handling)
    return NextResponse.json({ 
      emotions: [],
      fallback: true
    });
  }
}
