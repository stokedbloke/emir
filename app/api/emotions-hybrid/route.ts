import { NextRequest, NextResponse } from "next/server";

// Hybrid emotion analysis combining both text and audio analysis
// This provides the most accurate emotional landscape by cross-referencing both sources
export async function POST(request: NextRequest) {
  try {
    const { text, audioBlob } = await request.json();

    if (!text && !audioBlob) {
      return NextResponse.json({ error: "Either text or audio blob is required" }, { status: 400 });
    }

    console.log("Starting hybrid emotion analysis...");
    const startTime = Date.now();

    // Run both analyses in parallel for maximum efficiency
    const [textEmotions, audioEmotions] = await Promise.allSettled([
      // Text-based emotion analysis
      text ? analyzeTextEmotions(text) : Promise.resolve({ emotions: [], source: 'text', fallback: true }),
      // Audio-based emotion analysis  
      audioBlob ? analyzeAudioEmotions(audioBlob) : Promise.resolve({ emotions: [], source: 'audio', fallback: true })
    ]);

    const textResult = textEmotions.status === 'fulfilled' ? textEmotions.value : { emotions: [], source: 'text', fallback: true };
    const audioResult = audioEmotions.status === 'fulfilled' ? audioEmotions.value : { emotions: [], source: 'audio', fallback: true };

    console.log("Text emotions:", textResult.emotions);
    console.log("Audio emotions:", audioResult.emotions);

    // Combine and cross-reference the results
    const combinedEmotions = combineEmotionAnalysis(textResult.emotions, audioResult.emotions);

    const processingTime = Date.now() - startTime;
    console.log(`Hybrid emotion analysis completed in ${processingTime}ms`);

    return NextResponse.json({
      emotions: combinedEmotions,
      sources: {
        text: textResult,
        audio: audioResult
      },
      processingTime
    });

  } catch (error) {
    console.error("Hybrid emotion analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze emotions" }, { status: 500 });
  }
}

// Text-based emotion analysis (existing logic)
async function analyzeTextEmotions(text: string) {
  try {
    const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    if (huggingfaceApiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch("https://api-inference.huggingface.co/models/SamLowe/roberta-base-go_emotions", {
          headers: {
            Authorization: `Bearer ${huggingfaceApiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: text }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const emotions = await response.json();
          let emotionData = emotions;
          if (Array.isArray(emotions) && emotions[0]) {
            emotionData = emotions[0];
          }

          if (Array.isArray(emotionData)) {
            const formattedEmotions = emotionData
              .map((emotion: any) => ({
                emotion: emotion.label.charAt(0).toUpperCase() + emotion.label.slice(1).toLowerCase(),
                confidence: emotion.score,
              }))
              .sort((a: any, b: any) => b.confidence - a.confidence)
              .slice(0, 6);
            
            return { emotions: formattedEmotions, source: 'text', fallback: false };
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log("Text emotion analysis timeout, using fallback");
        } else {
          console.error("Text emotion analysis error:", error);
        }
      }
    }

    // Fallback text analysis
    return { emotions: getFallbackTextEmotions(text), source: 'text', fallback: true };

  } catch (error) {
    console.error("Text emotion analysis failed:", error);
    return { emotions: getFallbackTextEmotions(text), source: 'text', fallback: true };
  }
}

// Audio-based emotion analysis
async function analyzeAudioEmotions(audioBlob: string) {
  try {
    const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!huggingfaceApiKey) {
      throw new Error("HuggingFace API key not configured");
    }

    const audioBuffer = Buffer.from(audioBlob.split(',')[1], 'base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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

    if (response.ok) {
      const result = await response.json();
      if (Array.isArray(result) && result.length > 0) {
        const emotions = result[0].map((item: any) => ({
          emotion: item.label,
          confidence: item.score
        }));
        return { emotions, source: 'audio', fallback: false };
      }
    }

    throw new Error("Audio emotion analysis failed");

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("Audio emotion analysis timeout, using fallback");
    } else {
      console.error("Audio emotion analysis error:", error);
    }
    return { emotions: getFallbackAudioEmotions(), source: 'audio', fallback: true };
  }
}

// Combine and cross-reference emotion analysis from both sources
function combineEmotionAnalysis(textEmotions: any[], audioEmotions: any[]) {
  const emotionMap = new Map<string, { confidence: number, sources: string[] }>();

  // Add text emotions
  textEmotions.forEach(emotion => {
    const key = emotion.emotion.toLowerCase();
    emotionMap.set(key, {
      confidence: emotion.confidence * 0.6, // Weight text analysis at 60%
      sources: ['text']
    });
  });

  // Add audio emotions and cross-reference
  audioEmotions.forEach(emotion => {
    const key = emotion.emotion.toLowerCase();
    const existing = emotionMap.get(key);
    
    if (existing) {
      // Emotion found in both sources - boost confidence
      existing.confidence = Math.min(0.95, existing.confidence + (emotion.confidence * 0.4)); // Weight audio at 40%
      existing.sources.push('audio');
    } else {
      // New emotion from audio only
      emotionMap.set(key, {
        confidence: emotion.confidence * 0.4, // Weight audio-only emotions lower
        sources: ['audio']
      });
    }
  });

  // Convert back to array and sort by confidence
  const combinedEmotions = Array.from(emotionMap.entries())
    .map(([emotion, data]) => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      confidence: data.confidence,
      sources: data.sources
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  return combinedEmotions;
}

// Fallback text emotion analysis
function getFallbackTextEmotions(text: string) {
  const text_lower = text.toLowerCase();
  const emotions = [];

  if (text_lower.includes("excited") || text_lower.includes("really") || text_lower.includes("definitely")) {
    emotions.push({ emotion: "Excitement", confidence: 0.8 });
  }
  if (text_lower.includes("love") || text_lower.includes("like") || text_lower.includes("enjoy")) {
    emotions.push({ emotion: "Joy", confidence: 0.85 });
  }
  if (text_lower.includes("curious") || text_lower.includes("interested") || text_lower.includes("wonder")) {
    emotions.push({ emotion: "Curiosity", confidence: 0.75 });
  }

  if (emotions.length === 0) {
    emotions.push(
      { emotion: "Contemplative", confidence: 0.65 },
      { emotion: "Reflective", confidence: 0.6 },
      { emotion: "Present", confidence: 0.55 }
    );
  }

  return emotions.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

// Fallback audio emotion analysis
function getFallbackAudioEmotions() {
  return [
    { emotion: "Neutral", confidence: 0.5 },
    { emotion: "Calm", confidence: 0.3 },
    { emotion: "Focused", confidence: 0.2 }
  ];
}
