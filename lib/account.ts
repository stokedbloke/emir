// Server-side identity for API routes.
//
// A browser proves who it is with a Supabase Auth session token (anonymous at
// first; an email and password can be added later). The account_links table
// maps that auth user to the history ID used in reflections.user_id.
//
// Histories made before sessions existed are keyed by a bare ID kept in the
// browser. The first session to present such an ID claims it; from then on the
// bare ID alone is refused. IDs nobody has claimed yet keep working as before.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  if (!cached) cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export type SessionUser = { authUserId: string; email: string | null };

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() || null : null;
}

export async function userFromToken(token: string): Promise<SessionUser | null> {
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { authUserId: data.user.id, email: data.user.email || null };
}

// Thrown when supabase/account_links.sql has not been run yet.
export class AccountsNotSetUp extends Error {}

const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205' || /account_links/.test(error.message || '') && /not find|does not exist/.test(error.message || '');

export async function linkedUserId(authUserId: string): Promise<string | null> {
  const { data, error } = await adminClient().from('account_links').select('user_id').eq('auth_user_id', authUserId).maybeSingle();
  if (error) throw isMissingTable(error) ? new AccountsNotSetUp() : new Error(error.message);
  return data?.user_id ?? null;
}

export async function isClaimed(userId: string): Promise<boolean> {
  const { data, error } = await adminClient().from('account_links').select('auth_user_id').eq('user_id', userId).maybeSingle();
  if (error) throw isMissingTable(error) ? new AccountsNotSetUp() : new Error(error.message);
  return Boolean(data);
}

export type Resolved = { ok: true; userId: string } | { ok: false; status: number; error: string };

// Works out whose data a request may touch. `claimedUserId` is the ID the
// browser sent in the body; it is only trusted when no session owns it.
export async function resolveUserId(request: Request, claimedUserId: unknown): Promise<Resolved> {
  const claimed = typeof claimedUserId === 'string' && claimedUserId ? claimedUserId : null;
  try {
    const token = bearerToken(request);
    if (token) {
      const user = await userFromToken(token);
      if (!user) return { ok: false, status: 401, error: 'Your session has expired. Reload the page.' };
      const userId = await linkedUserId(user.authUserId);
      if (!userId) return { ok: false, status: 401, error: 'Your session is not set up yet. Reload the page.' };
      return { ok: true, userId };
    }
    if (!claimed) return { ok: false, status: 400, error: 'userId is required' };
    if (await isClaimed(claimed)) {
      return { ok: false, status: 401, error: 'This history belongs to a signed-in session.' };
    }
    return { ok: true, userId: claimed };
  } catch (error) {
    if (error instanceof AccountsNotSetUp && claimed) return { ok: true, userId: claimed };
    console.error('Could not resolve user:', error instanceof Error ? error.message : error);
    return { ok: false, status: 500, error: 'Could not verify your session' };
  }
}
