// API Route: Global admin-controlled settings for summary and TTS services
//
// - GET: Returns the current global settings (summary_service, tts_service, etc.)
// - PATCH: Updates the global settings (admin only; add authentication in production)
//
// This enables all users to have a consistent experience, with settings managed by the admin.
//
// Security: Only allow PATCH from admin UI. Add authentication/authorization for production use.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch current global settings
export async function GET() {
  const { data, error } = await supabase
    .from('global_settings')
    .select('*')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ settings: data });
}

// PATCH: Update global settings (admin only)
export async function PATCH(request: Request) {
  // Only allow admin (add your own auth check here if needed)
  // For now, assume only admin UI calls this route

  const body = await request.json();
  // Only allow updating known fields
  const allowedFields = [
    "summary_service",
    "tts_service",
    "elevenlabs_voice_id",
    "google_lang",
    "google_gender",
    "hume_voice"
  ];
  const update: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { error } = await supabase
    .from('global_settings')
    .update(update)
    .eq('id', 1); // assuming only one row

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}