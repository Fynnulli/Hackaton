-- Testdaten fuer lokale Entwicklung und Supabase-Preview-Branches.
-- Wird NICHT automatisch auf das Produktivprojekt angewendet.
-- Das echte Thema gehoert nie in dieses Repository (siehe README, "Event anlegen").

insert into public.event (join_code)
select 'TEST42'
where not exists (select 1 from public.event);

insert into public.challenge_stage (stage_no, title, body) values
  (1, 'Stufe 1: Platzhalter', 'Platzhaltertext für die Grundaufgabe.'),
  (2, 'Stufe 2: Platzhalter', 'Platzhaltertext für die Erweiterung.'),
  (3, 'Twist: Platzhalter', 'Platzhaltertext für den Twist.')
on conflict (stage_no) do nothing;
