// API Route: Delete voice clone from ElevenLabs API
// Receives a POST request with voiceId and userId, deletes the voice clone
// only when that clone was created for that user.
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Returns: { success: boolean } on success, or { error: string } on failure.
//
import { ownsClone } from '@/lib/voice-ownership';
import { resolveUserId } from '@/lib/account';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const voiceId = body.voiceId;
    const resolved = await resolveUserId(request, body.userId);
    if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
    const userId = resolved.userId;

    if (typeof voiceId !== 'string' || typeof userId !== 'string' || !voiceId || !userId) {
      return Response.json({ error: "voiceId and userId required" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
    }

    if (!(await ownsClone(voiceId, userId, apiKey))) {
      return Response.json({ error: "This voice clone does not belong to you" }, { status: 403 });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs voice deletion error:', errorText);
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Voice clone deletion error:', error);
    return Response.json({ error: 'Failed to delete voice clone' }, { status: 500 });
  }
}
