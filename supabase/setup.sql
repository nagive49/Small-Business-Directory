-- =====================================================================
-- Elkhart County Small Business Directory — database setup
--
-- Paste this whole file into Supabase: SQL Editor → New query → Run.
-- It is safe to run more than once.
--
-- After it runs, make yourself an admin by running ONE more line in a
-- new query (use the email you will log in with):
--
--   insert into public.admins (email) values ('you@example.com');
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'hidden')),
  -- The email address the owner logs in with. Never shown publicly.
  owner_email text,
  name        text not null check (length(trim(name)) > 0),
  category    text,
  description text,
  town        text,
  address     text,
  phone       text,
  email       text,   -- public contact email (optional, shown on listing)
  facebook    text,
  instagram   text,
  website     text,
  hours       text,
  prices      text,   -- prices, menu, specials (free text)
  logo_url    text,
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists businesses_owner_email_idx on public.businesses (lower(owner_email));
create index if not exists businesses_status_idx on public.businesses (status);

-- People allowed to approve listings and edit any business.
create table if not exists public.admins (
  email text primary key
);

-- ---------- Helper functions ----------

create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = public.current_email())
$$;

-- Owners can edit their listing details, but only admins can approve,
-- hide, or change who owns a listing.
create or replace function public.protect_business_fields()
returns trigger language plpgsql set search_path = public as $$
declare
  -- Website visitors run as "anon" or "authenticated". Anything else is you
  -- working directly in the Supabase dashboard, which is trusted.
  privileged boolean := current_user not in ('anon', 'authenticated') or public.is_admin();
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.status := 'pending';
      new.owner_email := public.current_email();
    end if;
    new.created_at := now();
  else
    if not privileged then
      new.status := old.status;
      new.owner_email := old.owner_email;
    end if;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.owner_email := nullif(lower(trim(new.owner_email)), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_protect on public.businesses;
create trigger businesses_protect
  before insert or update on public.businesses
  for each row execute function public.protect_business_fields();

-- ---------- Row level security ----------

alter table public.businesses enable row level security;
alter table public.admins enable row level security;  -- no policies: only is_admin() reads it

drop policy if exists "owners and admins can read" on public.businesses;
create policy "owners and admins can read" on public.businesses
  for select to authenticated
  using (lower(owner_email) = public.current_email() or public.is_admin());

drop policy if exists "signed-in users can submit" on public.businesses;
create policy "signed-in users can submit" on public.businesses
  for insert to authenticated
  with check (public.current_email() <> '');

drop policy if exists "owners and admins can update" on public.businesses;
create policy "owners and admins can update" on public.businesses
  for update to authenticated
  using (lower(owner_email) = public.current_email() or public.is_admin())
  with check (lower(owner_email) = public.current_email() or public.is_admin());

drop policy if exists "admins can delete" on public.businesses;
create policy "admins can delete" on public.businesses
  for delete to authenticated
  using (public.is_admin());

revoke all on public.businesses from anon;
revoke all on public.admins from anon, authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Public view (what the website shows everyone) ----------
-- Only approved listings, and never the owner's login email.

drop view if exists public.directory;
create view public.directory as
  select id, name, category, description, town, address, phone, email,
         facebook, instagram, website, hours, prices, logo_url, cover_url, updated_at
  from public.businesses
  where status = 'approved';

grant select on public.directory to anon, authenticated;

-- ---------- Photo storage ----------
-- Public bucket; each signed-in user may only upload into their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-photos', 'business-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users manage own photos" on storage.objects;
create policy "users manage own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- First listing ----------

insert into public.businesses (status, name, category, description, town, facebook)
select 'approved', 'The Mad Batter', 'Food & Drink',
       'Fresh, whimsical lemonades with edible glitter, boba, and candy.',
       'New Paris', 'https://www.facebook.com/profile.php?id=61561729977770'
where not exists (select 1 from public.businesses where name = 'The Mad Batter');
