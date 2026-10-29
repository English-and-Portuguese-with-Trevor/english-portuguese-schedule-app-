-- The lessons site's lessons.json and free-lessons.json, copied into the
-- database (Trevor, 2026-10-29). The server's own fetches of
-- englishandportuguesewithtrevor.com (behind Cloudflare) never got through
-- from Vercel: the lesson helper found no free lesson ("Something went
-- wrong") and no article email ever went out. The database's fetches
-- (pg_net) do, so pg_cron fetches both files every 15 minutes and the
-- server reads the copies (src/lib/site-files.ts) with the service role.

create table if not exists public.site_files (
  name text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.site_files enable row level security;
-- No policies: the server reads it with the service role only.

create table if not exists private.site_file_requests (
  id bigint primary key,
  name text not null
);

-- Each run keeps what the last run fetched (pg_net answers later), then asks again.
create or replace function private.refresh_site_files()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_files (name, body, fetched_at)
  select distinct on (q.name) q.name, r.content::jsonb, r.created
  from private.site_file_requests q
  join net._http_response r on r.id = q.id
  where r.status_code = 200 and r.content_type like 'application/json%'
  order by q.name, q.id desc
  on conflict (name) do update set body = excluded.body, fetched_at = excluded.fetched_at;

  delete from private.site_file_requests;

  insert into private.site_file_requests (id, name)
  select net.http_get(url, timeout_milliseconds := 10000), name
  from (values
    ('lessons', 'https://englishandportuguesewithtrevor.com/lessons/lessons.json'),
    ('free-lessons', 'https://englishandportuguesewithtrevor.com/lessons/free-lessons.json')
  ) as files (name, url);
end;
$$;

revoke all on function private.refresh_site_files() from public, anon, authenticated;

select cron.schedule('refresh-site-files', '*/15 * * * *', 'select private.refresh_site_files()');
