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
import { resolveUserId } from '@/lib/account';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server configuration is missing');
  }
  return createClient(url, key);
}

const MAX_TRANSCRIPT_LENGTH = 20000;

// PATCH { id, userId, transcript, summary?, emotions?, vocal? }: correct the
// words of a saved reflection. Only the fields sent are changed, so the
// recording details saved with the original stay as they were.
export async function PATCH(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const resolved = await resolveUserId(request, body.userId);
    if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
    const userId = resolved.userId;

    if (typeof body.id !== 'string' || !body.id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const changes: Record<string, unknown> = {};
    if (body.transcript !== undefined) {
      const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
      if (!transcript || transcript.length > MAX_TRANSCRIPT_LENGTH) {
        return Response.json({ error: `A transcript of up to ${MAX_TRANSCRIPT_LENGTH} characters is required` }, { status: 400 });
      }
      changes.transcript = transcript;
    }
    if (typeof body.summary === 'string' && body.summary.trim()) changes.summary = body.summary.trim();
    if (Array.isArray(body.emotions)) changes.emotions = body.emotions;
    if (body.vocal && typeof body.vocal === 'object' && !Array.isArray(body.vocal)) changes.vocal = body.vocal;
    if (Object.keys(changes).length === 0) {
      return Response.json({ error: 'Nothing to change' }, { status: 400 });
    }

    const { data: found, error: findError } = await supabase
      .from('reflections')
      .select('user_id, device_info')
      .eq('id', body.id)
      .maybeSingle();
    if (findError) {
      console.error('Supabase lookup error:', findError.message);
      return Response.json({ error: 'Could not update the reflection' }, { status: 500 });
    }
    // Same answer whether the reflection is missing or someone else's.
    if (!found || found.user_id !== userId) {
      return Response.json({ error: 'Reflection not found' }, { status: 404 });
    }

    if (changes.transcript) {
      const deviceInfo = found.device_info && typeof found.device_info === 'object' ? found.device_info : {};
      changes.device_info = { ...deviceInfo, transcript_edited_at: new Date().toISOString() };
    }

    const { error } = await supabase
      .from('reflections')
      .update(changes)
      .eq('id', body.id)
      .eq('user_id', userId);
    if (error) {
      console.error('Supabase update error:', error.message);
      return Response.json({ error: 'Could not update the reflection' }, { status: 500 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error('API Error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Could not update the reflection' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    // Parse the incoming JSON body
    const body = await request.json();
    const { id, transcript, summary, emotions, vocal, recording_duration } = body;

    // The session decides whose history this is; the ID in the body is only
    // trusted while no session owns it.
    const resolved = await resolveUserId(request, body.userId);
    if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
    const userId = resolved.userId;

    // If only userId is provided, fetch reflection history
    if (userId && !transcript && !summary && !emotions && !vocal) {
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ reflections: data || [] });
    }

    if (typeof transcript !== 'string' || !transcript.trim()) {
      return Response.json({ error: 'A transcript is required' }, { status: 400 });
    }

    // A reflection is saved once right after the summary and again when the
    // emotion analysis finishes, and the client retries failed saves. All of
    // those carry the same id, so a repeat updates the row instead of failing.
    let existing: { user_id: string } | null = null;
    if (id) {
      const { data: found, error: findError } = await supabase
        .from('reflections')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();
      if (findError) {
        console.error('Supabase lookup error:', findError);
        return Response.json({ error: findError.message }, { status: 500 });
      }
      if (found && found.user_id !== userId) {
        return Response.json({ error: 'This reflection belongs to someone else' }, { status: 403 });
      }
      existing = found;
    }

    // Upsert user (create if not exists, update last_active if exists)
    const { error: userError } = await supabase.from('users').upsert([
      { id: userId, last_active: new Date() }
    ], { onConflict: 'id' });
    if (userError) console.error('Supabase user upsert error:', userError);

    const parentSessionId = body.device_info?.parent_session_id;
    const threadId = body.device_info?.thread_id;
    if (parentSessionId) {
      const { data: parent, error: parentError } = await supabase
        .from('reflections')
        .select('id, device_info, created_at')
        .eq('id', parentSessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (parentError || !parent) {
        return Response.json({ error: 'Follow-up parent does not exist for this user' }, { status: 400 });
      }
      if (new Date(parent.created_at).getTime() >= Date.now()) {
        return Response.json({ error: 'Follow-up parent must be older than the reflection' }, { status: 400 });
      }
      if (parent.device_info?.thread_id && threadId && parent.device_info.thread_id !== threadId) {
        return Response.json({ error: 'Follow-up and parent must share a thread ID' }, { status: 400 });
      }
    }

    // Insert reflection for this user with device info and service tracking
    const insertData = {
      ...(id ? { id } : {}),
      user_id: userId,
      transcript,
      summary,
      emotions,
      vocal,
      device_info: {
        ...(body.device_info || {}),
        recording_duration_seconds: recording_duration || 0
      },
      browser_info: body.browser_info || null,
      location_info: body.location_info || null,
      tts_service_used: body.tts_service_used || null,
      summary_service_used: body.summary_service_used || null,
    };

    // A retried save can arrive long after the recording, so keep the time
    // the reflection was made (never a future time).
    const madeAt = typeof body.created_at === 'string' ? new Date(body.created_at) : null;
    const createdAt = madeAt && !Number.isNaN(madeAt.getTime()) && madeAt.getTime() <= Date.now()
      ? { created_at: madeAt.toISOString() }
      : {};

    const { id: _id, ...updateData } = insertData as typeof insertData & { id?: string };
    const query = existing
      ? supabase.from('reflections').update(updateData).eq('id', id).eq('user_id', userId)
      : supabase.from('reflections').insert([{ ...insertData, ...createdAt }]);
    const { data: savedReflection, error } = await query
      .select('id, created_at, device_info')
      .single();

    if (error) {
      // Return error if insertion fails
      console.error('Supabase insert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Success response
    return Response.json({ success: true, reflection: savedReflection });
  } catch (error) {
    // Catch-all error handler
    console.error('API Error:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
