// Who this browser is.
//
// Every browser silently gets an anonymous Supabase session, so its history is
// tied to a signed token rather than to a bare ID anyone could copy. Nothing is
// asked of the person. Later they may add an email and password (signUp) to
// reach the same history from another device (signIn).
//
// If sessions are not available (anonymous sign-ins turned off, the accounts
// table missing, or the network down) the app falls back to the bare ID kept in
// this browser, exactly as it worked before accounts existed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabaseBrowser } from '@/lib/supabase-browser';

const USER_ID_KEY = 'em-user-id';
const SESSION_ENDPOINT = '/api/account/session';
const SIGNUP_ENDPOINT = '/api/account/signup';
const START_TIMEOUT_MS = 8000;

type Result = { ok: true } | { ok: false; error: string };

const pendingKey = (userId: string) => `em-pending-reflections-${userId}`;

// Unsaved reflections are queued per history ID; carry them over when the ID changes.
function movePendingReflections(from: string, to: string) {
  try {
    const waiting = JSON.parse(localStorage.getItem(pendingKey(from)) || '[]');
    if (!Array.isArray(waiting) || waiting.length === 0) return;
    const existing = JSON.parse(localStorage.getItem(pendingKey(to)) || '[]');
    const moved = waiting.map((item: any) => ({ ...item, userId: to }));
    localStorage.setItem(pendingKey(to), JSON.stringify([...(Array.isArray(existing) ? existing : []), ...moved]));
    localStorage.removeItem(pendingKey(from));
  } catch (error) {
    console.error('Could not carry over unsaved reflections:', error);
  }
}

export function useAccount() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  // True when this browser has a working session, so account features can be offered.
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const started = useRef(false);

  const accessToken = useCallback(async (): Promise<string | null> => {
    const supabase = supabaseBrowser();
    if (!supabase) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  // Header that proves this browser's identity to the API routes.
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await accessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [accessToken]);

  const openSession = useCallback(async (extra: Record<string, unknown> = {}) => {
    const token = await accessToken();
    if (!token) return null;
    const response = await fetch(SESSION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ legacyId: localStorage.getItem(USER_ID_KEY), ...extra }),
    });
    if (!response.ok) return null;
    return (await response.json()) as { userId: string; email: string | null };
  }, [accessToken]);

  const start = useCallback(async () => {
    const useBareId = () => {
      let id = localStorage.getItem(USER_ID_KEY);
      if (!id) {
        id = uuidv4();
        localStorage.setItem(USER_ID_KEY, id);
      }
      setAccountsAvailable(false);
      setEmail(null);
      setUserId(id);
    };

    const supabase = supabaseBrowser();
    if (!supabase) return useBareId();

    try {
      const session = await Promise.race([
        (async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) return null;
          }
          return openSession();
        })(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), START_TIMEOUT_MS)),
      ]);
      if (!session) return useBareId();
      localStorage.setItem(USER_ID_KEY, session.userId);
      setAccountsAvailable(true);
      setEmail(session.email);
      setUserId(session.userId);
    } catch (error) {
      console.warn('Session unavailable, continuing with this browser only:', error);
      useBareId();
    }
  }, [openSession]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  // Adds an email and password to this browser's session. The history stays the same.
  const signUp = useCallback(async (newEmail: string, password: string): Promise<Result> => {
    try {
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ email: newEmail, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: data.error || 'Could not create the account' };
      // Setting a password ends the anonymous session, so sign in with it now.
      // It is the same user, so the history is unchanged.
      const signedIn = await supabaseBrowser()?.auth.signInWithPassword({ email: data.email, password });
      if (!signedIn || signedIn.error) {
        return { ok: false, error: 'Your account was created. Sign in with your email and password to continue.' };
      }
      setEmail(data.email);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server. Try again.' };
    }
  }, [authHeaders]);

  // Signs in to an existing account. Reflections made in this browser before
  // signing in are moved into the account.
  const signIn = useCallback(async (existingEmail: string, password: string): Promise<Result> => {
    const supabase = supabaseBrowser();
    if (!supabase) return { ok: false, error: 'Sign-in is not available right now' };
    try {
      const previousToken = email ? null : await accessToken();
      const previousUserId = userId;
      const { error } = await supabase.auth.signInWithPassword({ email: existingEmail.trim().toLowerCase(), password });
      if (error) {
        return { ok: false, error: /invalid/i.test(error.message) ? 'That email and password do not match an account' : error.message };
      }
      const session = await openSession({ legacyId: null, mergeFromToken: previousToken });
      if (!session) return { ok: false, error: 'Signed in, but your history could not be loaded. Reload the page.' };
      if (previousUserId && previousUserId !== session.userId) movePendingReflections(previousUserId, session.userId);
      localStorage.setItem(USER_ID_KEY, session.userId);
      setEmail(session.email);
      setUserId(session.userId);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server. Try again.' };
    }
  }, [accessToken, email, openSession, userId]);

  // Signs out and gives this browser a fresh, empty anonymous session.
  const signOut = useCallback(async () => {
    await supabaseBrowser()?.auth.signOut().catch(() => undefined);
    localStorage.removeItem(USER_ID_KEY);
    setEmail(null);
    setUserId('');
    await start();
  }, [start]);

  return { userId, email, accountsAvailable, authHeaders, signUp, signIn, signOut };
}
