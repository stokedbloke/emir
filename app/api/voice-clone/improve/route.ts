import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for improving/replacing existing voice clones
 * 
 * This endpoint implements a "replace" strategy rather than true improvement:
 * 1. Deletes the existing voice clone from ElevenLabs
 * 2. Creates a new voice clone with the latest audio data
 * 3. Returns the new voice clone ID
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
    const userId = formData.get('userId') as string;
    const voiceId = formData.get('voiceId') as string;

    if (!audio || !userId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, userId, or voiceId' },
        { status: 400 }
      );
    }

    console.log('API received formData keys:', Array.from(formData.keys()));
    console.log('API received audioBlob:', {
      exists: !!audio,
      size: audio.size,
      type: audio.type,
      constructor: audio.constructor.name
    });
    console.log('API received userId:', userId);
    console.log('API received voiceId:', voiceId);

    // First, delete the existing voice clone to prevent accumulation
    // This ensures we maintain only one voice clone per user
    console.log('Deleting existing voice clone:', voiceId);
    const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
    });

    if (!deleteResponse.ok) {
      const deleteError = await deleteResponse.text();
      console.error('Failed to delete existing voice clone:', deleteError);
      return NextResponse.json({ error: 'Failed to delete existing voice clone' }, { status: 500 });
    }

    console.log('Existing voice clone deleted successfully:', voiceId);

    // Convert audio to base64
    const audioBuffer = await audio.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    console.log('Audio blob size:', audioBuffer.byteLength, 'bytes');
    console.log('Audio blob type:', audio.type);
    console.log('Base64 audio length:', base64Audio.length);

    // Create FormData for ElevenLabs API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', `User Voice Clone - ${userId}`);
    elevenLabsFormData.append('description', `Improved voice clone for user ${userId}`);
    elevenLabsFormData.append('labels', JSON.stringify({ userId, improved: "true" }));
    
    // Convert base64 back to Blob for FormData
    const audioBlobForFormData = new Blob([audioBuffer], { type: audio.type });
    elevenLabsFormData.append('files', audioBlobForFormData, 'audio.webm');

    console.log('Sending to ElevenLabs (improve voice):', {
      url: 'https://api.elevenlabs.io/v1/voices/add',
      method: 'POST',
      headers: { 'xi-api-key': 'PRESENT', 'Content-Type': 'multipart/form-data' },
      formDataKeys: Array.from(elevenLabsFormData.keys())
    });

    // Call ElevenLabs API to improve the voice clone
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
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
    console.log('Voice clone improved successfully:', data);

    return NextResponse.json({
      success: true,
      voiceId: data.voice_id,
      message: 'Voice clone improved successfully'
    });

  } catch (error) {
    console.error('Error improving voice clone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
