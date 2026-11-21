-- Accounts for VocalMirror. Run once in the Supabase SQL editor.
--
-- Each browser gets a Supabase Auth user (anonymous at first, optionally given
-- an email and password later). This table says which reflection history
-- (reflections.user_id) that auth user owns. Once a history is linked here it
-- can only be read or written with that user's session, not with the bare ID.
--
-- Emails live in Supabase Auth only; they are never copied into this table or
-- into reflections.
create table if not exists public.account_links (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  user_id text not null unique,
  created_at timestamptz not null default now()
);

-- No policies: only the server (service role) reads or writes this table.
alter table public.account_links enable row level security;
