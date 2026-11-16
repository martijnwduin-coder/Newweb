-- Live updates: stream new notifications, friend requests and recommendations to the
-- recipients' browsers. Realtime enforces the same RLS policies as normal reads.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.place_recommendations;
