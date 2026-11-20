// API Route: Generate speech audio from text using ElevenLabs Text-to-Speech API
// Receives a POST request with { text, voiceId, userId } and returns audio (audio/mpeg).
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Visitors may only use the shared stock voice or a clone made for them (userId
// must be the clone's owner). The admin (x-admin-secret header) may use any voice.
//
// Returns: audio/mpeg stream on success, or { error: ... } on failure.
//
import { canUseVoice, isAdminRequest } from '@/lib/voice-ownership';
import { resolveUserId } from '@/lib/account';

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, voiceId = "SAz9YHcvj6GT2YYXdXww" } = body
    // Without a verified identity the stock voice still plays; only clones need one.
    const resolved = await resolveUserId(request, body.userId)
    const userId = resolved.ok ? resolved.userId : undefined

    if (typeof text !== "string" || !text.trim() || typeof voiceId !== "string" || !voiceId.trim()) {
      return Response.json({ error: "Text and a valid voiceId are required" }, { status: 400 })
    }

    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      console.error("ElevenLabs API key missing!");
      return Response.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    const allowed = await canUseVoice(voiceId, userId, elevenlabsApiKey, isAdminRequest(request));
    if (!allowed) {
      return Response.json({ error: "This voice is not available to you" }, { status: 403 })
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": elevenlabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs API error response:', errorText);
      throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (err) {
    console.warn("Falling back to browser TTS: ElevenLabs TTS error:", err);
    return Response.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}
