-- =====================================================================
--  SAB-CARNET — Plateforme : profils, accès Go Code, admin, messagerie,
--  configuration de version, valeurs par défaut.  By NORD DIGITAL
--  (repris de Budget.Go.Family, codes préfixés "SC")
-- =====================================================================

-- ---------- user_id rempli automatiquement par le serveur -------------
do $$
declare t text;
begin
  foreach t in array array[
    'payment_methods','transfers','contacts','categories','projects','expenses',
    'cash_withdrawals','debts_owed','debts_owed_repayments',
    'loans_given','loans_given_repayments',
    'biz_products','biz_purchases','biz_purchase_items','biz_expenses',
    'biz_sales','biz_sale_items','biz_installments','biz_sale_payments',
    'investments','investment_flows',
    'sport_venues','coaches','sport_packages','sport_sessions',
    'beauty_providers','beauty_services'
  ] loop
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
  end loop;
end $$;

-- ---------- Administrateurs -----------------------------------------
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;   -- aucune politique : lecture via is_app_admin()

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;

-- ---------- Profils -------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  onboarded   boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_app_admin());
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Configuration publique (blocage des anciennes versions) --
create table public.app_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);
alter table public.app_config enable row level security;
create policy config_lecture on public.app_config for select using (true);
insert into public.app_config(key, value) values
  ('min_version', '1'), ('latest_version', '1'),
  ('apk_url', 'https://github.com/NORD-DIGITAL/SAB-CARNET-App/releases/download/apk-latest/SabCarnet.apk'),
  ('web_url', '');

-- ---------- Abonnements et Go Codes ---------------------------------
create table public.subscriptions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select using (user_id = auth.uid() or public.is_app_admin());

create table public.go_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^SC[A-Z0-9]{8}$'),
  user_id     uuid not null references auth.users(id) on delete cascade,
  days        int not null check (days in (30, 90, 180, 365)),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  revoked     boolean not null default false
);
alter table public.go_codes enable row level security;
create policy go_codes_admin_select on public.go_codes for select using (public.is_app_admin());

create or replace function public.my_access_v3()
returns table(is_admin boolean, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select public.is_app_admin(), (select s.expires_at from subscriptions s where s.user_id = auth.uid());
$$;

create or replace function public.redeem_go_code_v3(p_code text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare g go_codes; cur timestamptz; nexp timestamptz;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into g from go_codes where code = upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')) for update;
  if g.id is null or g.revoked then raise exception 'Go Code invalide'; end if;
  if g.used_at is not null then raise exception 'Ce Go Code a déjà été utilisé'; end if;
  if g.user_id <> auth.uid() then raise exception 'Ce Go Code a été créé pour un autre compte'; end if;
  select s.expires_at into cur from subscriptions s where s.user_id = auth.uid();
  nexp := greatest(coalesce(cur, now()), now()) + make_interval(days => g.days);
  insert into subscriptions(user_id, expires_at) values (auth.uid(), nexp)
    on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now();
  update go_codes set used_at = now() where id = g.id;
  return nexp;
end $$;

create or replace function public.admin_users()
returns table(id uuid, email text, full_name text, phone text, created_at timestamptz, last_sign_in_at timestamptz, expires_at timestamptz, codes_pending bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return query
  select u.id, u.email::text, coalesce(p.full_name, u.raw_user_meta_data->>'full_name')::text, (u.raw_user_meta_data->>'phone_local')::text,
         u.created_at, u.last_sign_in_at, s.expires_at,
         (select count(*) from go_codes g where g.user_id = u.id and g.used_at is null and not g.revoked)
  from auth.users u left join profiles p on p.id = u.id left join subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end $$;

create or replace function public.admin_create_go_code(p_user uuid, p_days int) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; nm text; ini text; c text; i int; b bytea;
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_days not in (30, 90, 180, 365) then raise exception 'Durée invalide'; end if;
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

create or replace function public.admin_revoke_go_code(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administrateur'; end if;
  update go_codes set revoked = true where id = p_id and used_at is null;
end $$;

-- ---------- Remarques et messages de l'équipe -----------------------
create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_name   text,
  sender_email  text,
  kind          text not null default 'amelioration' check (kind in ('amelioration','probleme','autre')),
  message       text not null check (char_length(message) between 3 and 3000),
  status        text not null default 'nouveau' check (status in ('nouveau','lu','traite')),
  app_version   text,
  created_at    timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy feedback_select on public.feedback for select using (user_id = auth.uid() or public.is_app_admin());
create policy feedback_insert on public.feedback for insert with check (user_id = auth.uid());
create policy feedback_update on public.feedback for update using (public.is_app_admin()) with check (public.is_app_admin());
create policy feedback_delete on public.feedback for delete using (public.is_app_admin());

create table public.admin_messages (
  id          uuid primary key default gen_random_uuid(),
  to_user     uuid references auth.users(id) on delete cascade,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.admin_messages enable row level security;
create policy msg_lecture on public.admin_messages for select using (to_user = auth.uid() or to_user is null or public.is_app_admin());
create policy msg_admin_ecrit on public.admin_messages for insert with check (public.is_app_admin());
create policy msg_admin_supprime on public.admin_messages for delete using (public.is_app_admin());

create table public.admin_message_reads (
  message_id  uuid not null references public.admin_messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.admin_message_reads enable row level security;
create policy lu_lecture on public.admin_message_reads for select using (user_id = auth.uid());
create policy lu_ajout on public.admin_message_reads for insert with check (user_id = auth.uid());

create or replace function public.admin_message_mark_sender_read() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into admin_message_reads(message_id, user_id) values (new.id, auth.uid()) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger admin_message_sender_read after insert on public.admin_messages
  for each row execute function public.admin_message_mark_sender_read();

-- ---------- Valeurs par défaut d'un nouveau compte ------------------
-- Appelée par l'application après la création du profil (sans effet si déjà fait).
create or replace function public.seed_my_defaults() returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if not exists (select 1 from payment_methods where user_id = auth.uid()) then
    insert into payment_methods(type, name, track_balance, color) values
      ('especes', 'Espèces perso', true, '#10B981'),
      ('caisse_business', 'Caisse business', true, '#F97316'),
      ('mvola', 'MVola', false, '#FFCC00'),
      ('orange_money', 'Orange Money', false, '#FF7900'),
      ('airtel_money', 'Airtel Money', false, '#E40000');
  end if;
  if not exists (select 1 from categories where user_id = auth.uid()) then
    insert into categories(name, module) values
      ('Alimentation', 'general'), ('Transport', 'general'), ('Logement', 'general'), ('Jirama', 'general'),
      ('Crédit téléphone', 'general'), ('Santé', 'general'), ('Vêtements', 'general'), ('Famille', 'general'),
      ('Sorties', 'general'), ('Cadeaux / dons', 'general'), ('Autres', 'general'),
      ('Sport', 'sport'), ('Beauté', 'beaute'), ('Frais bancaires', 'frais_bancaires');
  end if;
end $$;

-- ---------- Droits de l'API -----------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.app_config to anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.admin_message_mark_sender_read() from authenticated;
