-- L'acompte ne rembourse pas les échéances : le retard se calcule sur les autres versements.
create or replace view public.v_sale_balances with (security_invoker = true) as
select s.user_id, s.id as sale_id, s.contact_id, c.name as customer_name, c.phone,
       s.sold_on, s.payment_mode, s.total_amount,
       coalesce(p.paid, 0) as paid,
       s.total_amount - coalesce(p.paid, 0) as remaining,
       i.next_due_date,
       coalesce(i.due_to_date, 0) as due_to_date,
       case
         when s.total_amount - coalesce(p.paid, 0) <= 0 then 'solde'
         when coalesce(p.paid, 0) - coalesce(p.down_paid, 0) < coalesce(i.due_to_date, 0) then 'en_retard'
         else 'en_cours'
       end as status
from public.biz_sales s
left join public.contacts c on c.id = s.contact_id
left join (select sale_id, sum(amount) as paid, sum(amount) filter (where is_down_payment) as down_paid
           from public.biz_sale_payments group by sale_id) p on p.sale_id = s.id
left join (select sale_id,
                  sum(amount) filter (where due_date <= current_date) as due_to_date,
                  min(due_date) filter (where due_date > current_date) as next_due_date
           from public.biz_installments group by sale_id) i on i.sale_id = s.id;

-- Chiffre d'affaires = prix final convenu (remises comprises)
create or replace view public.v_business_monthly with (security_invoker = true) as
with months as (
  select user_id, date_trunc('month', sold_on)::date as month from public.biz_sales
  union select user_id, date_trunc('month', spent_on)::date from public.biz_expenses
  union select user_id, date_trunc('month', paid_on)::date from public.biz_sale_payments
)
select m.user_id, m.month,
  coalesce((select sum(s.total_amount) from public.biz_sales s
            where s.user_id = m.user_id and date_trunc('month', s.sold_on) = m.month), 0) as chiffre_affaires,
  coalesce((select sum(si.quantity * si.unit_cost) from public.biz_sale_items si
            join public.biz_sales s on s.id = si.sale_id
            where s.user_id = m.user_id and date_trunc('month', s.sold_on) = m.month), 0) as cout_des_ventes,
  coalesce((select sum(amount) from public.biz_expenses e
            where e.user_id = m.user_id and date_trunc('month', e.spent_on) = m.month), 0) as frais,
  coalesce((select sum(amount) from public.biz_sale_payments sp
            where sp.user_id = m.user_id and date_trunc('month', sp.paid_on) = m.month), 0) as encaisse
from months m;
