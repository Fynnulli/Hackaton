-- Material-Dateien pro Stufe mit Zeitsperre.
--
-- Die Leitung laedt vor dem Event Dateien im Supabase-Dashboard hoch, Ordner = Stufe:
-- `1/briefing.pdf`, `3/neue-daten.csv`. Lesbar (auflisten, Signed URL, Download) sind sie
-- erst ab reveal_at der Stufe, also nach derselben Regel wie challenge_stage. Clients
-- duerfen nichts hochladen, aendern oder loeschen; es gibt dafuer bewusst keine Policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('material', 'material', false, 52428800,
        array['application/pdf',
              'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain',
              'application/zip', 'application/x-zip-compressed'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ist die Stufe mit dieser Nummer (als Ordnername) freigegeben? Liest challenge_stage direkt,
-- damit die Policy nicht von der Lese-Policy der Tabelle abhaengt; gibt nur ein Ja/Nein
-- heraus, nie Inhalte. Ordnernamen wie '01' oder 'x' passen auf keine Stufe.
create function public.is_stage_revealed(p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_stage
     where stage_no::text = p_folder
       and reveal_at is not null
       and reveal_at <= now()
  );
$$;

create policy material_select on storage.objects
  for select to authenticated using (
    bucket_id = 'material'
    and public.is_stage_revealed((storage.foldername(name))[1])
  );

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
