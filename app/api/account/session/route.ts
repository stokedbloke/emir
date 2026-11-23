// API Route: set up the caller's session.
// POST with Authorization: Bearer <Supabase session token> and
//   { legacyId?: string, mergeFromToken?: string }
//
// - Returns the history ID this session owns, creating the link on first use.
//   A browser that already had a bare ID (legacyId) keeps its history, unless
//   another session claimed that ID first.
// - mergeFromToken: after signing in to an account on a device that already
//   had anonymous reflections, moves those reflections into the account. A
//   voice clone made in that browser moves too, unless the account has one.
//
// Returns: { userId, email } or { error }. 503 with error "accounts_not_set_up"
// means supabase/account_links.sql has not been run; the app then keeps
// working with the bare ID as before.
import { AccountsNotSetUp, adminClient, bearerToken, isClaimed, linkedUserId, userFromToken } from '@/lib/account';
import { moveClone } from '@/lib/voice-ownership';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    const user = token ? await userFromToken(token) : null;
    if (!user) return Response.json({ error: 'A valid session is required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const supabase = adminClient();

    let userId = await linkedUserId(user.authUserId);
    if (!userId) {
      // Only a session without an email may claim a bare ID; an account always
      // has its link already.
      const legacyId = typeof body.legacyId === 'string' && UUID.test(body.legacyId) ? body.legacyId : null;
      const candidate = legacyId && !user.email && !(await isClaimed(legacyId)) ? legacyId : user.authUserId;
      let { error } = await supabase.from('account_links').insert({ auth_user_id: user.authUserId, user_id: candidate });
      userId = candidate;
      if (error && candidate !== user.authUserId) {
        // Lost a race for the legacy ID: start a fresh history instead.
        ({ error } = await supabase.from('account_links').insert({ auth_user_id: user.authUserId, user_id: user.authUserId }));
        userId = user.authUserId;
      }
      if (error) {
        // Another request for this same session created the link first.
        userId = await linkedUserId(user.authUserId);
        if (!userId) throw new Error(error.message);
      }
    }

    let merged = 0;
    if (typeof body.mergeFromToken === 'string' && body.mergeFromToken && user.email) {
      const previous = await userFromToken(body.mergeFromToken);
      if (previous && !previous.email && previous.authUserId !== user.authUserId) {
        const previousUserId = await linkedUserId(previous.authUserId);
        if (previousUserId && previousUserId !== userId) {
          await supabase.from('users').upsert([{ id: userId, last_active: new Date() }], { onConflict: 'id' });
          const { data, error } = await supabase.from('reflections').update({ user_id: userId }).eq('user_id', previousUserId).select('id');
          if (error) throw new Error(error.message);
          merged = data?.length ?? 0;
          // The voice clone follows the reflections. A failure here must not
          // undo the sign-in; the clone is simply left where it was.
          const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
          if (elevenLabsKey) {
            await moveClone(previousUserId, userId as string, elevenLabsKey).catch((cloneError) => {
              console.error('Could not move the voice clone:', cloneError instanceof Error ? cloneError.message : cloneError);
            });
          }
          // The anonymous session is finished; removing it also removes its link.
          await supabase.auth.admin.deleteUser(previous.authUserId);
        }
      }
    }

    return Response.json({ userId, email: user.email, merged });
  } catch (error) {
    if (error instanceof AccountsNotSetUp) {
      return Response.json({ error: 'accounts_not_set_up' }, { status: 503 });
    }
    console.error('Account session error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Could not set up your session' }, { status: 500 });
  }
}
