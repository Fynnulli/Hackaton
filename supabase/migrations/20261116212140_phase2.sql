-- Phase 2: Advisor-Hinweise (mutable search_path) beheben.
alter function public.gen_code(int) set search_path = '';
alter function public.server_time() set search_path = '';

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
