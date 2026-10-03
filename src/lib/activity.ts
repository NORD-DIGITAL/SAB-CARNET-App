import type { FormReq } from '../components/FormHost'
import { methodLabel } from '../components/forms'
import type { useData } from './data'

export type Scope = 'perso' | 'business' | 'dettes'
export type Tone = 'out' | 'in' | 'neutral'
export interface Activity {
  key: string; date: string; created: string; scope: Scope; tone: Tone
  title: string; sub: string; amount: number; icon: string; methods: string[]; open: FormReq
}

/** Toutes les opérations, sous une forme commune, pour l'accueil et l'historique. */
export function buildActivity(d: ReturnType<typeof useData>): Activity[] {
  const { expenses, withdrawals, transfers, sales, salePayments, purchases, bizExpenses, debts, debtRepayments, loans, loanRepayments,
    catById, methodById, contactById, saleById, saleItems, productById } = d
  const m = (id: string | null | undefined) => methodLabel(id ? methodById.get(id) : undefined)
  const who = (id: string | null | undefined) => (id ? contactById.get(id)?.name : undefined) ?? 'Client'
  const what = (saleId: string) => saleItems.filter((i) => i.sale_id === saleId).map((i) => productById.get(i.product_id)?.name).filter(Boolean).join(', ')
  const out: Activity[] = []
  const add = (a: Omit<Activity, 'sub'> & { sub: (string | null | undefined)[] }) => out.push({ ...a, sub: a.sub.filter(Boolean).join(' · ') })

  for (const e of expenses) {
    const c = e.category_id ? catById.get(e.category_id) : undefined
    add({ key: `e${e.id}`, date: e.spent_on, created: e.created_at, scope: 'perso', tone: 'out', title: c?.name ?? e.label ?? 'Dépense', icon: c?.name ?? 'autre',
      sub: [c ? e.label : null, m(e.payment_method_id), e.card_operation === 'tpe' ? 'TPE' : e.card_operation === 'en_ligne' ? 'en ligne' : null],
      amount: e.amount, methods: [e.payment_method_id ?? ''], open: { f: 'expense', item: e } })
  }
  for (const w of withdrawals) add({ key: `w${w.id}`, date: w.withdrawn_on, created: w.created_at, scope: 'perso', tone: 'neutral', title: 'Retrait DAB', icon: 'banque',
    sub: [`${m(w.card_id)} → ${m(w.dest_method_id)}`, w.place], amount: w.amount, methods: [w.card_id, w.dest_method_id], open: { f: 'withdrawal', item: w } })
  for (const t of transfers) add({ key: `t${t.id}`, date: t.transfer_on, created: t.created_at, scope: 'perso', tone: 'neutral', title: 'Virement', icon: 'portefeuille',
    sub: [`${m(t.from_method_id)} → ${m(t.to_method_id)}`, t.note], amount: t.amount, methods: [t.from_method_id, t.to_method_id], open: { f: 'transfer', item: t } })
  for (const s of sales) add({ key: `s${s.id}`, date: s.sold_on, created: s.created_at, scope: 'business', tone: 'neutral', title: `Vente · ${s.contact_id ? who(s.contact_id) : 'comptant'}`, icon: 'vente',
    sub: [what(s.id), s.payment_mode === 'echelonne' ? `en ${s.installments_nb} fois` : 'comptant'], amount: s.total_amount, methods: [], open: { f: 'saleDetail', id: s.id } })
  for (const p of salePayments) {
    const s = saleById.get(p.sale_id)
    add({ key: `p${p.id}`, date: p.paid_on, created: p.created_at, scope: 'business', tone: 'in', title: s?.contact_id ? `${p.is_down_payment ? 'Acompte' : 'Versement'} · ${who(s.contact_id)}` : 'Encaissement · vente comptant', icon: 'espèces',
      sub: [m(p.payment_method_id), p.note], amount: p.amount, methods: [p.payment_method_id ?? ''], open: s ? { f: 'salePayment', sale: s, item: p } : { f: 'quick' } })
  }
  for (const p of purchases) add({ key: `a${p.id}`, date: p.purchased_on, created: p.created_at, scope: 'business', tone: 'out', title: 'Achat de stock', icon: 'achat',
    sub: [p.supplier, m(p.payment_method_id)], amount: p.total_amount, methods: [p.payment_method_id ?? ''], open: { f: 'purchase', item: p } })
  for (const e of bizExpenses) add({ key: `b${e.id}`, date: e.spent_on, created: e.created_at, scope: 'business', tone: 'out', title: `Frais · ${e.category ?? 'business'}`, icon: e.category ?? 'business',
    sub: [m(e.payment_method_id), e.note], amount: e.amount, methods: [e.payment_method_id ?? ''], open: { f: 'bizExpense', item: e } })
  for (const x of debts) add({ key: `d${x.id}`, date: x.borrowed_on, created: '', scope: 'dettes', tone: x.received_via_id ? 'in' : 'neutral', title: `Emprunt · ${who(x.contact_id)}`, icon: 'dette',
    sub: [m(x.received_via_id), x.reason], amount: x.amount, methods: [x.received_via_id ?? ''], open: { f: 'contact', id: x.contact_id } })
  for (const r of debtRepayments) {
    const x = debts.find((y) => y.id === r.debt_id)
    add({ key: `dr${r.id}`, date: r.paid_on, created: '', scope: 'dettes', tone: 'out', title: `Je rembourse ${who(x?.contact_id)}`, icon: 'dette',
      sub: [m(r.payment_method_id), r.note], amount: r.amount, methods: [r.payment_method_id ?? ''], open: x ? { f: 'repay', kind: 'je_dois', parent: x, item: r } : { f: 'quick' } })
  }
  for (const l of loans) add({ key: `l${l.id}`, date: l.lent_on, created: '', scope: 'dettes', tone: l.paid_via_id ? 'out' : 'neutral', title: `Prêt à ${who(l.contact_id)}`, icon: 'prêt',
    sub: [m(l.paid_via_id), l.reason], amount: l.amount, methods: [l.paid_via_id ?? ''], open: { f: 'contact', id: l.contact_id } })
  for (const r of loanRepayments) {
    const l = loans.find((y) => y.id === r.loan_id)
    add({ key: `lr${r.id}`, date: r.received_on, created: '', scope: 'dettes', tone: 'in', title: `${who(l?.contact_id)} me rembourse`, icon: 'prêt',
      sub: [m(r.payment_method_id), r.note], amount: r.amount, methods: [r.payment_method_id ?? ''], open: l ? { f: 'repay', kind: 'on_me_doit', parent: l, item: r } : { f: 'quick' } })
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.created < b.created ? 1 : -1))
}
