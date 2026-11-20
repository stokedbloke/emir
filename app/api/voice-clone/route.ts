// API Route: Create instant voice clone using ElevenLabs API
// Receives a POST request with audio blob and userId, returns voice ID for immediate use
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// The clone is stored under an opaque name derived from the user ID, so the
// ElevenLabs voice list never contains a user ID.
//
// Returns: { voiceId: string, success: boolean } on success, or { error: string } on failure.
//
import { cloneNameFor } from '@/lib/voice-ownership';
import { resolveUserId } from '@/lib/account';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    const resolved = await resolveUserId(request, formData.get('userId'));
    if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
    const userId = resolved.userId;

    if (!audioBlob || !userId || typeof (audioBlob as Blob).arrayBuffer !== 'function' || audioBlob.size === 0) {
      return Response.json({ error: "A non-empty audio file and userId are required" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
    }

    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', cloneNameFor(userId));
    elevenLabsFormData.append('description', 'VocalMirror user voice clone');
    elevenLabsFormData.append('files', new Blob([await audioBlob.arrayBuffer()], { type: audioBlob.type || 'audio/webm;codecs=opus' }), 'recording.webm');

    // Don't set Content-Type for FormData - fetch sets the multipart boundary itself
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs voice clone API error:', errorText);
      throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return Response.json({
      voiceId: data.voice_id,
      success: true
    });
  } catch (error) {
    console.error('Voice clone error:', error);
    return Response.json({
      error: 'Failed to create voice clone',
      details: error instanceof Error ? error.message : 'Unknown ElevenLabs error',
    }, { status: 500 });
  }
}
