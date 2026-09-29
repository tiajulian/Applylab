-- Security fix: these SECURITY DEFINER functions were executable by anon/authenticated through
-- /rest/v1/rpc (Postgres grants EXECUTE to PUBLIC by default). None checks the caller:
--   admin_ai_gateway_ledger_summary  - returned top AI users' emails and spend to anyone holding
--                                      the public anon key
--   archive_account_usage_before_delete - could be run against any user id
-- Their only callers (admin/gateway-usage, account/delete) use the service role. The trigger and
-- event-trigger functions can't be invoked as RPCs anyway; revoked for hygiene.

revoke all on function public.admin_ai_gateway_ledger_summary(integer) from public, anon, authenticated;
revoke all on function public.archive_account_usage_before_delete(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_update() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.admin_ai_gateway_ledger_summary(integer) to service_role;
grant execute on function public.archive_account_usage_before_delete(uuid) to service_role;
