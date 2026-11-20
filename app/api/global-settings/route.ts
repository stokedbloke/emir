// API Route: Global admin-controlled settings for summary and TTS services
//
// - GET: Returns the current global settings (summary_service, tts_service, etc.)
// - PATCH: Updates the global settings (admin only; requires the x-admin-secret header)
// - POST: Verifies an admin secret, so the UI can decide whether to show admin tools
//
// This enables all users to have a consistent experience, with settings managed by the admin.
//
// Security: the admin secret lives in the server-only ADMIN_SECRET env var. If it is
// not set, every admin request is refused.

import { createClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/voice-ownership';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server configuration is missing');
  }
  return createClient(url, key);
}

// GET: Fetch current global settings
export async function GET() {
  const supabase = getSupabase();
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
  if (!isAdminRequest(request)) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  const supabase = getSupabase();

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

// POST: Verify an admin secret without changing anything
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  return Response.json({ admin: true });
}
