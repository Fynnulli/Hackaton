-- Phase 4: Screenshots fremder Teams sind vor der Galerie nicht auflistbar
-- (wie die Abgaben selbst, siehe submission_select).
drop policy screenshots_select on storage.objects;

create policy screenshots_select on storage.objects
  for select to authenticated using (
    bucket_id = 'screenshots'
    and (
      (storage.foldername(name))[1] = public.my_team_id()::text
      or public.is_admin()
      or public.effective_phase() in ('gallery', 'wrapped', 'closed')
    )
  );
