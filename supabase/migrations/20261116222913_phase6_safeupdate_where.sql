-- Supabase laedt fuer API-Aufrufe pg-safeupdate: UPDATE/DELETE ohne WHERE werden abgelehnt
-- ("UPDATE requires a WHERE clause"). Die Event-Tabelle hat genau eine Zeile, die Stufen
-- werden immer alle neu berechnet; beides bekommt deshalb ein explizites WHERE.

create or replace function public.sync_stage_reveal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update challenge_stage
     set reveal_at = case when stage_no = 3 then new.twist_at else new.starts_at end
   where true;
  return null;
end;
$$;

create or replace function public.admin_set_phase(p_phase public.event_phase)
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
  where id = v_event.id
  returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.admin_schedule(
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
  where true
  returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.admin_set_wrapped_slide(p_slide int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update event set wrapped_slide = greatest(p_slide, 0) where true;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
