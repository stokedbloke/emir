// API Route: emotions heard in the voice (Valence AI discrete API).
// Receives { audioBlob } as a base64 data URL of a WAV clip: mono, 4.5 to 15
// seconds. Returns { emotions } strongest first (top 3, or ?limit=N).
// Environment variables used (private, server-side only):
//   VALENCE_API_KEY
//   VALENCE_API_BASE_URL (optional, defaults to https://api.getvalenceai.com)
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioBlob } = body;

    if (!audioBlob) {
      return NextResponse.json({
        emotions: [],
        fallback: true
      });
    }

    // [CHANGE: 2025-12-14] Added MIME type detection.
    // REASON: Previously hardcoded to 'audio/wav', which caused 500 errors if client sent 'audio/webm'.
    // Now detects actual format from base64 header.
    // RISK: Relies on correct data URL format.
    // Convert base64 to buffer and detect MIME type
    // [FIX 2025-12-14] Updated regex to handle MIME types with parameters (e.g. "audio/webm;codecs=opus")
    const matches = audioBlob.match(/^data:([^;]+)(?:;.*)?;base64,(.+)$/);
    let base64Data = audioBlob;
    let mimeType = 'audio/webm'; // Default for Chrome

    if (matches && matches.length >= 3) {
      mimeType = matches[1]; // Extract MIME type from data URL
      base64Data = matches[2];
    }

    const audioBuffer = Buffer.from(base64Data, 'base64');

    // Create Blob with detected MIME type
    const blob = new Blob([audioBuffer], { type: mimeType });

    // Use native FormData
    const formData = new FormData();
    formData.append('file', blob, `audio.${mimeType.split('/')[1]}`);

    // Valence's current address. The earlier AWS address this route used now
    // answers 503 for every request.
    const baseUrl = (process.env.VALENCE_API_BASE_URL || 'https://api.getvalenceai.com').replace(/\/+$/, '');
    const valenceUrl = `${baseUrl}/v1/discrete/emotion?model=7emotions`;

    const response = await fetch(valenceUrl, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VALENCE_API_KEY || '',
      },
      body: formData,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Valence API error: ${response.status}`, errorText);
      return NextResponse.json({
        emotions: [],
        fallback: true
      });
    }

    const result = await response.json();

    if (result.error) {
      console.error('Valence API returned error:', result.error);
      return NextResponse.json({
        emotions: [],
        fallback: true,
        error: result.error
      });
    }

    // [CHANGE: 2025-12-14] Added 'limit' query parameter.
    // REASON: Allows flexibility to request all 7 emotions (limit=7) for testing/curl, while defaulting to 3 for UI.
    // RISK: None.
    // Parse limit from query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    let limit = 3; // Default to top 3

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    // Transform to expected format
    if (result.all_predictions) {
      const emotions = Object.entries(result.all_predictions)
        .map(([emotion, confidence]) => ({
          emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          confidence: confidence as number,
        }))
        .sort((a, b) => b.confidence - a.confidence)
        // [CHANGE: 2025-12-14] Usage of limit parameter
        .slice(0, limit);

      return NextResponse.json({ emotions });
    } else {
      console.warn('Valence response missing all_predictions field');
      return NextResponse.json({ emotions: [], fallback: true });
    }

  } catch (error) {
    console.error("Valence API route error:", error);
    return NextResponse.json({
      emotions: [],
      fallback: true
    });
  }
}
