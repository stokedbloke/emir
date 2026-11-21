-- Journal prompts for VocalMirror. Run once in the Supabase SQL editor.
--
-- Prompts are suggestions shown on the record screen ("Tell me about ...").
-- The admin adds, edits, hides and deletes them from the admin tab.
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- No policies: only the server (service role) reads or writes this table.
alter table public.prompts enable row level security;

-- A few starters so the feature is visible straight away. Edit or delete them
-- in the admin tab. Skipped if the table already has prompts.
insert into public.prompts (text)
select starter from (values
  ('Tell me about a recent laugh you shared with a family member.'),
  ('What has been taking up the most room in your mind this week?'),
  ('Describe a moment today when you felt at ease.'),
  ('What is something you have been putting off, and what makes it hard to start?'),
  ('Who did you feel close to recently, and what happened?')
) as starters(starter)
where not exists (select 1 from public.prompts);
