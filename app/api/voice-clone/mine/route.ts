// API Route: which voice clone belongs to the caller?
// POST { userId } (plus the session token when there is one).
//
// The clone is found by its name in ElevenLabs, which is derived from the
// caller's history ID, so it follows the account to any device.
//
// Returns: { voiceId: string | null } or { error }.
import { ownClones } from '@/lib/voice-ownership';
import { resolveUserId } from '@/lib/account';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const resolved = await resolveUserId(request, body.userId);
    if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return Response.json({ error: 'ElevenLabs API key not configured' }, { status: 503 });

    const [newest] = await ownClones(resolved.userId, apiKey);
    return Response.json({ voiceId: newest?.voice_id ?? null });
  } catch (error) {
    console.error('Voice clone lookup error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Could not look up your voice clone' }, { status: 502 });
  }
}
