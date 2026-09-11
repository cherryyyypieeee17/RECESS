-- Run this in Supabase Studio: Project > SQL Editor > New query

-- Owner email gets moderation powers (removing any post). Change this to
-- your own email before running.
create or replace function public.is_owner_email(check_email text)
returns boolean as $$
  select check_email = 'cherryyyypieeee17@gmail.com';
$$ language sql immutable;

create table if not exists public.statuses (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  vibe text not null check (vibe in ('coffee', 'walk', 'study', 'talk', 'lunch', 'gym')),
  zone text not null,
  duration_min int not null,
  note text,
  posted_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.statuses enable row level security;

-- Anyone signed in can see everyone's active status (that's the point of the board)
create policy "Statuses are readable by any signed-in user"
  on public.statuses for select
  to authenticated
  using (true);

-- You can only create/edit/delete your own row
create policy "Users manage their own status - insert"
  on public.statuses for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users manage their own status - update"
  on public.statuses for update
  to authenticated
  using (auth.uid() = id);

create policy "Users manage their own status - delete"
  on public.statuses for delete
  to authenticated
  using (
    auth.uid() = id
    or public.is_owner_email((select email from auth.users where id = auth.uid()))
  );

-- Optional: automatically delete expired rows older than a day, run on a schedule
-- (Supabase > Database > Cron, or call this from an edge function)
create or replace function public.cleanup_expired_statuses()
returns void as $$
  delete from public.statuses where expires_at < now() - interval '1 day';
$$ language sql security definer;
