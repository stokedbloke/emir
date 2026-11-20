import { NextRequest, NextResponse } from 'next/server';
import { cloneNameFor, ownsClone } from '@/lib/voice-ownership';
import { resolveUserId } from '@/lib/account';

/**
 * API endpoint for improving/replacing existing voice clones
 *
 * This endpoint implements a "replace" strategy rather than true improvement:
 * 1. Confirms the existing clone belongs to the caller
 * 2. Creates a new voice clone with the latest audio data
 * 3. Deletes the old clone once the new one is confirmed
 * 4. Returns the new voice clone ID
 *
 * This approach ensures only one voice clone per user while allowing
 * "improvement" through fresh training on new audio samples.
 *
 * @param request - POST request containing audio file, userId, and voiceId
 * @returns JSON response with new voice clone ID or error details
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File;
    const resolved = await resolveUserId(request, formData.get('userId'));
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const userId = resolved.userId;
    const voiceId = formData.get('voiceId') as string;

    if (!audio || !userId || !voiceId || audio.size === 0) {
      return NextResponse.json(
        { error: 'A non-empty audio file, userId, and voiceId are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // The old clone is deleted below, so the caller must own it.
    if (!(await ownsClone(voiceId, userId, apiKey))) {
      return NextResponse.json({ error: 'This voice clone does not belong to you' }, { status: 403 });
    }

    // Create the replacement first. Deleting first can leave the user with no
    // usable clone when ElevenLabs rejects the new sample.
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', cloneNameFor(userId));
    elevenLabsFormData.append('description', 'VocalMirror user voice clone');
    elevenLabsFormData.append('files', new Blob([await audio.arrayBuffer()], { type: audio.type }), 'audio.webm');

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs voice improve API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to improve voice clone', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const newVoiceId = data.voice_id;
    if (typeof newVoiceId !== 'string' || !newVoiceId) {
      return NextResponse.json({ error: 'ElevenLabs returned no voice ID' }, { status: 502 });
    }

    // Only remove the old clone after the new clone is confirmed.
    const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });
    if (!deleteResponse.ok) {
      console.warn('Replacement created, but old clone could not be deleted:', await deleteResponse.text().catch(() => 'unknown error'));
    }

    return NextResponse.json({
      success: true,
      voiceId: newVoiceId,
      message: 'Voice clone replaced successfully'
    });

  } catch (error) {
    console.error('Error improving voice clone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
