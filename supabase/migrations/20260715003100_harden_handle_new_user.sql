-- Migration: harden_handle_new_user
-- handle_new_user() is a trigger-only SECURITY DEFINER function (fires on
-- auth.users insert). It must never be callable directly via PostgREST RPC, so
-- revoke EXECUTE from the API roles. The trigger still fires normally — trigger
-- execution does not depend on the inserting role holding EXECUTE.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
