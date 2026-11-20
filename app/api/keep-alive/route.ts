// API Route: daily keep-alive for the Supabase project.
// Supabase pauses free projects that see no activity for about a week, and a
// paused project silently drops every save. Vercel Cron (see vercel.json) calls
// this once a day; it runs one tiny read so the project always counts as active.
//
// If CRON_SECRET is set in Vercel, Vercel sends it as a bearer token and any
// other caller is refused. Without it the route stays open, which is harmless:
// it returns no data.
//
// Returns: { ok: true } on success, or { ok: false, error } with status 500.
//
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: 'Supabase server configuration is missing' }, { status: 500 });
  }

  try {
    const { error } = await createClient(url, key).from('global_settings').select('id').limit(1);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
