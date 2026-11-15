-- Peloton AI — initial schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.
--
-- Note: the spec's `users` table is implemented as `public.profiles`, keyed 1:1 to
-- `auth.users` (Supabase Auth owns credentials; profiles own public identity).

create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────── enums
do $$ begin
  create type visibility as enum ('public', 'friends', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_category as enum ('restaurant', 'coffee', 'cafe', 'bakery', 'bar');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────── profiles (users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  full_name text not null default '',
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  location text,
  profile_visibility visibility not null default 'public',
  saved_visibility visibility not null default 'friends',
  reviews_visibility visibility not null default 'public',
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────── places
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  address text not null default '',
  city text not null default '',
  neighborhood text,
  latitude double precision not null,
  longitude double precision not null,
  category place_category not null default 'restaurant',
  cuisine text,
  image_url text,
  website text,
  phone text,
  opening_hours text[],
  price_level smallint check (price_level between 1 and 4),
  description text,
  -- External Google rating, cached for display. Never mixed with Peloton ratings.
  google_rating numeric(2,1),
  google_rating_count integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists places_city_idx on public.places (city);
create index if not exists places_category_idx on public.places (category);
create index if not exists places_geo_idx on public.places (latitude, longitude);

-- ───────────────────────────────────────────────────────────── reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  overall_rating numeric(2,1) not null check (overall_rating between 1 and 5 and overall_rating * 2 = floor(overall_rating * 2)),
  food_rating numeric(2,1) check (food_rating between 1 and 5),
  drinks_rating numeric(2,1) check (drinks_rating between 1 and 5),
  atmosphere_rating numeric(2,1) check (atmosphere_rating between 1 and 5),
  service_rating numeric(2,1) check (service_rating between 1 and 5),
  value_rating numeric(2,1) check (value_rating between 1 and 5),
  review_text text not null default '' check (char_length(review_text) <= 4000),
  visited_on date,
  price_level smallint check (price_level between 1 and 4),
  recommended_items text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One active rating per user per place; edits update the row.
  unique (user_id, place_id)
);
create index if not exists reviews_place_idx on public.reviews (place_id);
create index if not exists reviews_user_idx on public.reviews (user_id, created_at desc);

create table if not exists public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists review_photos_review_idx on public.review_photos (review_id);

-- ───────────────────────────────────────────────────────────── social graph
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
-- One friendship row per unordered pair.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ───────────────────────────────────────────────────────────── collections & saves
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  cover_image text,
  visibility visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collections_user_idx on public.collections (user_id);

create table if not exists public.collection_places (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position integer not null default 0,
  unique (collection_id, place_id)
);
create index if not exists collection_places_order_idx on public.collection_places (collection_id, position);

create table if not exists public.collection_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, collection_id)
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create table if not exists public.place_recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  check (place_id is not null or collection_id is not null)
);
create index if not exists recs_receiver_idx on public.place_recommendations (receiver_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('friend_request','friend_accepted','new_follower','recommendation','collection_follow')),
  reference_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

-- ───────────────────────────────────────────────────────────── helpers
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.can_view(owner uuid, vis visibility)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or vis = 'public'
      or (vis = 'friends' and public.are_friends(owner, auth.uid()));
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();
drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_.]', '', 'g'));
begin
  if char_length(base) < 3 then base := base || 'user'; end if;
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    left(base, 24) || case when exists (select 1 from profiles where username = left(base, 24)) then '_' || substr(new.id::text, 1, 4) else '' end,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Notifications are written by triggers (security definer), never directly by clients.
create or replace function public.notify_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (user_id, actor_id, type, reference_id) values (new.addressee_id, new.requester_id, 'friend_request', new.id);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    insert into notifications (user_id, actor_id, type, reference_id) values (new.requester_id, new.addressee_id, 'friend_accepted', new.id);
  end if;
  return new;
end $$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update on public.friendships
  for each row execute function public.notify_friendship();

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type) values (new.followee_id, new.follower_id, 'new_follower');
  return new;
end $$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_follow();

create or replace function public.notify_recommendation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type, reference_id) values (new.receiver_id, new.sender_id, 'recommendation', new.id);
  return new;
end $$;
drop trigger if exists recs_notify on public.place_recommendations;
create trigger recs_notify after insert on public.place_recommendations
  for each row execute function public.notify_recommendation();

create or replace function public.notify_collection_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type, reference_id)
  select c.user_id, new.user_id, 'collection_follow', c.id from collections c where c.id = new.collection_id and c.user_id <> new.user_id;
  return new;
end $$;
drop trigger if exists collection_follows_notify on public.collection_follows;
create trigger collection_follows_notify after insert on public.collection_follows
  for each row execute function public.notify_collection_follow();

-- ───────────────────────────────────────────────────────────── row level security
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;
alter table public.friendships enable row level security;
alter table public.follows enable row level security;
alter table public.collections enable row level security;
alter table public.collection_places enable row level security;
alter table public.collection_follows enable row level security;
alter table public.saved_places enable row level security;
alter table public.place_recommendations enable row level security;
alter table public.notifications enable row level security;

-- profiles: discoverable for search (username/name); private details guarded in the app layer.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- places: shared catalogue. Any signed-in user may add a place (e.g. imported from Google).
drop policy if exists "places readable" on public.places;
create policy "places readable" on public.places for select using (true);
drop policy if exists "places insert" on public.places;
create policy "places insert" on public.places for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "places update by creator" on public.places;
create policy "places update by creator" on public.places for update using (created_by = auth.uid());

-- reviews: visible per author's reviews_visibility; writable only by the author.
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews for select using (
  exists (select 1 from profiles p where p.id = reviews.user_id and public.can_view(p.id, p.reviews_visibility))
);
drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reviews update own" on public.reviews;
create policy "reviews update own" on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "reviews delete own" on public.reviews;
create policy "reviews delete own" on public.reviews for delete using (user_id = auth.uid());

drop policy if exists "review photos readable" on public.review_photos;
create policy "review photos readable" on public.review_photos for select using (
  exists (select 1 from reviews r join profiles p on p.id = r.user_id
          where r.id = review_photos.review_id and public.can_view(p.id, p.reviews_visibility))
);
drop policy if exists "review photos write own" on public.review_photos;
create policy "review photos write own" on public.review_photos for all using (
  exists (select 1 from reviews r where r.id = review_photos.review_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from reviews r where r.id = review_photos.review_id and r.user_id = auth.uid())
);

-- friendships: only the two parties see or change them. Only the addressee can accept.
drop policy if exists "friendships parties read" on public.friendships;
create policy "friendships parties read" on public.friendships for select using (
  auth.uid() in (requester_id, addressee_id) or status = 'accepted'
);
drop policy if exists "friendships request" on public.friendships;
create policy "friendships request" on public.friendships for insert to authenticated with check (
  requester_id = auth.uid() and status = 'pending'
);
drop policy if exists "friendships respond" on public.friendships;
create policy "friendships respond" on public.friendships for update using (addressee_id = auth.uid());
drop policy if exists "friendships remove" on public.friendships;
create policy "friendships remove" on public.friendships for delete using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "follows readable" on public.follows;
create policy "follows readable" on public.follows for select using (true);
drop policy if exists "follows own" on public.follows;
create policy "follows own" on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows unfollow" on public.follows;
create policy "follows unfollow" on public.follows for delete using (follower_id = auth.uid());

-- collections: visibility-aware read; owner-only write. Private collections are invisible to others.
drop policy if exists "collections readable" on public.collections;
create policy "collections readable" on public.collections for select using (public.can_view(user_id, visibility));
drop policy if exists "collections write own" on public.collections;
create policy "collections write own" on public.collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "collection places readable" on public.collection_places;
create policy "collection places readable" on public.collection_places for select using (
  exists (select 1 from collections c where c.id = collection_places.collection_id and public.can_view(c.user_id, c.visibility))
);
drop policy if exists "collection places write own" on public.collection_places;
create policy "collection places write own" on public.collection_places for all using (
  exists (select 1 from collections c where c.id = collection_places.collection_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from collections c where c.id = collection_places.collection_id and c.user_id = auth.uid())
);

drop policy if exists "collection follows readable" on public.collection_follows;
create policy "collection follows readable" on public.collection_follows for select using (true);
drop policy if exists "collection follows own" on public.collection_follows;
create policy "collection follows own" on public.collection_follows for all using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from collections c where c.id = collection_follows.collection_id and public.can_view(c.user_id, c.visibility))
);

-- saved places: per owner's saved_visibility.
drop policy if exists "saved readable" on public.saved_places;
create policy "saved readable" on public.saved_places for select using (
  exists (select 1 from profiles p where p.id = saved_places.user_id and public.can_view(p.id, p.saved_visibility))
);
drop policy if exists "saved write own" on public.saved_places;
create policy "saved write own" on public.saved_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- recommendations: sender and receiver only; you can only send to friends.
drop policy if exists "recs parties read" on public.place_recommendations;
create policy "recs parties read" on public.place_recommendations for select using (auth.uid() in (sender_id, receiver_id));
drop policy if exists "recs send to friends" on public.place_recommendations;
create policy "recs send to friends" on public.place_recommendations for insert to authenticated with check (
  sender_id = auth.uid() and public.are_friends(sender_id, receiver_id)
);

-- notifications: recipient reads and marks as read.
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────── storage
insert into storage.buckets (id, name, public) values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "review photos upload own folder" on storage.objects;
create policy "review photos upload own folder" on storage.objects for insert to authenticated with check (
  bucket_id in ('review-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "review photos delete own" on storage.objects;
create policy "review photos delete own" on storage.objects for delete using (
  bucket_id in ('review-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text
);
