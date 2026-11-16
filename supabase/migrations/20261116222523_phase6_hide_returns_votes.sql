-- Phase 6: Wer fuer eine Abgabe gestimmt hat, die der Admin ausblendet, bekaeme die Stimme
-- sonst nie zurueck (die Karte ist weg, das Limit zaehlt sie weiter). Beim Ausblenden werden
-- die Stimmen dafuer deshalb geloescht und sind wieder frei.
create or replace function public.admin_set_submission_hidden(p_submission_id uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update submission set hidden = p_hidden where id = p_submission_id;
  if p_hidden then
    delete from vote where submission_id = p_submission_id;
  end if;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
