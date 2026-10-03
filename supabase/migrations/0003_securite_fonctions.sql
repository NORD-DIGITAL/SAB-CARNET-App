-- Les fonctions sensibles ne sont appelables qu'une fois connecté (jamais en anonyme).
-- Les fonctions admin vérifient en plus is_app_admin() à l'intérieur.
revoke execute on function public.admin_create_go_code(uuid, int), public.admin_revoke_go_code(uuid), public.admin_users(),
  public.is_app_admin(), public.my_access_v3(), public.redeem_go_code_v3(text), public.seed_my_defaults() from public, anon;
revoke execute on function public.admin_message_mark_sender_read() from public, anon, authenticated;
grant execute on function public.admin_create_go_code(uuid, int), public.admin_revoke_go_code(uuid), public.admin_users(),
  public.is_app_admin(), public.my_access_v3(), public.redeem_go_code_v3(text), public.seed_my_defaults() to authenticated;
