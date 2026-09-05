REVOKE EXECUTE ON FUNCTION public.create_agency_for_current_user(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_branch_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_branch(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_agency_for_current_user(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_branch_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_branch(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;