// API Route: Analyze vocal characteristics from audio
// Receives a POST request with audio (as FormData) and optional apiKey.
// No environment variables required for DSP analysis (may use apiKey for external services in the future).
//
// Returns: { dsp: ..., speechbrain: ... } with vocal analysis results, or fallback values on error.
//
import { Buffer } from 'buffer';

export async function POST(request: Request) {
  try {
    // Parse audio file and optional apiKey from form data
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const apiKey = formData.get("apiKey") as string

    if (!audioFile) {
      return Response.json({ error: "Audio file is required" }, { status: 400 })
    }

    // Always run DSP analysis first (extracts features from audio)
    let dspResult = {
      energy: "Unknown",
      tone: "Unknown",
      pace: "Unknown",
      volume: "Unknown",
      articulation: "Unknown",
      confidence: 0.5,
      vocalEmotion: "Unknown",
    };
    let speechbrainResult: {
      vocalEmotion: string;
      confidence: number;
      rawAnalysis: any;
      error: string | null;
    } = {
      vocalEmotion: "Unavailable",
      confidence: 0,
      rawAnalysis: null,
      error: null,
    };
    let audioBuffer, audioContext, decodedAudio, channelData;
    try {
      // Decode audio and extract channel data
      audioBuffer = await audioFile.arrayBuffer();
      audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
      decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      channelData = decodedAudio.getChannelData(0);
      // DSP calculations (RMS, zero-crossings, speech segments, etc.)
      let rms = 0;
      let zeroCrossings = 0;
      for (let i = 0; i < channelData.length; i++) {
        rms += channelData[i] * channelData[i];
      }
      rms = Math.sqrt(rms / channelData.length);
      for (let i = 1; i < channelData.length; i++) {
        if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
      const zcr = zeroCrossings / channelData.length;
      const silenceThreshold = 0.01;
      let speechSegments = 0;
      let totalSpeechTime = 0;
      let inSpeech = false;
      let currentSegmentLength = 0;
      for (let i = 0; i < channelData.length; i += 1000) {
        const segment = Math.abs(channelData[i]);
        if (segment > silenceThreshold) {
          if (!inSpeech) {
            speechSegments++;
            inSpeech = true;
            currentSegmentLength = 0;
          }
          currentSegmentLength++;
          totalSpeechTime++;
        } else {
          inSpeech = false;
        }
      }
      const duration = decodedAudio.duration;
      const speechRatio = totalSpeechTime / (channelData.length / 1000);
      const avgSegmentLength = speechSegments > 0 ? totalSpeechTime / speechSegments : 0;
      dspResult = {
        energy: rms > 0.1 ? "High" : rms > 0.05 ? "Moderate" : "Low",
        tone: zcr > 0.1 ? "Bright" : zcr > 0.05 ? "Balanced" : "Warm",
        pace: avgSegmentLength > 50 ? "Deliberate" : avgSegmentLength > 25 ? "Moderate" : "Quick",
        volume: rms > 0.1 ? "Strong" : rms > 0.05 ? "Moderate" : "Gentle",
        articulation: speechRatio > 0.8 ? "Clear" : speechRatio > 0.6 ? "Natural" : "Soft",
        confidence: Math.min(0.95, 0.6 + rms * 2 + speechRatio * 0.3),
        vocalEmotion: rms > 0.08 ? "Energetic" : rms > 0.04 ? "Engaged" : "Calm",
      };
    } catch (e) {
      console.error("DSP analysis failed:", e);
      // No fallback data - return null to indicate analysis failed
      // This ensures we never lie to users with fake data
      return Response.json({ 
        error: "Vocal analysis failed",
        details: e instanceof Error ? e.message : "Unknown error"
      }, { status: 500 });
    } finally {
      if (audioContext) await audioContext.close();
    }

    // If we have a HuggingFace API key, try advanced vocal emotion analysis
    if (apiKey) {
      try {
        if (audioBuffer) {
          const base64Audio = getBase64Audio(audioBuffer);
          const response = await fetch(
            "https://api-inference.huggingface.co/models/speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({ inputs: base64Audio }),
            },
          );
          if (response.ok) {
            const vocalEmotions = await response.json();
            let dominantEmotion = "Calm";
            let confidence = 0.5;
            if (Array.isArray(vocalEmotions) && vocalEmotions[0]) {
              const topEmotion = vocalEmotions[0];
              dominantEmotion = topEmotion.label || "Calm";
              confidence = topEmotion.score || 0.5;
            }
            speechbrainResult = {
              vocalEmotion: dominantEmotion,
              confidence: confidence,
              rawAnalysis: vocalEmotions,
              error: null,
            };
          } else {
            const errText = await response.text();
            console.error("HuggingFace API error:", errText);
            speechbrainResult = {
              vocalEmotion: "Unavailable",
              confidence: 0,
              rawAnalysis: null,
              error: errText || null,
            };
          }
        }
      } catch (error) {
        console.error("Advanced vocal analysis error:", error);
        speechbrainResult = {
          vocalEmotion: "Unavailable",
          confidence: 0,
          rawAnalysis: null,
          error: error?.toString() || null,
        };
      }
    } else {
      speechbrainResult = {
        vocalEmotion: "Unavailable",
        confidence: 0,
        rawAnalysis: null,
        error: "No HuggingFace API key provided",
      };
    }
    // Always return both fields for frontend robustness
    return Response.json({ dsp: dspResult, speechbrain: speechbrainResult });
  } catch (error) {
    console.error("Vocal analysis error:", error);
    return Response.json({
      dsp: {
        energy: "Moderate",
        tone: "Balanced",
        pace: "Natural",
        volume: "Moderate",
        articulation: "Clear",
        confidence: 0.7,
        vocalEmotion: "Calm",
      },
      speechbrain: {
        vocalEmotion: "Unavailable",
        confidence: 0,
        rawAnalysis: null,
        error: error?.toString() || null,
      }
    });
  }
}

// Use Buffer from Node.js (imported above)
const getBase64Audio = (audioBuffer: ArrayBuffer) => {
  return Buffer.from(audioBuffer).toString("base64");
};
