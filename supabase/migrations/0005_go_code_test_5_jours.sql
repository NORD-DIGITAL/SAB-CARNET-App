-- Formule « Test 5 jours » en plus de 30 j / 3 / 6 / 12 mois.
alter table public.go_codes drop constraint if exists go_codes_days_check;
alter table public.go_codes add constraint go_codes_days_check check (days in (5, 30, 90, 180, 365));

create or replace function public.admin_create_go_code(p_user uuid, p_days int) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; nm text; ini text; c text; i int; b bytea;
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_days not in (5, 30, 90, 180, 365) then raise exception 'Durée invalide'; end if;
  select coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email) into nm
    from auth.users u left join profiles p on p.id = u.id where u.id = p_user;
  if nm is null then raise exception 'Utilisateur introuvable'; end if;
  ini := upper(left(translate(trim(nm), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'), 1));
  if ini !~ '^[A-Z]$' then ini := 'X'; end if;
  loop
    b := gen_random_bytes(7); c := 'SC';
    for i in 0..6 loop c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    c := c || ini;
    exit when not exists (select 1 from go_codes where code = c);
  end loop;
  insert into go_codes(code, user_id, days) values (c, p_user, p_days);
  return c;
end $$;
revoke execute on function public.admin_create_go_code(uuid, int) from public, anon;
grant execute on function public.admin_create_go_code(uuid, int) to authenticated;
