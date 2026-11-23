// API Route: add an email and password to the caller's anonymous session.
// POST with Authorization: Bearer <Supabase session token> and { email, password }
//
// The same auth user keeps its history; it just gains a way to sign in from
// another device. The email is stored in Supabase Auth only. It is not verified
// by a confirmation message, so no outgoing email service is needed.
//
// Changing the password ends the session that made the request, so the browser
// signs in with the new password straight afterwards (see hooks/useAccount.ts).
//
// Returns: { email } or { error }.
import { adminClient, bearerToken, linkedUserId, userFromToken } from '@/lib/account';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    const user = token ? await userFromToken(token) : null;
    if (!user) return Response.json({ error: 'A valid session is required' }, { status: 401 });
    if (user.email) return Response.json({ error: 'This session already has an account' }, { status: 409 });
    if (!(await linkedUserId(user.authUserId))) {
      return Response.json({ error: 'Your session is not set up yet. Reload the page.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!EMAIL.test(email) || email.length > 254) {
      return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD || password.length > 72) {
      return Response.json({ error: `Use a password of at least ${MIN_PASSWORD} characters` }, { status: 400 });
    }

    const { error } = await adminClient().auth.admin.updateUserById(user.authUserId, {
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      if (error.code === 'weak_password') {
        return Response.json({ error: 'Choose a stronger password' }, { status: 400 });
      }
      // Supabase reports an email that is already in use only as a generic
      // update failure, so that is the most likely cause here.
      console.error('Account sign-up error:', error.code, error.message);
      return Response.json({
        error: 'Could not create the account. If you already have one with this email, sign in instead.',
      }, { status: 409 });
    }

    return Response.json({ email });
  } catch (error) {
    console.error('Account sign-up error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Could not create the account' }, { status: 500 });
  }
}
