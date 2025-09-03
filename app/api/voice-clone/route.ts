// API Route: Create instant voice clone using ElevenLabs API
// Receives a POST request with audio blob and userId, returns voice ID for immediate use
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Returns: { voiceId: string, success: boolean } on success, or { error: string } on failure.
//
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    const userId = formData.get('userId') as string;
    
    console.log('API received formData keys:', Array.from(formData.keys()));
    console.log('API received audioBlob:', {
      exists: !!audioBlob,
      size: audioBlob?.size,
      type: audioBlob?.type,
      constructor: audioBlob?.constructor?.name
    });
    console.log('API received userId:', userId);
    
    if (!audioBlob || !userId) {
      return Response.json({ error: "Audio and userId required" }, { status: 400 });
    }

    // Convert audio to base64 for ElevenLabs API
    // ElevenLabs expects audio files to be sent as base64 strings
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    console.log('Audio blob size:', audioBlob.size, 'bytes');
    console.log('Audio blob type:', audioBlob.type);
    console.log('Base64 audio length:', base64Audio.length);
    
    // Try multipart/form-data approach
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', `user_${userId}_${Date.now()}`);
    elevenLabsFormData.append('description', `Voice clone for user ${userId}`);
    elevenLabsFormData.append('labels', JSON.stringify({
      "accent": "neutral",
      "description": "User voice clone",
      "category": "generated"
    }));
    
    // Convert base64 back to blob for FormData
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlobForFormData = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
    elevenLabsFormData.append('files', audioBlobForFormData, 'recording.webm');
    
    console.log('Sending to ElevenLabs (multipart):', {
      url: 'https://api.elevenlabs.io/v1/voices/add',
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY ? 'PRESENT' : 'MISSING',
        'Content-Type': 'multipart/form-data',
      },
      formDataKeys: Array.from(elevenLabsFormData.keys())
    });
    
    // Call ElevenLabs instant voice cloning API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        // Don't set Content-Type for FormData - let fetch set it automatically
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs voice clone API error:', errorText);
      throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Voice clone created successfully:', data);
    
    return Response.json({ 
      voiceId: data.voice_id,
      success: true 
    });
  } catch (error) {
    console.error('Voice clone error:', error);
    return Response.json({ error: 'Failed to create voice clone' }, { status: 500 });
  }
}
