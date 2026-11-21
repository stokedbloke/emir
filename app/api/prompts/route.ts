// API Route: journal prompts (suggestions shown on the record screen).
//
// - GET: active prompts for everyone. With the x-admin-secret header, all
//   prompts including hidden ones.
// - POST { text }: add a prompt (admin).
// - PATCH { id, text?, active? }: edit or show/hide a prompt (admin).
// - DELETE { id }: remove a prompt (admin).
//
// Until supabase/prompts.sql has been run, GET returns an empty list with
// setupRequired: true and the record screen simply shows no suggestion.
import { adminClient } from '@/lib/account';
import { isAdminRequest } from '@/lib/voice-ownership';

const MAX_LENGTH = 300;

const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205';

const cleanText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text && text.length <= MAX_LENGTH ? text : null;
};

const forbidden = () => Response.json({ error: 'Forbidden: Admins only' }, { status: 403 });
// A write to a missing table comes back as a bare 404 with no error code.
const failed = (error: { code?: string; message?: string }, status?: number) => {
  if (isMissingTable(error) || (status === 404 && !error.code)) {
    return Response.json({ error: 'Journal prompts are not set up yet. Run supabase/prompts.sql in Supabase.' }, { status: 503 });
  }
  console.error('Prompts error:', error.message);
  return Response.json({ error: 'Could not update prompts' }, { status: 500 });
};

export async function GET(request: Request) {
  try {
    const isAdmin = isAdminRequest(request);
    let query = adminClient().from('prompts').select('id, text, active, created_at').order('created_at', { ascending: true });
    if (!isAdmin) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return Response.json({ prompts: [], setupRequired: true });
      throw new Error(error.message);
    }
    const prompts = isAdmin ? data : (data || []).map(({ id, text }) => ({ id, text }));
    return Response.json({ prompts: prompts || [] });
  } catch (error) {
    console.error('Prompts fetch error:', error instanceof Error ? error.message : error);
    return Response.json({ prompts: [] });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return forbidden();
  const body = await request.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (!text) return Response.json({ error: `Enter a prompt of up to ${MAX_LENGTH} characters` }, { status: 400 });
  const { data, error, status } = await adminClient().from('prompts').insert({ text }).select('id, text, active, created_at').single();
  return error ? failed(error, status) : Response.json({ prompt: data });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return forbidden();
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'id is required' }, { status: 400 });
  const changes: { text?: string; active?: boolean } = {};
  if (body.text !== undefined) {
    const text = cleanText(body.text);
    if (!text) return Response.json({ error: `Enter a prompt of up to ${MAX_LENGTH} characters` }, { status: 400 });
    changes.text = text;
  }
  if (typeof body.active === 'boolean') changes.active = body.active;
  if (Object.keys(changes).length === 0) return Response.json({ error: 'Nothing to change' }, { status: 400 });
  const { data, error, status } = await adminClient().from('prompts').update(changes).eq('id', body.id).select('id, text, active, created_at').maybeSingle();
  if (error) return failed(error, status);
  return data ? Response.json({ prompt: data }) : Response.json({ error: 'Prompt not found' }, { status: 404 });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return forbidden();
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'id is required' }, { status: 400 });
  const { error, status } = await adminClient().from('prompts').delete().eq('id', body.id);
  return error ? failed(error, status) : Response.json({ success: true });
}
