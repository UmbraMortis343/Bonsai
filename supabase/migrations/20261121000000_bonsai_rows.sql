-- Applied to the Supabase project "bonsai" (afrejqhcfdqxrkxpqtla, Sydney) on 2026-11-21. Kept here as the record.
-- Bonsai sync: one row per record a device keeps (a topic, graph, idea, link, page, log entry, setting),
-- kept per person and per channel ('' the app, 'beta' Bonsai Beta, which never mixes with the real garden).
-- A deleted record stays as a row with deleted = true, so other devices learn of it.
-- client_at is when the change was made on the device: the newer change wins.
-- updated_at is when the server took it, and is what devices pull from.
create table public.rows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel text not null default '' check (channel in ('', 'beta')),
  store text not null check (store in ('zones', 'trees', 'nodes', 'links', 'events', 'meta', 'patches', 'inbox', 'pages')),
  id text not null check (length(id) between 1 and 200),
  data jsonb,
  deleted boolean not null default false,
  client_at bigint not null,
  device text check (length(device) <= 60),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, channel, store, id),
  check (pg_column_size(data) < 8000000)
);
create index rows_pull on public.rows (user_id, channel, updated_at);

alter table public.rows enable row level security;
create policy "read own rows" on public.rows for select to authenticated using (user_id = (select auth.uid()));
create policy "add own rows" on public.rows for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change own rows" on public.rows for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.rows from anon;

-- Push a batch of changes; a change only replaces what's there if it was made at the same time or later.
create function public.push(items jsonb) returns integer
language sql security invoker set search_path = '' as $$
  with done as (
    insert into public.rows as r (user_id, channel, store, id, data, deleted, client_at, device, updated_at)
    select (select auth.uid()), coalesce(x.channel, ''), x.store, x.id, x.data, coalesce(x.deleted, false), x.client_at, x.device, clock_timestamp()
    from jsonb_to_recordset(items) as x(channel text, store text, id text, data jsonb, deleted boolean, client_at bigint, device text)
    on conflict (user_id, channel, store, id) do update
      set data = excluded.data, deleted = excluded.deleted, client_at = excluded.client_at, device = excluded.device, updated_at = clock_timestamp()
      where excluded.client_at >= r.client_at
    returning 1
  )
  select count(*)::int from done;
$$;
revoke all on function public.push(jsonb) from public, anon;
grant execute on function public.push(jsonb) to authenticated;
