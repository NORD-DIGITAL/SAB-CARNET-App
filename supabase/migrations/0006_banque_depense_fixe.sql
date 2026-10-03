-- « Ma Banque » (d'où sortent les prêts), dépenses fixes, « Espèces perso » devient « Dépense perso ».
alter table public.payment_methods drop constraint if exists payment_methods_type_check;
alter table public.payment_methods add constraint payment_methods_type_check
  check (type in ('especes','caisse_business','banque','carte','mvola','orange_money','airtel_money'));

alter table public.expenses add column if not exists is_fixed boolean not null default false;

update public.payment_methods set name = 'Dépense perso' where type = 'especes' and name = 'Espèces perso';

-- Chaque moyen par défaut est créé s'il manque (sans doublon), y compris pour les comptes existants.
create or replace function public.seed_my_defaults() returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if not exists (select 1 from payment_methods where user_id = auth.uid()) then
    insert into payment_methods(type, name, track_balance, color) values
      ('especes', 'Dépense perso', true, '#10B981'),
      ('caisse_business', 'Caisse business', true, '#F97316'),
      ('mvola', 'MVola', false, '#FFCC00'),
      ('orange_money', 'Orange Money', false, '#FF7900'),
      ('airtel_money', 'Airtel Money', false, '#E40000');
  end if;
  if not exists (select 1 from payment_methods where user_id = auth.uid() and type = 'banque') then
    insert into payment_methods(type, name, track_balance, color) values ('banque', 'Ma Banque', true, '#0EA5E9');
  end if;
  if not exists (select 1 from categories where user_id = auth.uid()) then
    insert into categories(name, module) values
      ('Alimentation', 'general'), ('Transport', 'general'), ('Logement', 'general'), ('Jirama', 'general'),
      ('Crédit téléphone', 'general'), ('Santé', 'general'), ('Vêtements', 'general'), ('Famille', 'general'),
      ('Sorties', 'general'), ('Cadeaux / dons', 'general'), ('Autres', 'general'),
      ('Sport', 'sport'), ('Beauté', 'beaute'), ('Frais bancaires', 'frais_bancaires');
  end if;
end $$;
revoke execute on function public.seed_my_defaults() from public, anon;
grant execute on function public.seed_my_defaults() to authenticated;
