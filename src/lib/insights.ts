import type { FormReq } from '../components/FormHost'
import { addMonths, fmt, isoOf, todayISO } from './format'
import { businessMonth } from './derive'
import type { useData } from './data'

/**
 * Analyses automatiques : l'app lit les chiffres et dit ce qui compte
 * (retards, échéances proches, stock qui dort, mois record…).
 */
export type Tone = 'good' | 'warn' | 'bad' | 'info'
export interface Insight { key: string; tone: Tone; title: string; text: string; open?: FormReq }
type D = ReturnType<typeof useData>

const days = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoOf(d) }
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null)
const A = (n: number) => fmt(n, 'Ar')

/* ---------- Ventes et encaissements ---------- */
export function salesInsights(d: D): Insight[] {
  const out: Insight[] = []
  const today = todayISO(), in7 = plusDays(7)
  const name = (id: string | null) => (id ? d.contactById.get(id)?.name : null) ?? 'Client'
  const late = d.sales.filter((s) => d.saleState.get(s.id)!.status === 'en_retard')
  if (late.length) {
    // Le retard le plus ancien : première échéance passée non couverte
    const oldest = late.map((s) => {
      const first = d.installments.filter((i) => i.sale_id === s.id && i.due_date <= today).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0]
      return { s, since: first ? days(first.due_date, today) : 0 }
    }).sort((a, b) => b.since - a.since)[0]
    out.push({ key: 'late', tone: 'bad', title: `${late.length} client${late.length > 1 ? 's' : ''} en retard`,
      text: `${A(late.reduce((a, s) => a + d.saleState.get(s.id)!.overdue, 0))} auraient déjà dû être payés. Le plus ancien : ${name(oldest.s.contact_id)} (${oldest.since} j).`,
      open: oldest.s.contact_id ? { f: 'contact', id: oldest.s.contact_id } : { f: 'saleDetail', id: oldest.s.id } })
  } else if (d.sales.some((s) => d.saleState.get(s.id)!.remaining > 0)) {
    out.push({ key: 'nolate', tone: 'good', title: 'Aucun retard', text: 'Tous tes clients à crédit sont à jour. Bravo !' })
  }
  const soon = d.installments.filter((i) => i.due_date >= today && i.due_date <= in7 && d.saleState.get(i.sale_id)!.remaining > 0)
  if (soon.length) out.push({ key: 'soon', tone: 'info', title: `${A(soon.reduce((a, i) => a + i.amount, 0))} attendus cette semaine`,
    text: `${soon.length} échéance${soon.length > 1 ? 's' : ''} d'ici 7 jours : ${[...new Set(soon.map((i) => name(d.saleById.get(i.sale_id)?.contact_id ?? null)))].slice(0, 3).join(', ')}.` })
  const month = today.slice(0, 7)
  const dueMonth = d.installments.filter((i) => i.due_date.startsWith(month)).reduce((a, i) => a + i.amount, 0)
  const paidMonth = d.salePayments.filter((p) => p.paid_on.startsWith(month) && !p.is_down_payment).reduce((a, p) => a + p.amount, 0)
  if (dueMonth > 0) {
    const r = Math.round((paidMonth / dueMonth) * 100)
    out.push({ key: 'rate', tone: r >= 80 ? 'good' : r >= 50 ? 'warn' : 'bad', title: `Recouvrement du mois : ${r} %`, text: `${A(paidMonth)} reçus sur ${A(dueMonth)} d'échéances prévues ce mois-ci.` })
  }
  const top = d.receivables.filter((r) => r.sales > 0).sort((a, b) => b.sales - a.sales)[0]
  if (top) out.push({ key: 'top', tone: 'info', title: `${d.contactById.get(top.contact_id)?.name} doit le plus`, text: `${A(top.sales)} restent sur ses achats à crédit.`, open: { f: 'contact', id: top.contact_id } })
  const byClient = new Map<string, number>()
  for (const s of d.sales) if (s.contact_id) byClient.set(s.contact_id, (byClient.get(s.contact_id) ?? 0) + s.total_amount)
  const best = [...byClient.entries()].sort((a, b) => b[1] - a[1])[0]
  if (best && byClient.size > 1) out.push({ key: 'best', tone: 'good', title: `Meilleur client : ${d.contactById.get(best[0])?.name}`, text: `${A(best[1])} d'achats au total.`, open: { f: 'contact', id: best[0] } })
  return out
}

/* ---------- Stock ---------- */
export function stockInsights(d: D): Insight[] {
  const out: Insight[] = []
  const d30 = plusDays(-30), d60 = plusDays(-60)
  const active = d.products.filter((p) => p.is_active)
  const empty = active.filter((p) => (d.stockOf.get(p.id) ?? 0) <= 0)
  if (empty.length) out.push({ key: 'empty', tone: 'bad', title: `${empty.length} produit${empty.length > 1 ? 's' : ''} épuisé${empty.length > 1 ? 's' : ''}`, text: `${empty.slice(0, 3).map((p) => p.name).join(', ')}${empty.length > 3 ? '…' : ''}. Pense à réapprovisionner.`, open: { f: 'purchase' } })
  const low = active.filter((p) => { const q = d.stockOf.get(p.id) ?? 0; return q > 0 && q <= 2 })
  if (low.length) out.push({ key: 'low', tone: 'warn', title: 'Stock bas', text: low.slice(0, 3).map((p) => `${p.name} (${String(d.stockOf.get(p.id)).replace('.', ',')})`).join(', ') })
  const saleDate = new Map(d.sales.map((s) => [s.id, s.sold_on]))
  const sold30 = new Map<string, number>(), lastSold = new Map<string, string>()
  for (const i of d.saleItems) {
    const dt = saleDate.get(i.sale_id) ?? ''
    if (dt >= d30) sold30.set(i.product_id, (sold30.get(i.product_id) ?? 0) + i.quantity)
    if (!lastSold.has(i.product_id) || dt > lastSold.get(i.product_id)!) lastSold.set(i.product_id, dt)
  }
  const star = [...sold30.entries()].sort((a, b) => b[1] - a[1])[0]
  if (star) out.push({ key: 'star', tone: 'good', title: `Le plus vendu : ${d.productById.get(star[0])?.name}`, text: `${String(star[1]).replace('.', ',')} vendu${star[1] > 1 ? 's' : ''} ces 30 derniers jours.` })
  const sleeping = active.filter((p) => (d.stockOf.get(p.id) ?? 0) > 0 && (lastSold.get(p.id) ?? '') < d60)
  if (sleeping.length) {
    const val = sleeping.reduce((a, p) => a + (d.stockOf.get(p.id) ?? 0) * p.cost_price, 0)
    out.push({ key: 'sleep', tone: 'warn', title: `${sleeping.length} produit${sleeping.length > 1 ? 's' : ''} qui dorment`, text: `Pas vendus depuis 60 jours : ${A(val)} immobilisés (${sleeping.slice(0, 2).map((p) => p.name).join(', ')}). Une promo ?` })
  }
  const margins = active.filter((p) => p.sale_price > 0).map((p) => ({ p, m: (p.sale_price - p.cost_price) / p.sale_price })).sort((a, b) => b.m - a.m)
  if (margins.length > 1) out.push({ key: 'margin', tone: 'info', title: `Meilleure marge : ${margins[0].p.name}`, text: `${Math.round(margins[0].m * 100)} % de bénéfice sur le prix de vente (${A(margins[0].p.sale_price - margins[0].p.cost_price)} par ${margins[0].p.unit ?? 'pièce'}).` })
  return out
}

/* ---------- Achats et frais ---------- */
export function costInsights(d: D, month: string): Insight[] {
  const out: Insight[] = []
  const b = businessMonth(d, month), prev = businessMonth(d, addMonths(month, -1))
  const p = pct(b.achats + b.frais, prev.achats + prev.frais)
  if (p !== null) out.push({ key: 'trend', tone: p > 20 ? 'warn' : 'info', title: `Dépenses business ${p >= 0 ? '+' : ''}${p} %`, text: `${A(b.achats + b.frais)} ce mois contre ${A(prev.achats + prev.frais)} le mois précédent.` })
  const cats = new Map<string, number>()
  for (const e of d.bizExpenses.filter((x) => x.spent_on.startsWith(month))) cats.set(e.category ?? 'Autres', (cats.get(e.category ?? 'Autres') ?? 0) + e.amount)
  const big = [...cats.entries()].sort((a, b2) => b2[1] - a[1])[0]
  if (big) out.push({ key: 'big', tone: 'info', title: `Plus gros frais : ${big[0]}`, text: `${A(big[1])} ce mois-ci.` })
  if (b.ca > 0) {
    const r = Math.round((b.frais / b.ca) * 100)
    out.push({ key: 'ratio', tone: r > 15 ? 'warn' : 'good', title: `Frais = ${r} % des ventes`, text: r > 15 ? 'Les frais mangent une bonne part de la marge.' : 'Les frais restent légers par rapport aux ventes.' })
  }
  return out
}

/* ---------- Bilan ---------- */
export function monthSeries(d: D, month: string, n = 6) {
  return Array.from({ length: n }, (_, i) => { const m = addMonths(month, i - n + 1); return { m, ...businessMonth(d, m) } })
}
export function bilanInsights(d: D, month: string): Insight[] {
  const out: Insight[] = []
  const b = businessMonth(d, month), prev = businessMonth(d, addMonths(month, -1))
  const p = pct(b.ca, prev.ca)
  if (p !== null) out.push({ key: 'ca', tone: p >= 0 ? 'good' : 'warn', title: `Ventes ${p >= 0 ? '+' : ''}${p} % vs mois précédent`, text: `${A(b.ca)} contre ${A(prev.ca)}.` })
  if (b.ca > 0) out.push({ key: 'marge', tone: 'info', title: `Marge brute : ${Math.round(((b.ca - b.cogs) / b.ca) * 100)} %`, text: `Sur 100 Ar vendus, il reste ${Math.round(((b.ca - b.cogs) / b.ca) * 100)} Ar après le prix d'achat des produits.` })
  const series = monthSeries(d, month)
  const best = [...series].sort((a, c) => c.benefice - a.benefice)[0]
  if (best && best.benefice > 0) out.push({ key: 'best', tone: 'good', title: 'Meilleur mois (6 derniers)', text: `${best.m === month ? 'Ce mois-ci' : best.m} avec ${A(best.benefice)} de bénéfice.` })
  if (b.ca > 0 && b.encaisse < b.ca * 0.5) out.push({ key: 'cash', tone: 'warn', title: 'Beaucoup de ventes à crédit', text: `Seulement ${A(b.encaisse)} encaissés pour ${A(b.ca)} vendus : surveille les échéances.` })
  return out
}

/* ---------- Business Pro ---------- */
export function proInsights(d: D): Insight[] {
  const out: Insight[] = []
  const today = todayISO(), d60 = plusDays(-60), month = today.slice(0, 7)
  const inv = d.investments.reduce((a, i) => a + d.investState.get(i.id)!.invested, 0)
  const ret = d.investments.reduce((a, i) => a + d.investState.get(i.id)!.returned, 0)
  if (inv > 0) out.push({ key: 'yield', tone: ret >= inv ? 'good' : 'info', title: `${Math.round((ret / inv) * 100)} % de l'investi récupéré`, text: ret >= inv ? `Gain net de ${A(ret - inv)}.` : `Encore ${A(inv - ret)} dehors.` })
  const ranked = d.investments.map((i) => ({ i, s: d.investState.get(i.id)! })).filter((x) => x.s.invested > 0).sort((a, b) => b.s.returned / b.s.invested - a.s.returned / a.s.invested)
  if (ranked.length > 1) out.push({ key: 'best', tone: 'good', title: `Plus rentable : ${ranked[0].i.project_name}`, text: `${Math.round((ranked[0].s.returned / ranked[0].s.invested) * 100)} % récupéré.`, open: { f: 'investDetail', id: ranked[0].i.id } })
  for (const i of d.investments.filter((x) => x.status === 'actif')) {
    const last = d.flows.filter((f) => f.investment_id === i.id && f.kind === 'retour').map((f) => f.flow_on).sort().pop()
    if ((last ?? i.start_date ?? '') < d60) out.push({ key: `quiet${i.id}`, tone: 'warn', title: `Rien reçu de ${i.project_name}`, text: last ? `Dernier retour il y a ${days(last, today)} jours. Demande un point à ${d.contactById.get(i.contact_id)?.name}.` : `Aucun retour depuis le début. Demande un point à ${d.contactById.get(i.contact_id)?.name}.`, open: { f: 'investDetail', id: i.id } })
  }
  const got = d.flows.filter((f) => f.kind === 'retour' && f.flow_on.startsWith(month)).reduce((a, f) => a + f.amount, 0)
  if (got > 0) out.push({ key: 'month', tone: 'good', title: `${A(got)} reçus ce mois-ci`, text: 'Retours de tes collaborations.' })
  return out
}
