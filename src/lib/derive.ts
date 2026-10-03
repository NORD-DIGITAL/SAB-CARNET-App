import { isoOf, todayISO } from './format'
import type { DebtStatus } from './types'
import type { Store } from './data'

/**
 * Calculs dérivés, faits sur le téléphone à partir des données chargées.
 * Ils reprennent exactement la logique des vues SQL (v_movements, v_method_balances, v_stock,
 * v_sale_balances, v_receivables, v_payables) pour que l'app et la base disent la même chose.
 */

export type MoveKind =
  | 'depense_perso' | 'retrait_sortie' | 'retrait_entree' | 'virement_sortie' | 'virement_entree'
  | 'emprunt_recu' | 'remboursement_fait' | 'pret_donne' | 'pret_rembourse'
  | 'achat_stock' | 'frais_business' | 'encaissement_vente' | 'invest_apport' | 'invest_retour'
export interface Movement { key: string; kind: MoveKind; method_id: string; delta: number; on_date: string; ref_id: string }

export interface SaleState { paid: number; remaining: number; dueToDate: number; overdue: number; nextDue: string | null; status: DebtStatus }
export interface SimpleDebtState { repaid: number; remaining: number; status: DebtStatus }
/** Par personne, sur les dossiers encore ouverts : montant de départ, déjà remboursé, reste. */
export interface ContactBalance { contact_id: string; sales: number; loans: number; total: number; principal: number; repaid: number; late: boolean; nextDue: string | null; count: number }

export interface Derived {
  movements: Movement[]
  balanceOf: Map<string, number>
  stockOf: Map<string, number>
  saleState: Map<string, SaleState>
  loanState: Map<string, SimpleDebtState>
  debtState: Map<string, SimpleDebtState>
  receivables: ContactBalance[]
  receivableTotal: number
  receivableLate: number
  receivablePrincipal: number
  payables: ContactBalance[]
  payableTotal: number
  payablePrincipal: number
  investState: Map<string, { invested: number; returned: number; result: number }>
}

const status = (remaining: number, late: boolean): DebtStatus => (remaining <= 0 ? 'solde' : late ? 'en_retard' : 'en_cours')
const sumBy = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => number) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r))
  return m
}

export function derive(s: Store): Derived {
  const today = todayISO()

  /* ---------- Mouvements d'argent par moyen de paiement ---------- */
  const mv: Movement[] = []
  const push = (kind: MoveKind, method: string | null, delta: number, on: string, id: string) => {
    if (method) mv.push({ key: `${kind}:${id}`, kind, method_id: method, delta, on_date: on, ref_id: id })
  }
  for (const e of s.expenses) push('depense_perso', e.payment_method_id, -e.amount, e.spent_on, e.id)
  for (const w of s.withdrawals) { push('retrait_sortie', w.card_id, -w.amount, w.withdrawn_on, w.id); push('retrait_entree', w.dest_method_id, w.amount, w.withdrawn_on, w.id) }
  for (const t of s.transfers) { push('virement_sortie', t.from_method_id, -t.amount, t.transfer_on, t.id); push('virement_entree', t.to_method_id, t.amount, t.transfer_on, t.id) }
  for (const d of s.debts) push('emprunt_recu', d.received_via_id, d.amount, d.borrowed_on, d.id)
  for (const r of s.debtRepayments) push('remboursement_fait', r.payment_method_id, -r.amount, r.paid_on, r.id)
  for (const l of s.loans) push('pret_donne', l.paid_via_id, -l.amount, l.lent_on, l.id)
  for (const r of s.loanRepayments) push('pret_rembourse', r.payment_method_id, r.amount, r.received_on, r.id)
  for (const p of s.purchases) push('achat_stock', p.payment_method_id, -p.total_amount, p.purchased_on, p.id)
  for (const e of s.bizExpenses) push('frais_business', e.payment_method_id, -e.amount, e.spent_on, e.id)
  for (const p of s.salePayments) push('encaissement_vente', p.payment_method_id, p.amount, p.paid_on, p.id)
  for (const f of s.flows) push(f.kind === 'apport' ? 'invest_apport' : 'invest_retour', f.payment_method_id, f.kind === 'apport' ? -f.amount : f.amount, f.flow_on, f.id)

  const balanceOf = new Map<string, number>()
  for (const m of s.methods) balanceOf.set(m.id, m.initial_balance)
  for (const m of mv) balanceOf.set(m.method_id, (balanceOf.get(m.method_id) ?? 0) + m.delta)

  /* ---------- Stock ---------- */
  const bought = sumBy(s.purchaseItems, (i) => i.product_id, (i) => i.quantity)
  const sold = sumBy(s.saleItems, (i) => i.product_id, (i) => i.quantity)
  const stockOf = new Map(s.products.map((p) => [p.id, p.initial_stock + (bought.get(p.id) ?? 0) - (sold.get(p.id) ?? 0)]))

  /* ---------- Ventes : payé, reste, échéances ---------- */
  const paidBySale = sumBy(s.salePayments, (p) => p.sale_id, (p) => p.amount)
  // L'acompte est hors échéancier : seuls les autres versements remboursent les échéances
  const downBySale = sumBy(s.salePayments.filter((p) => p.is_down_payment), (p) => p.sale_id, (p) => p.amount)
  const dueBySale = sumBy(s.installments.filter((i) => i.due_date <= today), (i) => i.sale_id, (i) => i.amount)
  const nextBySale = new Map<string, string>()
  for (const i of s.installments) if (i.due_date > today) { const c = nextBySale.get(i.sale_id); if (!c || i.due_date < c) nextBySale.set(i.sale_id, i.due_date) }
  const saleState = new Map<string, SaleState>()
  for (const sale of s.sales) {
    const paid = paidBySale.get(sale.id) ?? 0
    const remaining = sale.total_amount - paid
    const dueToDate = dueBySale.get(sale.id) ?? 0
    const towardSchedule = paid - (downBySale.get(sale.id) ?? 0)
    const overdue = Math.max(0, Math.min(remaining, dueToDate - towardSchedule))
    saleState.set(sale.id, { paid, remaining, dueToDate, overdue, nextDue: nextBySale.get(sale.id) ?? null, status: status(remaining, overdue > 0) })
  }

  /* ---------- Prêts donnés et dettes ---------- */
  const repaidLoan = sumBy(s.loanRepayments, (r) => r.loan_id, (r) => r.amount)
  const loanState = new Map(s.loans.map((l) => {
    const repaid = repaidLoan.get(l.id) ?? 0, remaining = l.amount - repaid
    return [l.id, { repaid, remaining, status: status(remaining, !!l.due_date && l.due_date < today) }]
  }))
  const repaidDebt = sumBy(s.debtRepayments, (r) => r.debt_id, (r) => r.amount)
  const debtState = new Map(s.debts.map((d) => {
    const repaid = repaidDebt.get(d.id) ?? 0, remaining = d.amount - repaid
    return [d.id, { repaid, remaining, status: status(remaining, !!d.due_date && d.due_date < today) }]
  }))

  /* ---------- On me doit / Je dois (par personne, dossiers ouverts) ---------- */
  const blank = (id: string): ContactBalance => ({ contact_id: id, sales: 0, loans: 0, total: 0, principal: 0, repaid: 0, late: false, nextDue: null, count: 0 })
  const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b)
  const rec = new Map<string, ContactBalance>()
  const recOf = (id: string) => { if (!rec.has(id)) rec.set(id, blank(id)); return rec.get(id)! }
  for (const sale of s.sales) {
    const st = saleState.get(sale.id)!
    if (!sale.contact_id || st.remaining <= 0) continue
    const r = recOf(sale.contact_id)
    r.sales += st.remaining; r.total += st.remaining; r.principal += sale.total_amount; r.repaid += st.paid; r.count++
    r.late ||= st.status === 'en_retard'; r.nextDue = minDate(r.nextDue, st.nextDue)
  }
  for (const l of s.loans) {
    const st = loanState.get(l.id)!
    if (st.remaining <= 0) continue
    const r = recOf(l.contact_id)
    r.loans += st.remaining; r.total += st.remaining; r.principal += l.amount; r.repaid += st.repaid; r.count++
    r.late ||= st.status === 'en_retard'; r.nextDue = minDate(r.nextDue, l.due_date && l.due_date >= today ? l.due_date : null)
  }
  const receivables = [...rec.values()].sort((a, b) => Number(b.late) - Number(a.late) || b.total - a.total)

  const pay = new Map<string, ContactBalance>()
  for (const d of s.debts) {
    const st = debtState.get(d.id)!
    if (st.remaining <= 0) continue
    const p = pay.get(d.contact_id) ?? blank(d.contact_id)
    p.loans += st.remaining; p.total += st.remaining; p.principal += d.amount; p.repaid += st.repaid; p.count++
    p.late ||= st.status === 'en_retard'; p.nextDue = minDate(p.nextDue, d.due_date && d.due_date >= today ? d.due_date : null)
    pay.set(d.contact_id, p)
  }
  const payables = [...pay.values()].sort((a, b) => Number(b.late) - Number(a.late) || b.total - a.total)

  /* ---------- Business Pro ---------- */
  const investState = new Map(s.investments.map((i) => {
    const fl = s.flows.filter((f) => f.investment_id === i.id)
    const invested = fl.filter((f) => f.kind === 'apport').reduce((a, f) => a + f.amount, 0)
    const returned = fl.filter((f) => f.kind === 'retour').reduce((a, f) => a + f.amount, 0)
    return [i.id, { invested, returned, result: returned - invested }]
  }))

  return {
    movements: mv.sort((a, b) => (a.on_date < b.on_date ? 1 : a.on_date > b.on_date ? -1 : 0)),
    balanceOf, stockOf, saleState, loanState, debtState,
    receivables, receivableTotal: receivables.reduce((a, r) => a + r.total, 0), receivableLate: receivables.filter((r) => r.late).length,
    receivablePrincipal: receivables.reduce((a, r) => a + r.principal, 0),
    payables, payableTotal: payables.reduce((a, r) => a + r.total, 0), payablePrincipal: payables.reduce((a, r) => a + r.principal, 0),
    investState,
  }
}

/** Bilan business d'un mois (AAAA-MM) : chiffre d'affaires, coût des marchandises vendues, frais, bénéfice, encaissé, achats. */
export function businessMonth(s: Store, month: string) {
  const saleIds = new Set(s.sales.filter((x) => x.sold_on.startsWith(month)).map((x) => x.id))
  const items = s.saleItems.filter((i) => saleIds.has(i.sale_id))
  const ca = s.sales.filter((x) => saleIds.has(x.id)).reduce((a, x) => a + x.total_amount, 0)
  const cogs = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0)
  const frais = s.bizExpenses.filter((e) => e.spent_on.startsWith(month)).reduce((a, e) => a + e.amount, 0)
  const encaisse = s.salePayments.filter((p) => p.paid_on.startsWith(month)).reduce((a, p) => a + p.amount, 0)
  const achats = s.purchases.filter((p) => p.purchased_on.startsWith(month)).reduce((a, p) => a + p.total_amount, 0)
  return { ca, cogs, frais, benefice: ca - cogs - frais, encaisse, achats, nbVentes: saleIds.size }
}

/** Dépenses perso d'un mois (sport, beauté et dépenses fixes compris), hors projets comptés à part. */
export function personalExpenses(s: Store, month: string) {
  const apart = new Set(s.projects.filter((p) => !p.include_in_personal).map((p) => p.id))
  return s.expenses.filter((e) => e.spent_on.startsWith(month) && !(e.project_id && apart.has(e.project_id)))
}
export const fixedExpenses = (s: Store, month: string) => s.expenses.filter((e) => e.is_fixed && e.spent_on.startsWith(month))

/** Découpe un reste à payer en N échéances (la dernière absorbe l'arrondi). */
export function splitInstallments(total: number, n: number, first: string, freq: 'hebdomadaire' | 'quinzaine' | 'mensuel' | 'libre') {
  if (n < 1 || total <= 0) return [] as { due_date: string; amount: number }[]
  const base = Math.floor(total / n / 100) * 100 || Math.floor(total / n)
  const out: { due_date: string; amount: number }[] = []
  const [y, m, d] = first.split('-').map(Number)
  for (let i = 0; i < n; i++) {
    const dt = freq === 'mensuel' ? new Date(y, m - 1 + i, Math.min(d, new Date(y, m + i, 0).getDate()))
      : new Date(y, m - 1, d + i * (freq === 'hebdomadaire' ? 7 : freq === 'quinzaine' ? 15 : 30))
    out.push({ due_date: isoOf(dt), amount: i === n - 1 ? total - base * (n - 1) : base })
  }
  return out
}
