// One-off migration: give every existing user voice clone in ElevenLabs an opaque
// name, so no clone name or label contains a user ID any more.
//
// Dry run (default, changes nothing):
//   node --env-file=.env.local scripts/rename-voice-clones.mjs
// Apply:
//   node --env-file=.env.local scripts/rename-voice-clones.mjs --apply
//
// Clones whose owner cannot be recovered from the old name are reported and left
// alone; delete those by hand in ElevenLabs if nobody claims them.
import { createHash } from 'node:crypto';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const API = 'https://api.elevenlabs.io/v1';

// Must match cloneNameFor() in lib/voice-ownership.ts
const cloneNameFor = (userId) =>
  'clone_' + createHash('sha256').update(`emir-voice-clone:${userId}`).digest('hex').slice(0, 32);

const ownerOf = (voice) => {
  const name = voice.name || '';
  const fromUnderscore = name.match(/^user_(.+)_\d+$/i);
  if (fromUnderscore) return fromUnderscore[1];
  const fromImproved = name.match(/^User Voice Clone - (.+)$/i);
  if (fromImproved) return fromImproved[1];
  return voice.labels?.userId || null;
};
const isLegacyClone = (voice) =>
  /^user_/i.test(voice.name || '') || /^User Voice Clone - /i.test(voice.name || '') || Boolean(voice.labels?.userId);

const listResponse = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey } });
if (!listResponse.ok) {
  console.error('Could not list voices:', listResponse.status);
  process.exit(1);
}
const { voices = [] } = await listResponse.json();
const legacy = voices.filter(isLegacyClone);
console.log(`${voices.length} voices in the account, ${legacy.length} legacy user clones to rename.`);

let renamed = 0;
let skipped = 0;
for (const voice of legacy) {
  const owner = ownerOf(voice);
  if (!owner) {
    console.log(`SKIP  ${voice.voice_id}: owner not recoverable from its name`);
    skipped++;
    continue;
  }
  const newName = cloneNameFor(owner);
  if (!apply) {
    console.log(`WOULD RENAME  ${voice.voice_id} -> ${newName}`);
    continue;
  }
  const form = new FormData();
  form.append('name', newName);
  form.append('description', 'VocalMirror user voice clone');
  form.append('labels', '{}');
  const response = await fetch(`${API}/voices/${voice.voice_id}/edit`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (response.ok) {
    console.log(`RENAMED  ${voice.voice_id} -> ${newName}`);
    renamed++;
  } else {
    console.log(`FAILED  ${voice.voice_id}: ${response.status} ${await response.text().catch(() => '')}`);
    skipped++;
  }
}
console.log(apply ? `Done. Renamed ${renamed}, skipped or failed ${skipped}.` : 'Dry run only. Re-run with --apply to rename.');
