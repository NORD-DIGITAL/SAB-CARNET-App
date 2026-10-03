-- =====================================================================
--  Carnet de dépenses (déclinaison de Budget.Go.Family) — By NORD DIGITAL
--  Schéma Supabase v2 — mono-utilisateur, sans plafond de budget
--  Montants en Ariary (entiers)
--
--  Sections : Dépenses perso · Cartes & retraits · Espèces perso
--             Caisse business · Business perso (stock, ventes échelonnées)
--             On me doit / Je dois · Investissements · Sport · Beauté · Projets
-- =====================================================================


-- =====================================================================
--  1. MOYENS DE PAIEMENT (cartes, espèces perso, caisse business, mobile money)
-- =====================================================================
create table public.payment_methods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in
                     ('especes','caisse_business','carte','mvola','orange_money','airtel_money')),
  name             text not null,                 -- ex : "BNI perso"
  bank             text,
  last4            char(4) check (last4 ~ '^[0-9]{4}$'),
  color            text default '#F5C400',
  track_balance    boolean not null default false, -- true pour espèces / caisse business
  initial_balance  bigint not null default 0,      -- solde de départ si suivi
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  -- une carte doit toujours avoir ses 4 derniers chiffres (jamais le numéro complet)
  check (type <> 'carte' or last4 is not null)
);

-- Virements internes : espèces perso <-> caisse business, MVola -> espèces, etc.
create table public.transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  from_method_id  uuid not null references public.payment_methods(id) on delete restrict,
  to_method_id    uuid not null references public.payment_methods(id) on delete restrict,
  amount          bigint not null check (amount > 0),
  transfer_on     date not null default current_date,
  note            text,                           -- ex : "Je me verse ma part du mois"
  created_at      timestamptz not null default now(),
  check (from_method_id <> to_method_id)
);


-- =====================================================================
--  2. CONTACTS (une seule liste : clients, créanciers, emprunteurs, partenaires)
-- =====================================================================
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,                               -- pour les rappels WhatsApp
  address     text,
  note        text,
  created_at  timestamptz not null default now()
);


-- =====================================================================
--  3. DÉPENSES PERSO
-- =====================================================================
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  icon        text,
  module      text not null default 'general'
              check (module in ('general','sport','beaute','frais_bancaires')),
  created_at  timestamptz not null default now()
);

create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  description          text,
  start_date           date,
  end_date             date,
  status               text not null default 'en_cours'
                       check (status in ('en_cours','termine','en_pause')),
  include_in_personal  boolean not null default false,  -- compté à part par défaut
  created_at           timestamptz not null default now()
);

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  spent_on           date not null default current_date,
  category_id        uuid references public.categories(id) on delete set null,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  card_operation     text check (card_operation in ('tpe','en_ligne')),
  project_id         uuid references public.projects(id) on delete set null,
  source             text not null default 'general'
                     check (source in ('general','sport','beaute','frais_retrait')),
  label              text,
  note               text,
  receipt_url        text,
  created_at         timestamptz not null default now()
);
create index on public.expenses (user_id, spent_on desc);
create index on public.expenses (project_id);


-- =====================================================================
--  4. RETRAITS DAB (carte -> espèces perso ou caisse business)
--     Un retrait n'est pas une dépense. Les frais = dépense 'frais_retrait'.
-- =====================================================================
create table public.cash_withdrawals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  card_id          uuid not null references public.payment_methods(id) on delete restrict,
  dest_method_id   uuid not null references public.payment_methods(id) on delete restrict,
  amount           bigint not null check (amount > 0),
  fees             bigint not null default 0 check (fees >= 0),
  fee_expense_id   uuid references public.expenses(id) on delete set null,
  withdrawn_on     date not null default current_date,
  place            text,                          -- ex : "DAB BOA Analakely"
  note             text,
  created_at       timestamptz not null default now()
);


-- =====================================================================
--  5. JE DOIS (elle emprunte)
-- =====================================================================
create table public.debts_owed (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  amount            bigint not null check (amount > 0),
  borrowed_on       date not null default current_date,
  due_date          date,
  received_via_id   uuid references public.payment_methods(id) on delete set null,
  reason            text,
  created_at        timestamptz not null default now()
);

create table public.debts_owed_repayments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  debt_id            uuid not null references public.debts_owed(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  paid_on            date not null default current_date,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);


-- =====================================================================
--  6. ON ME DOIT — prêts d'argent directs
--     (les ventes à crédit sont dans Business perso, regroupées dans la vue v_receivables)
-- =====================================================================
create table public.loans_given (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  amount            bigint not null check (amount > 0),
  lent_on           date not null default current_date,
  due_date          date,
  paid_via_id       uuid references public.payment_methods(id) on delete set null,
  reason            text,
  created_at        timestamptz not null default now()
);

create table public.loans_given_repayments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  loan_id            uuid not null references public.loans_given(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  received_on        date not null default current_date,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);


-- =====================================================================
--  7. BUSINESS PERSO (téléphones, accessoires, JBL, parfums, vêtements, riz…)
-- =====================================================================
create table public.biz_products (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  category         text,                          -- Téléphones, Accessoires, Audio, Parfums...
  unit             text default 'pièce',          -- pièce, kg, sac, kapoaka...
  cost_price       bigint not null default 0,     -- prix d'achat habituel
  sale_price       bigint not null default 0,     -- prix de vente habituel
  initial_stock    numeric not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Réapprovisionnements
create table public.biz_purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  supplier           text,
  purchased_on       date not null default current_date,
  total_amount       bigint not null check (total_amount >= 0),
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);

create table public.biz_purchase_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  purchase_id  uuid not null references public.biz_purchases(id) on delete cascade,
  product_id   uuid not null references public.biz_products(id) on delete restrict,
  quantity     numeric not null check (quantity > 0),
  unit_cost    bigint not null check (unit_cost >= 0)
);

-- Frais du business (transport, emballage, crédit téléphone...)
create table public.biz_expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  spent_on           date not null default current_date,
  category           text,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);

-- Ventes
create table public.biz_sales (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  contact_id        uuid references public.contacts(id) on delete set null,  -- client
  sold_on           date not null default current_date,
  payment_mode      text not null default 'comptant'
                    check (payment_mode in ('comptant','echelonne')),
  total_amount      bigint not null check (total_amount >= 0),  -- prix final convenu
  installments_nb   int check (installments_nb > 0),
  frequency         text check (frequency in ('hebdomadaire','quinzaine','mensuel','libre')),
  note              text,
  created_at        timestamptz not null default now()
);
create index on public.biz_sales (user_id, sold_on desc);

create table public.biz_sale_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  sale_id      uuid not null references public.biz_sales(id) on delete cascade,
  product_id   uuid not null references public.biz_products(id) on delete restrict,
  quantity     numeric not null check (quantity > 0),
  unit_price   bigint not null check (unit_price >= 0),
  unit_cost    bigint not null default 0      -- coût figé au moment de la vente (marge)
);

-- Échéancier prévu (généré par l'app à la création d'une vente échelonnée)
create table public.biz_installments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  sale_id    uuid not null references public.biz_sales(id) on delete cascade,
  due_date   date not null,
  amount     bigint not null check (amount > 0)
);

-- Encaissements réels (acompte inclus)
create table public.biz_sale_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  sale_id            uuid not null references public.biz_sales(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  paid_on            date not null default current_date,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  is_down_payment    boolean not null default false,
  note               text,
  created_at         timestamptz not null default now()
);


-- =====================================================================
--  8. INVESTISSEMENTS / COLLABORATIONS (coiffure, boutique d'un partenaire…)
-- =====================================================================
create table public.investments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  contact_id       uuid not null references public.contacts(id) on delete restrict, -- partenaire
  project_name     text not null,                 -- ex : "Salon de coiffure Tiana"
  activity         text,                          -- coiffure, boutique, autre
  agreement_type   text not null check (agreement_type in ('pret_remboursable','part_benefices')),
  share_pct        numeric check (share_pct between 0 and 100),
  expected_return  bigint,                        -- montant attendu si prêt remboursable
  start_date       date default current_date,
  status           text not null default 'actif' check (status in ('actif','termine','litige')),
  note             text,
  created_at       timestamptz not null default now()
);

create table public.investment_flows (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  investment_id      uuid not null references public.investments(id) on delete cascade,
  kind               text not null check (kind in ('apport','retour')),
  amount             bigint not null check (amount > 0),
  flow_on            date not null default current_date,
  payment_method_id  uuid references public.payment_methods(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);


-- =====================================================================
--  9. SPORT
-- =====================================================================
create table public.sport_venues (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table public.coaches (               -- indépendants des établissements
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,
  specialty   text,
  created_at  timestamptz not null default now()
);

create table public.sport_packages (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  venue_id         uuid references public.sport_venues(id) on delete set null,
  coach_id         uuid references public.coaches(id) on delete set null,
  kind             text not null check (kind in ('mensuel','forfait_seances')),
  sessions_total   int check (sessions_total > 0),
  price            bigint not null check (price >= 0),
  start_date       date not null default current_date,
  end_date         date,
  expense_id       uuid references public.expenses(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (venue_id is not null or coach_id is not null)
);

create table public.sport_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_date  timestamptz not null default now(),
  activity      text,
  venue_id      uuid references public.sport_venues(id) on delete set null,
  coach_id      uuid references public.coaches(id) on delete set null,
  package_id    uuid references public.sport_packages(id) on delete set null,
  price         bigint default 0,
  is_paid       boolean not null default false,
  expense_id    uuid references public.expenses(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);


-- =====================================================================
--  10. BEAUTÉ
-- =====================================================================
create table public.beauty_providers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        text default 'salon' check (kind in ('salon','domicile','independant')),
  phone       text,
  address     text,
  created_at  timestamptz not null default now()
);

create table public.beauty_services (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider_id       uuid references public.beauty_providers(id) on delete set null,
  service_date      timestamptz not null default now(),
  service_type      text not null,
  price             bigint not null default 0,
  is_paid           boolean not null default true,
  expense_id        uuid references public.expenses(id) on delete set null,
  next_appointment  timestamptz,
  note              text,
  created_at        timestamptz not null default now()
);


-- =====================================================================
--  SÉCURITÉ (RLS) : chaque compte ne voit que ses propres données
-- =====================================================================
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
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own_rows" on public.%I for all
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;


-- =====================================================================
--  VUES DE SYNTHÈSE (security_invoker => respectent le RLS)
-- =====================================================================

-- Tous les mouvements d'argent, par moyen de paiement (+ entrée / - sortie)
create view public.v_movements with (security_invoker = true) as
  select user_id, payment_method_id as method_id, -amount as delta, spent_on as on_date,
         'depense_perso' as kind, id as ref_id from public.expenses where payment_method_id is not null
  union all
  select user_id, card_id, -amount, withdrawn_on, 'retrait_sortie', id from public.cash_withdrawals
  union all
  select user_id, dest_method_id, amount, withdrawn_on, 'retrait_entree', id from public.cash_withdrawals
  union all
  select user_id, from_method_id, -amount, transfer_on, 'virement_sortie', id from public.transfers
  union all
  select user_id, to_method_id, amount, transfer_on, 'virement_entree', id from public.transfers
  union all
  select user_id, received_via_id, amount, borrowed_on, 'emprunt_recu', id from public.debts_owed
    where received_via_id is not null
  union all
  select user_id, payment_method_id, -amount, paid_on, 'remboursement_fait', id from public.debts_owed_repayments
    where payment_method_id is not null
  union all
  select user_id, paid_via_id, -amount, lent_on, 'pret_donne', id from public.loans_given
    where paid_via_id is not null
  union all
  select user_id, payment_method_id, amount, received_on, 'pret_rembourse', id from public.loans_given_repayments
    where payment_method_id is not null
  union all
  select user_id, payment_method_id, -total_amount, purchased_on, 'achat_stock', id from public.biz_purchases
    where payment_method_id is not null
  union all
  select user_id, payment_method_id, -amount, spent_on, 'frais_business', id from public.biz_expenses
    where payment_method_id is not null
  union all
  select user_id, payment_method_id, amount, paid_on, 'encaissement_vente', id from public.biz_sale_payments
    where payment_method_id is not null
  union all
  select user_id, payment_method_id,
         case when kind = 'apport' then -amount else amount end,
         flow_on, 'invest_' || kind, id from public.investment_flows
    where payment_method_id is not null;

-- Soldes : espèces perso, caisse business (et mobile money si suivi activé)
create view public.v_method_balances with (security_invoker = true) as
select pm.user_id, pm.id as method_id, pm.type, pm.name, pm.last4,
       pm.initial_balance + coalesce(sum(m.delta), 0) as balance
from public.payment_methods pm
left join public.v_movements m on m.method_id = pm.id
where pm.track_balance
group by pm.id;

-- Retraits par carte et par mois
create view public.v_withdrawals_by_card with (security_invoker = true) as
select w.user_id, w.card_id, pm.name as card_name, pm.last4,
       date_trunc('month', w.withdrawn_on)::date as month,
       count(*) as nb_retraits, sum(w.amount) as total_retire, sum(w.fees) as total_frais
from public.cash_withdrawals w
join public.payment_methods pm on pm.id = w.card_id
group by 1,2,3,4,5;

-- ---------- Business ----------

-- Stock actuel et valeur
create view public.v_stock with (security_invoker = true) as
select p.user_id, p.id as product_id, p.name, p.category, p.unit, p.cost_price, p.sale_price,
       p.initial_stock
       + coalesce((select sum(quantity) from public.biz_purchase_items i where i.product_id = p.id), 0)
       - coalesce((select sum(quantity) from public.biz_sale_items s where s.product_id = p.id), 0)
       as stock_qty
from public.biz_products p;

-- État de chaque vente : payé, reste, prochaine échéance, retard
create view public.v_sale_balances with (security_invoker = true) as
select s.user_id, s.id as sale_id, s.contact_id, c.name as customer_name, c.phone,
       s.sold_on, s.payment_mode, s.total_amount,
       coalesce(p.paid, 0) as paid,
       s.total_amount - coalesce(p.paid, 0) as remaining,
       i.next_due_date,
       coalesce(i.due_to_date, 0) as due_to_date,
       case
         when s.total_amount - coalesce(p.paid, 0) <= 0 then 'solde'
         when coalesce(p.paid, 0) < coalesce(i.due_to_date, 0) then 'en_retard'
         else 'en_cours'
       end as status
from public.biz_sales s
left join public.contacts c on c.id = s.contact_id
left join (select sale_id, sum(amount) as paid from public.biz_sale_payments group by sale_id) p
       on p.sale_id = s.id
left join (select sale_id,
                  sum(amount) filter (where due_date <= current_date) as due_to_date,
                  min(due_date) filter (where due_date > current_date) as next_due_date
           from public.biz_installments group by sale_id) i
       on i.sale_id = s.id;

-- Bilan business mensuel : CA, coût des ventes, marge, frais, encaissé
create view public.v_business_monthly with (security_invoker = true) as
with months as (
  select user_id, date_trunc('month', sold_on)::date as month from public.biz_sales
  union select user_id, date_trunc('month', spent_on)::date from public.biz_expenses
  union select user_id, date_trunc('month', paid_on)::date from public.biz_sale_payments
)
select m.user_id, m.month,
  coalesce((select sum(si.quantity * si.unit_price) from public.biz_sale_items si
            join public.biz_sales s on s.id = si.sale_id
            where s.user_id = m.user_id and date_trunc('month', s.sold_on) = m.month), 0) as chiffre_affaires,
  coalesce((select sum(si.quantity * si.unit_cost) from public.biz_sale_items si
            join public.biz_sales s on s.id = si.sale_id
            where s.user_id = m.user_id and date_trunc('month', s.sold_on) = m.month), 0) as cout_des_ventes,
  coalesce((select sum(amount) from public.biz_expenses e
            where e.user_id = m.user_id and date_trunc('month', e.spent_on) = m.month), 0) as frais,
  coalesce((select sum(amount) from public.biz_sale_payments sp
            where sp.user_id = m.user_id and date_trunc('month', sp.paid_on) = m.month), 0) as encaisse
from months m;
-- Bénéfice = chiffre_affaires - cout_des_ventes - frais (calculé dans l'app)

-- ---------- On me doit / Je dois ----------

-- Prêts directs : reste à recevoir
create view public.v_loan_balances with (security_invoker = true) as
select l.user_id, l.id as loan_id, l.contact_id, c.name, c.phone, l.amount, l.lent_on, l.due_date,
       coalesce(sum(r.amount), 0) as repaid,
       l.amount - coalesce(sum(r.amount), 0) as remaining,
       case when l.amount - coalesce(sum(r.amount), 0) <= 0 then 'solde'
            when l.due_date is not null and l.due_date < current_date then 'en_retard'
            else 'en_cours' end as status
from public.loans_given l
join public.contacts c on c.id = l.contact_id
left join public.loans_given_repayments r on r.loan_id = l.id
group by l.id, c.id;

-- ON ME DOIT : ventes à crédit + prêts, regroupés par personne
create view public.v_receivables with (security_invoker = true) as
select user_id, contact_id, max(name) as name, max(phone) as phone,
       sum(remaining) filter (where origin = 'vente') as reste_ventes,
       sum(remaining) filter (where origin = 'pret')  as reste_prets,
       sum(remaining) as reste_total,
       bool_or(status = 'en_retard') as a_un_retard
from (
  select user_id, contact_id, customer_name as name, phone, remaining, status, 'vente' as origin
    from public.v_sale_balances where remaining > 0 and contact_id is not null
  union all
  select user_id, contact_id, name, phone, remaining, status, 'pret'
    from public.v_loan_balances where remaining > 0
) x
group by user_id, contact_id;

-- JE DOIS : reste à rembourser
create view public.v_payables with (security_invoker = true) as
select d.user_id, d.id as debt_id, d.contact_id, c.name, c.phone, d.amount, d.borrowed_on, d.due_date,
       coalesce(sum(r.amount), 0) as repaid,
       d.amount - coalesce(sum(r.amount), 0) as remaining,
       case when d.amount - coalesce(sum(r.amount), 0) <= 0 then 'solde'
            when d.due_date is not null and d.due_date < current_date then 'en_retard'
            else 'en_cours' end as status
from public.debts_owed d
join public.contacts c on c.id = d.contact_id
left join public.debts_owed_repayments r on r.debt_id = d.id
group by d.id, c.id;

-- ---------- Investissements ----------
create view public.v_investment_summary with (security_invoker = true) as
select i.user_id, i.id as investment_id, i.project_name, i.activity, i.agreement_type, i.share_pct,
       i.status, c.name as partner_name, c.phone,
       coalesce(sum(f.amount) filter (where f.kind = 'apport'), 0) as total_investi,
       coalesce(sum(f.amount) filter (where f.kind = 'retour'), 0) as total_recupere,
       coalesce(sum(f.amount) filter (where f.kind = 'retour'), 0)
         - coalesce(sum(f.amount) filter (where f.kind = 'apport'), 0) as resultat,
       i.expected_return
from public.investments i
join public.contacts c on c.id = i.contact_id
left join public.investment_flows f on f.investment_id = i.id
group by i.id, c.id;

-- ---------- Perso ----------
create view public.v_project_summary with (security_invoker = true) as
select p.user_id, p.id as project_id, p.name, p.status, p.include_in_personal,
       count(e.id) as nb_depenses, coalesce(sum(e.amount), 0) as total,
       min(e.spent_on) as premiere_depense, max(e.spent_on) as derniere_depense
from public.projects p
left join public.expenses e on e.project_id = p.id
group by p.id;

create view public.v_sport_package_usage with (security_invoker = true) as
select pk.user_id, pk.id as package_id, pk.kind, pk.sessions_total, pk.price,
       count(s.id) as sessions_used,
       case when pk.kind = 'forfait_seances' then pk.sessions_total - count(s.id) end as sessions_left,
       case when count(s.id) > 0 then pk.price / count(s.id) end as cout_par_seance
from public.sport_packages pk
left join public.sport_sessions s on s.package_id = pk.id
group by pk.id;

create view public.v_monthly_personal with (security_invoker = true) as
select e.user_id, date_trunc('month', e.spent_on)::date as month,
       e.source, e.category_id, e.payment_method_id, sum(e.amount) as total
from public.expenses e
left join public.projects p on p.id = e.project_id
where e.project_id is null or p.include_in_personal
group by 1,2,3,4,5;
