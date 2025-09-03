// API Route: Delete voice clone from ElevenLabs API
// Receives a POST request with voiceId and userId, deletes the voice clone
// Environment variables used (private, server-side only):
//   ELEVENLABS_API_KEY
//
// Returns: { success: boolean } on success, or { error: string } on failure.
//
export async function POST(request: Request) {
  try {
    const { voiceId, userId } = await request.json();
    
    if (!voiceId || !userId) {
      return Response.json({ error: "voiceId and userId required" }, { status: 400 });
    }
    
    // Delete from ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs voice deletion error:', errorText);
      throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
    }
    
    console.log('Voice clone deleted successfully:', voiceId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Voice clone deletion error:', error);
    return Response.json({ error: 'Failed to delete voice clone' }, { status: 500 });
  }
}
