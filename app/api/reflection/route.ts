// API Route: Save user reflection to Supabase
// This route receives a POST request with userId, transcript, summary, emotions, and vocal data.
// It uses the Supabase service role key (private, server-side only) to upsert the user and insert the reflection.
// Environment variables used:
//   SUPABASE_URL (private, server-side only)
//   SUPABASE_SERVICE_ROLE_KEY (private, server-side only)
//
// Returns: { success: true } on success, or { error: ... } on failure.
//
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with private keys (never exposed to browser)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Parse the incoming JSON body
    const body = await request.json();
    const { userId, transcript, summary, emotions, vocal } = body;

    // If only userId is provided, fetch reflection history
    if (userId && !transcript && !summary && !emotions && !vocal) {
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ reflections: data || [] });
    }

    // Upsert user (create if not exists, update last_active if exists)
    await supabase.from('users').upsert([
      { id: userId, last_active: new Date() }
    ], { onConflict: 'id' });

    // Insert reflection for this user with device info and service tracking
    const { error } = await supabase.from('reflections').insert([
      {
        user_id: userId,
        transcript,
        summary,
        emotions,
        vocal,
        device_info: body.device_info || null,
        browser_info: body.browser_info || null,
        location_info: body.location_info || null,
        tts_service_used: body.tts_service_used || null,
        summary_service_used: body.summary_service_used || null,
      },
    ]);

    if (error) {
      // Return error if insertion fails
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Success response
    return Response.json({ success: true });
  } catch (error) {
    // Catch-all error handler
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 