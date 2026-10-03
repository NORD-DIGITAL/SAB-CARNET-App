-- Catégorie de chaque personne : Famille, Amis, Employé(e) de Mamod, Partenaire commercial, Autres.
alter table public.contacts add column if not exists category text not null default 'autre'
  check (category in ('famille','ami','employe_mamod','partenaire','autre'));
