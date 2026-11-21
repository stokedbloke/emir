// Server-only helpers for deciding who may see and use an ElevenLabs voice.
//
// User voice clones live in the shared ElevenLabs account. A clone's name is an
// opaque tag derived from the owner's user ID, so the name never reveals the ID
// but the server can still check a caller's claim of ownership against it.
import { createHash, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const CLONE_NAME_PREFIX = 'clone_';

export type ElevenLabsVoice = {
  voice_id: string;
  name?: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
};

/** Opaque, non-reversible name for a user's clone. */
export function cloneNameFor(userId: string): string {
  return CLONE_NAME_PREFIX + createHash('sha256').update(`emir-voice-clone:${userId}`).digest('hex').slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * True for any voice created through this app's cloning flow, whatever naming
 * scheme it was created under. These must never be listed to other users.
 * Voices the account owner added by hand in ElevenLabs are not matched.
 */
export function isUserClone(voice: ElevenLabsVoice): boolean {
  const name = voice.name || '';
  return (
    name.startsWith(CLONE_NAME_PREFIX) ||
    /^user_/i.test(name) ||
    /^User Voice Clone - /i.test(name) ||
    Boolean(voice.labels?.userId)
  );
}

/** Does this voice belong to the given user? Accepts current and legacy naming. */
export function isOwnedBy(voice: ElevenLabsVoice, userId: string): boolean {
  if (!userId) return false;
  const name = voice.name || '';
  if (safeEqual(name, cloneNameFor(userId))) return true;
  // Legacy names, from before clone names were made opaque.
  if (name.startsWith(`user_${userId}_`)) return true;
  if (safeEqual(name, `User Voice Clone - ${userId}`)) return true;
  if (voice.labels?.userId && safeEqual(voice.labels.userId, userId)) return true;
  return false;
}

/** Fetch one voice's metadata. Returns null when the voice does not exist. */
export async function fetchVoice(voiceId: string, apiKey: string): Promise<ElevenLabsVoice | null> {
  const response = await fetch(`${ELEVENLABS_API}/voices/${encodeURIComponent(voiceId)}`, {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`ElevenLabs voice lookup failed: ${response.status}`);
  }
  return (await response.json()) as ElevenLabsVoice;
}

type ListedVoice = ElevenLabsVoice & { created_at_unix?: number | null };

/** Every clone in the ElevenLabs account made for this user, newest first. */
export async function ownClones(userId: string, apiKey: string): Promise<ListedVoice[]> {
  if (!userId) return [];
  const response = await fetch(`${ELEVENLABS_API}/voices`, { headers: { 'xi-api-key': apiKey }, cache: 'no-store' });
  if (!response.ok) throw new Error(`ElevenLabs voice list failed: ${response.status}`);
  const voices: ListedVoice[] = (await response.json()).voices || [];
  return voices
    .filter((voice) => isUserClone(voice) && isOwnedBy(voice, userId))
    .sort((a, b) => (b.created_at_unix || 0) - (a.created_at_unix || 0));
}

export async function deleteVoice(voiceId: string, apiKey: string): Promise<boolean> {
  const response = await fetch(`${ELEVENLABS_API}/voices/${encodeURIComponent(voiceId)}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });
  return response.ok;
}

/**
 * Hands one history's clone to another, for when a browser's reflections are
 * merged into an account. An account keeps one clone: if it already has one,
 * the incoming clone is deleted (freeing its slot); otherwise the incoming
 * clone is renamed so it belongs to the account.
 */
export async function moveClone(fromUserId: string, toUserId: string, apiKey: string): Promise<'none' | 'moved' | 'dropped'> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return 'none';
  const incoming = await ownClones(fromUserId, apiKey);
  if (incoming.length === 0) return 'none';
  const [newest, ...older] = incoming;
  const accountHasClone = (await ownClones(toUserId, apiKey)).length > 0;
  for (const voice of accountHasClone ? incoming : older) await deleteVoice(voice.voice_id, apiKey);
  if (accountHasClone) return 'dropped';

  const form = new FormData();
  form.append('name', cloneNameFor(toUserId));
  const response = await fetch(`${ELEVENLABS_API}/voices/${encodeURIComponent(newest.voice_id)}/edit`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!response.ok) throw new Error(`ElevenLabs voice rename failed: ${response.status}`);
  return 'moved';
}

// The stock voice every user gets ("River"). Mirrors DEFAULT_VALUES.ELEVENLABS_VOICE_ID.
export const STOCK_VOICE_ID = 'SAz9YHcvj6GT2YYXdXww';

let sharedVoiceCache: { ids: Set<string>; expires: number } | null = null;

/**
 * Voices any visitor may play: the stock voice, plus whichever voice the admin
 * has set as the app-wide default. Cached briefly; if the settings table cannot
 * be read, only the stock voice is shared.
 */
export async function sharedVoiceIds(): Promise<Set<string>> {
  if (sharedVoiceCache && sharedVoiceCache.expires > Date.now()) return sharedVoiceCache.ids;
  const ids = new Set<string>([STOCK_VOICE_ID]);
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { data } = await createClient(url, key)
        .from('global_settings')
        .select('elevenlabs_voice_id')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.elevenlabs_voice_id) ids.add(data.elevenlabs_voice_id);
    }
  } catch (error) {
    console.warn('Could not read the app-wide default voice; sharing the stock voice only');
  }
  sharedVoiceCache = { ids, expires: Date.now() + 60_000 };
  return ids;
}

/**
 * May this caller use the voice?
 * - The admin may use every voice in the account.
 * - Everyone else may use the shared voices and a clone made for them, nothing else.
 */
export async function canUseVoice(
  voiceId: string,
  userId: string | undefined,
  apiKey: string,
  isAdmin = false,
): Promise<boolean> {
  if (isAdmin) return true;
  if ((await sharedVoiceIds()).has(voiceId)) return true;
  if (!userId) return false;
  const voice = await fetchVoice(voiceId, apiKey);
  return Boolean(voice && isUserClone(voice) && isOwnedBy(voice, userId));
}

/** True when the caller owns this clone. Used to gate replace and delete. */
export async function ownsClone(voiceId: string, userId: string, apiKey: string): Promise<boolean> {
  const voice = await fetchVoice(voiceId, apiKey);
  return Boolean(voice && isUserClone(voice) && isOwnedBy(voice, userId));
}

/** Shared admin check for routes that change global configuration. Fails closed. */
export function isAdminRequest(request: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  const provided = request.headers.get('x-admin-secret') || '';
  return Boolean(expected) && safeEqual(provided, expected as string);
}
