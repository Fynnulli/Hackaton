-- 3-Stunden-Build: Schema, RLS und RPCs.
--
-- Grundregel: Clients duerfen Tabellen nur lesen (RLS). Jede Schreiboperation
-- laeuft ueber eine SECURITY-DEFINER-Funktion, die alle Regeln selbst prueft.

-- ===========================================================================
-- Typen
-- ===========================================================================

create type public.event_phase as enum ('lobby', 'build', 'gallery', 'wrapped', 'closed');
create type public.announcement_kind as enum ('admin', 'system');

-- ===========================================================================
-- Tabellen
-- ===========================================================================

-- Genau eine Zeile (siehe event_singleton).
create table public.event (
  id uuid primary key default gen_random_uuid(),
  join_code text not null
    check (join_code = upper(join_code) and char_length(join_code) between 4 and 12),
  phase public.event_phase not null default 'lobby',
  starts_at timestamptz,
  build_ends_at timestamptz,
  twist_at timestamptz,
  wrapped_slide int not null default 0 check (wrapped_slide >= 0),
  created_at timestamptz not null default now(),
  check (build_ends_at is null or starts_at is null or build_ends_at > starts_at)
);
create unique index event_singleton on public.event ((true));

-- reveal_at wird ausschliesslich per Trigger aus event.starts_at / event.twist_at
-- abgeleitet und ist die Grundlage der Geheimhaltung (siehe RLS).
create table public.challenge_stage (
  id uuid primary key default gen_random_uuid(),
  stage_no smallint not null unique check (stage_no between 1 and 3),
  title text not null,
  body text not null,
  reveal_at timestamptz
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  team_code text not null unique,
  created_at timestamptz not null default now()
);
create unique index team_name_unique on public.team (lower(name));

create table public.participant (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar text not null check (char_length(avatar) between 1 and 16),
  team_id uuid references public.team (id) on delete set null,
  is_admin boolean not null default false,
  joined_at timestamptz not null default now()
);
create index participant_team_idx on public.participant (team_id);

-- Eigene Tabelle ohne Lese-Policy: Der Wiedereinstiegs-Token darf nie ueber
-- einen normalen SELECT auf participant sichtbar werden.
create table public.participant_secret (
  participant_id uuid primary key
    references public.participant (id) on delete cascade on update cascade,
  reentry_token uuid not null unique default gen_random_uuid()
);

create table public.submission (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.team (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (url ~* '^https?://' and char_length(url) <= 500),
  description text not null default '' check (char_length(description) <= 300),
  screenshot_path text,
  stage1 boolean not null default false,
  stage2 boolean not null default false,
  stage3 boolean not null default false,
  hidden boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vote (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null
    references public.participant (id) on delete cascade on update cascade,
  submission_id uuid not null references public.submission (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (voter_id, submission_id)
);
create index vote_submission_idx on public.vote (submission_id);

create table public.announcement (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 280),
  kind public.announcement_kind not null default 'system',
  created_at timestamptz not null default now()
);
create index announcement_created_idx on public.announcement (created_at desc);

-- ===========================================================================
-- reveal_at aus dem Event ableiten
-- ===========================================================================

create function public.sync_stage_reveal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update challenge_stage
     set reveal_at = case when stage_no = 3 then new.twist_at else new.starts_at end;
  return null;
end;
$$;

create trigger event_sync_stage_reveal
after insert or update of starts_at, twist_at on public.event
for each row execute function public.sync_stage_reveal();

create function public.set_stage_reveal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reveal_at := (
    select case when new.stage_no = 3 then e.twist_at else e.starts_at end from event e
  );
  return new;
end;
$$;

create trigger challenge_stage_set_reveal
before insert or update on public.challenge_stage
for each row execute function public.set_stage_reveal();

-- ===========================================================================
-- Hilfsfunktionen (in RLS und RPCs verwendet)
-- ===========================================================================

create function public.server_time() returns timestamptz
language sql volatile as $$ select clock_timestamp(); $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from participant where id = auth.uid()), false);
$$;

create function public.my_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from participant where id = auth.uid();
$$;

-- Die Bauphase beginnt automatisch mit starts_at, auch wenn der Admin die
-- Phase nicht in derselben Sekunde umschaltet. Der Client leitet identisch ab.
create function public.effective_phase() returns public.event_phase
language sql stable security definer set search_path = public as $$
  select case
    when e.phase = 'lobby' and e.starts_at is not null and e.starts_at <= now()
      then 'build'::event_phase
    else e.phase
  end
  from event e;
$$;

create function public.is_build_open() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select effective_phase() = 'build'
        and e.build_ends_at is not null
        and now() < e.build_ends_at
       from event e),
    false);
$$;

create function public.gen_code(p_len int) returns text
language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, p_len);
$$;

-- ===========================================================================
-- Row Level Security: nur Lesen
-- ===========================================================================

alter table public.event enable row level security;
alter table public.challenge_stage enable row level security;
alter table public.team enable row level security;
alter table public.participant enable row level security;
alter table public.participant_secret enable row level security;
alter table public.submission enable row level security;
alter table public.vote enable row level security;
alter table public.announcement enable row level security;

create policy event_select on public.event
  for select to authenticated using (true);

-- Geheimhaltung: ohne Ausnahme, auch nicht fuer Admins.
create policy challenge_stage_select on public.challenge_stage
  for select to authenticated using (reveal_at is not null and reveal_at <= now());

create policy team_select on public.team
  for select to authenticated using (true);

create policy participant_select on public.participant
  for select to authenticated using (true);

create policy announcement_select on public.announcement
  for select to authenticated using (true);

create policy submission_select on public.submission
  for select to authenticated using (
    team_id = public.my_team_id()
    or public.is_admin()
    or (not hidden and public.effective_phase() in ('gallery', 'wrapped', 'closed'))
  );

-- Stimmen sieht nur, wer sie abgegeben hat. Staende gibt es nur ueber get_leaderboard().
create policy vote_select on public.vote
  for select to authenticated using (voter_id = auth.uid() or public.is_admin());

revoke all on
  public.event, public.challenge_stage, public.team, public.participant,
  public.participant_secret, public.submission, public.vote, public.announcement
from anon, authenticated;

grant select on
  public.event, public.challenge_stage, public.participant,
  public.submission, public.vote, public.announcement
to authenticated;

-- team_code bleibt verdeckt; das eigene Team inkl. Code liefert get_my_team().
grant select (id, name, created_at) on public.team to authenticated;

-- ===========================================================================
-- RPCs: Teilnahme
-- ===========================================================================

create function public.join_event(p_join_code text, p_display_name text, p_avatar text)
returns public.participant
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_avatar text := btrim(coalesce(p_avatar, ''));
  v_event event;
  v_row participant;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_row from participant where id = v_uid;
  if found then return v_row; end if;

  select * into v_event from event where join_code = upper(btrim(coalesce(p_join_code, '')));
  if not found then raise exception 'invalid_join_code'; end if;
  if v_event.phase = 'closed' then raise exception 'event_closed'; end if;

  if char_length(v_name) not between 1 and 24 then raise exception 'invalid_name'; end if;
  if char_length(v_avatar) not between 1 and 16 then raise exception 'invalid_avatar'; end if;

  insert into participant (id, display_name, avatar)
  values (v_uid, v_name, v_avatar)
  returning * into v_row;

  insert into participant_secret (participant_id) values (v_uid);

  return v_row;
end;
$$;

create function public.get_reentry_token() returns uuid
language sql stable security definer set search_path = public as $$
  select reentry_token from participant_secret where participant_id = auth.uid();
$$;

-- Uebertraegt eine bestehende Teilnahme auf die aktuelle (neue) anonyme Sitzung.
create function public.claim_reentry_token(p_token uuid)
returns public.participant
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old_id uuid;
  v_current participant;
  v_row participant;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select participant_id into v_old_id
    from participant_secret where reentry_token = p_token for update;
  if v_old_id is null then raise exception 'invalid_token'; end if;

  if v_old_id <> v_uid then
    select * into v_current from participant where id = v_uid;
    if found then
      -- Auf dem neuen Geraet wurde schon frisch beigetreten: nur ueberschreiben,
      -- solange daran noch nichts haengt.
      if v_current.team_id is not null
         or exists (select 1 from vote where voter_id = v_uid) then
        raise exception 'already_joined';
      end if;
      delete from participant where id = v_uid;
    end if;

    update participant set id = v_uid where id = v_old_id;
  end if;

  select * into v_row from participant where id = v_uid;
  return v_row;
end;
$$;

-- ===========================================================================
-- RPCs: Teams
-- ===========================================================================

-- Teams werden in der Lobby gebildet. Wer zu spaet kommt und noch kein Team hat,
-- darf waehrend der laufenden Bauphase noch eines gruenden oder beitreten.
create function public.can_get_team() returns boolean
language sql stable security definer set search_path = public as $$
  select effective_phase() = 'lobby' or is_build_open();
$$;

create function public.create_team(p_name text)
returns public.team
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_me participant;
  v_team team;
  v_code text;
begin
  select * into v_me from participant where id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if not can_get_team() then raise exception 'teams_locked'; end if;
  if v_me.team_id is not null then raise exception 'already_in_team'; end if;
  if char_length(v_name) not between 1 and 40 then raise exception 'invalid_team_name'; end if;
  if exists (select 1 from team where lower(name) = lower(v_name)) then
    raise exception 'team_name_taken';
  end if;

  loop
    v_code := gen_code(5);
    exit when not exists (select 1 from team where team_code = v_code);
  end loop;

  begin
    insert into team (name, team_code) values (v_name, v_code) returning * into v_team;
  exception when unique_violation then
    raise exception 'team_name_taken';
  end;

  update participant set team_id = v_team.id where id = v_me.id;
  return v_team;
end;
$$;

create function public.join_team(p_team_code text)
returns public.team
language plpgsql security definer set search_path = public as $$
declare
  v_me participant;
  v_team team;
begin
  select * into v_me from participant where id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if not can_get_team() then raise exception 'teams_locked'; end if;
  if v_me.team_id is not null then raise exception 'already_in_team'; end if;

  -- Sperre auf dem Team serialisiert gleichzeitige Beitritte (max. 3).
  select * into v_team from team
   where team_code = upper(btrim(coalesce(p_team_code, ''))) for update;
  if not found then raise exception 'invalid_team_code'; end if;

  if (select count(*) from participant where team_id = v_team.id) >= 3 then
    raise exception 'team_full';
  end if;

  update participant set team_id = v_team.id where id = v_me.id;
  return v_team;
end;
$$;

create function public.leave_team() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me participant;
begin
  select * into v_me from participant where id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if v_me.team_id is null then return; end if;
  if effective_phase() <> 'lobby' then raise exception 'teams_locked'; end if;

  perform 1 from team where id = v_me.team_id for update;
  update participant set team_id = null where id = v_me.id;
  delete from team t
   where t.id = v_me.team_id
     and not exists (select 1 from participant p where p.team_id = t.id);
end;
$$;

create function public.get_my_team() returns public.team
language sql stable security definer set search_path = public as $$
  select t.* from team t join participant p on p.team_id = t.id where p.id = auth.uid();
$$;

-- ===========================================================================
-- RPCs: Abgabe und Voting
-- ===========================================================================

create function public.submit_project(
  p_title text,
  p_url text,
  p_description text,
  p_screenshot_path text,
  p_stage1 boolean,
  p_stage2 boolean,
  p_stage3 boolean
) returns public.submission
language plpgsql security definer set search_path = public as $$
declare
  v_me participant;
  v_team team;
  v_sub submission;
  v_is_new boolean;
  v_title text := btrim(coalesce(p_title, ''));
  v_url text := btrim(coalesce(p_url, ''));
  v_description text := btrim(coalesce(p_description, ''));
begin
  select * into v_me from participant where id = auth.uid();
  if not found then raise exception 'not_joined'; end if;
  if v_me.team_id is null then raise exception 'no_team'; end if;

  -- Zeitsperre: zaehlt allein die Datenbankzeit.
  if not is_build_open() then raise exception 'submissions_closed'; end if;

  if char_length(v_title) not between 1 and 80 then raise exception 'invalid_title'; end if;
  if v_url !~* '^https?://' or char_length(v_url) > 500 then raise exception 'invalid_url'; end if;
  if char_length(v_description) > 300 then raise exception 'invalid_description'; end if;
  if p_screenshot_path is not null
     and p_screenshot_path not like v_me.team_id::text || '/%' then
    raise exception 'invalid_screenshot';
  end if;

  select * into v_team from team where id = v_me.team_id for update;
  v_is_new := not exists (select 1 from submission where team_id = v_team.id);

  insert into submission
    (team_id, title, url, description, screenshot_path, stage1, stage2, stage3)
  values
    (v_team.id, v_title, v_url, v_description, p_screenshot_path,
     coalesce(p_stage1, false), coalesce(p_stage2, false), coalesce(p_stage3, false))
  on conflict (team_id) do update set
    title = excluded.title,
    url = excluded.url,
    description = excluded.description,
    screenshot_path = excluded.screenshot_path,
    stage1 = excluded.stage1,
    stage2 = excluded.stage2,
    stage3 = excluded.stage3,
    updated_at = now()
  returning * into v_sub;

  if v_is_new then
    insert into announcement (body, kind)
    values ('Team ' || v_team.name || ' hat abgegeben', 'system');
  end if;

  return v_sub;
end;
$$;

-- Gibt die Zahl der verbleibenden Stimmen zurueck.
create function public.cast_vote(p_submission_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_me participant;
  v_sub submission;
  v_used int;
begin
  -- Sperre auf dem Teilnehmer serialisiert parallele Stimmabgaben (Limit 3).
  select * into v_me from participant where id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if effective_phase() <> 'gallery' then raise exception 'voting_closed'; end if;
  if v_me.team_id is null then raise exception 'no_team'; end if;

  select * into v_sub from submission where id = p_submission_id;
  if not found or v_sub.hidden then raise exception 'invalid_submission'; end if;
  if v_sub.team_id = v_me.team_id then raise exception 'cannot_vote_own_team'; end if;

  if exists (select 1 from vote where voter_id = v_me.id and submission_id = v_sub.id) then
    raise exception 'already_voted';
  end if;

  select count(*) into v_used from vote where voter_id = v_me.id;
  if v_used >= 3 then raise exception 'no_votes_left'; end if;

  insert into vote (voter_id, submission_id) values (v_me.id, v_sub.id);
  return 3 - (v_used + 1);
end;
$$;

create function public.remove_vote(p_submission_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_me participant;
begin
  select * into v_me from participant where id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if effective_phase() <> 'gallery' then raise exception 'voting_closed'; end if;

  delete from vote where voter_id = v_me.id and submission_id = p_submission_id;
  return 3 - (select count(*) from vote where voter_id = v_me.id)::int;
end;
$$;

-- Punkte: Stufe 1 = 10, Stufe 2 = 10, Stufe 3 = 15, jede Stimme = 5.
-- Gleichstand: fruehere Abgabe gewinnt. Vor dem Wrapped leer (ausser fuer Admins).
create function public.get_leaderboard()
returns table (
  place int,
  submission_id uuid,
  team_id uuid,
  team_name text,
  title text,
  stage1 boolean,
  stage2 boolean,
  stage3 boolean,
  vote_count int,
  points int,
  submitted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with scored as (
    select
      s.id, s.team_id, t.name, s.title, s.stage1, s.stage2, s.stage3, s.submitted_at,
      (select count(*) from vote v where v.submission_id = s.id)::int as votes
    from submission s
    join team t on t.id = s.team_id
    where not s.hidden
  ),
  ranked as (
    select
      sc.*,
      (sc.stage1::int * 10 + sc.stage2::int * 10 + sc.stage3::int * 15 + sc.votes * 5) as pts
    from scored sc
  )
  select
    (row_number() over (order by r.pts desc, r.submitted_at asc))::int,
    r.id, r.team_id, r.name, r.title, r.stage1, r.stage2, r.stage3,
    r.votes, r.pts, r.submitted_at
  from ranked r
  where effective_phase() in ('wrapped', 'closed') or is_admin()
  order by r.pts desc, r.submitted_at asc;
$$;

-- ===========================================================================
-- RPCs: Admin
-- ===========================================================================

create function public.admin_set_phase(p_phase public.event_phase)
returns public.event
language plpgsql security definer set search_path = public as $$
declare
  v_event event;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  select * into v_event from event for update;

  if p_phase = 'build' then
    -- Sofortstart: fehlende oder zukuenftige Zeiten auf jetzt bzw. Standard setzen.
    if v_event.starts_at is null or v_event.starts_at > now() then
      v_event.starts_at := now();
      v_event.build_ends_at := null;
      v_event.twist_at := null;
    end if;
    v_event.build_ends_at := coalesce(v_event.build_ends_at, v_event.starts_at + interval '180 minutes');
    v_event.twist_at := coalesce(v_event.twist_at, v_event.starts_at + interval '90 minutes');
  elsif p_phase = 'lobby' then
    -- Zurueck in die Lobby: eine abgelaufene Startzeit wuerde sofort wieder starten.
    if v_event.starts_at is not null and v_event.starts_at <= now() then
      v_event.starts_at := null;
      v_event.build_ends_at := null;
      v_event.twist_at := null;
    end if;
  end if;

  update event set
    phase = p_phase,
    starts_at = v_event.starts_at,
    build_ends_at = v_event.build_ends_at,
    twist_at = v_event.twist_at
  returning * into v_event;
  return v_event;
end;
$$;

-- Setzt Start, Bauzeit und Twist in einem Schritt (auch fuer den Testmodus).
create function public.admin_schedule(
  p_starts_at timestamptz,
  p_build_minutes numeric default 180,
  p_twist_minute numeric default 90
) returns public.event
language plpgsql security definer set search_path = public as $$
declare
  v_event event;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  if p_starts_at is null or p_build_minutes <= 0
     or p_twist_minute <= 0 or p_twist_minute >= p_build_minutes then
    raise exception 'invalid_schedule';
  end if;

  update event set
    starts_at = p_starts_at,
    build_ends_at = p_starts_at + make_interval(secs => (p_build_minutes * 60)::double precision),
    twist_at = p_starts_at + make_interval(secs => (p_twist_minute * 60)::double precision)
  returning * into v_event;
  return v_event;
end;
$$;

create function public.admin_extend_build(p_minutes numeric)
returns public.event
language plpgsql security definer set search_path = public as $$
declare
  v_event event;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update event set
    build_ends_at = build_ends_at + make_interval(secs => (p_minutes * 60)::double precision)
  where build_ends_at is not null
  returning * into v_event;
  if not found then raise exception 'not_scheduled'; end if;
  return v_event;
end;
$$;

create function public.admin_post_announcement(p_body text)
returns public.announcement
language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_row announcement;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  if char_length(v_body) not between 1 and 280 then raise exception 'invalid_announcement'; end if;
  insert into announcement (body, kind) values (v_body, 'admin') returning * into v_row;
  return v_row;
end;
$$;

create function public.admin_set_submission_hidden(p_submission_id uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update submission set hidden = p_hidden where id = p_submission_id;
end;
$$;

-- Abgabe im Namen eines Teams nachtragen; bewusst ohne Zeitsperre.
create function public.admin_upsert_submission(
  p_team_id uuid,
  p_title text,
  p_url text,
  p_description text,
  p_stage1 boolean,
  p_stage2 boolean,
  p_stage3 boolean
) returns public.submission
language plpgsql security definer set search_path = public as $$
declare
  v_sub submission;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  insert into submission (team_id, title, url, description, stage1, stage2, stage3)
  values (p_team_id, btrim(p_title), btrim(p_url), btrim(coalesce(p_description, '')),
          coalesce(p_stage1, false), coalesce(p_stage2, false), coalesce(p_stage3, false))
  on conflict (team_id) do update set
    title = excluded.title,
    url = excluded.url,
    description = excluded.description,
    stage1 = excluded.stage1,
    stage2 = excluded.stage2,
    stage3 = excluded.stage3,
    updated_at = now()
  returning * into v_sub;
  return v_sub;
end;
$$;

create function public.admin_set_wrapped_slide(p_slide int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update event set wrapped_slide = greatest(p_slide, 0);
end;
$$;

-- ===========================================================================
-- Ausfuehrungsrechte: nur angemeldete (auch anonyme) Sitzungen
-- ===========================================================================

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ===========================================================================
-- Storage: Screenshots (max. 2 MB, nur Bilder, Ordner = Team-ID)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy screenshots_select on storage.objects
  for select to authenticated using (bucket_id = 'screenshots');

create policy screenshots_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = public.my_team_id()::text
    and public.is_build_open()
  );

-- ===========================================================================
-- Realtime
-- ===========================================================================

alter publication supabase_realtime add table public.event;
alter publication supabase_realtime add table public.announcement;
alter publication supabase_realtime add table public.participant;
alter publication supabase_realtime add table public.team;
