import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, Boxes, Briefcase, ChartColumn, PackagePlus, Plus, Search, ShoppingBag, Truck } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt, todayISO } from '../lib/format'
import { businessMonth } from '../lib/derive'
import { useHidden } from '../lib/prefs'
import type { DebtStatus } from '../lib/types'
import { Empty, Header, IconTile } from '../components/ui'
import { MonthBar, fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { StatusBadge } from '../components/SaleDetail'
import { chip, methodLabel } from '../components/forms'
import { SectionTiles, Bar } from '../components/Tiles'
import { AGREEMENT, INV_STATUS } from '../components/ProForms'

type Tab = 'ventes' | 'stock' | 'achats' | 'bilan' | 'pro'

export default function BusinessScreen() {
  const d = useData()
  const { methods, balanceOf, month, sales, saleState, salePayments, products, stockOf, investments, investState, cur } = d
  const forms = useForms()
  const [hidden] = useHidden()
  const [tab, setTab] = useState<Tab>('ventes')
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))
  const caisse = methods.find((m) => m.is_active && m.type === 'caisse_business')
  const b = businessMonth(d, month)
  const today = todayISO()
  const open = sales.filter((s) => saleState.get(s.id)!.remaining > 0)
  const toCollect = open.reduce((a, s) => a + saleState.get(s.id)!.remaining, 0)
  const late = open.filter((s) => saleState.get(s.id)!.status === 'en_retard')
  const lateAmt = late.reduce((a, s) => a + saleState.get(s.id)!.overdue, 0)
  const todayIn = salePayments.filter((p) => p.paid_on === today).reduce((a, p) => a + p.amount, 0)
  const todaySales = sales.filter((s) => s.sold_on === today).length
  const empty = products.filter((p) => p.is_active && (stockOf.get(p.id) ?? 0) <= 0).length
  const proActive = investments.filter((i) => i.status === 'actif')
  const proOut = proActive.reduce((a, i) => a + Math.max(0, -(investState.get(i.id)?.result ?? 0)), 0)

  return (
    <div className="lg:mx-auto lg:max-w-5xl 3xl:max-w-7xl">
      <Header title="Business" />
      <div className="space-y-4 px-5 pb-4 lg:px-8">
        {/* Tableau de bord de la caisse business */}
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0F1B3D] via-[#14264F] to-[#0B3B5C] text-white shadow-lg">
          <div className="p-5 lg:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/60">{caisse?.name ?? 'Caisse business'}</p>
                <p className="tabular whitespace-nowrap text-[2.25rem] font-bold leading-tight sm:text-[2.5rem] lg:text-5xl">{mask(caisse ? balanceOf.get(caisse.id) ?? 0 : 0)}</p>
                <p className="text-sm text-white/60">{b.nbVentes} vente{b.nbVentes > 1 ? 's' : ''} ce mois · bénéfice {mask(b.benefice)}</p>
              </div>
              <button onClick={() => setTab('ventes')} className="w-full rounded-2xl px-4 py-3 text-left text-ink transition active:scale-[.98] sm:w-auto" style={{ background: 'var(--accent)' }}>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider opacity-80">À encaisser</p>
                <p className="tabular whitespace-nowrap text-2xl font-bold">{mask(toCollect)}</p>
                <p className="text-xs font-medium opacity-80">{open.length} client{open.length > 1 ? 's' : ''}{late.length ? ` · ${late.length} en retard` : ''}</p>
              </button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 lg:gap-3">
              {[
                { l: "Chiffre d'affaires", v: mask(b.ca), s: 'ce mois' },
                { l: 'Encaissé', v: mask(b.encaisse), s: 'ce mois' },
                { l: 'En retard', v: mask(lateAmt), s: `${late.length} vente${late.length > 1 ? 's' : ''}`, red: lateAmt > 0 },
              ].map((x) => (
                <div key={x.l} className={`rounded-2xl p-3 ${x.red ? 'bg-red-500/25' : 'bg-white/10'}`}>
                  <p className="truncate text-[0.6875rem] text-white/70">{x.l}</p>
                  <p className="tabular truncate text-sm font-bold sm:text-base lg:text-lg">{x.v}</p>
                  <p className="text-[0.6875rem] text-white/50">{x.s}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <button onClick={() => forms.open({ f: 'sale' })} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl py-3.5 text-lg font-semibold text-ink active:scale-[.98]" style={{ background: 'var(--accent)' }}><ShoppingBag size={22} /> Nouvelle vente</button>
              <div className="grid grid-cols-3 gap-2 sm:contents">
                {([['pickSale', 'Versement', Banknote], ['purchase', 'Réappro', PackagePlus], ['bizExpense', 'Frais', Truck]] as const).map(([f, l, I]) => (
                  <button key={f} onClick={() => forms.open({ f })} title={l} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm hover:bg-white/20 sm:w-14 sm:py-0"><I size={20} /><span className="sm:sr-only">{l}</span></button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-black/15 px-5 py-3 text-sm text-white/70 lg:px-6">
            <span>Aujourd'hui</span><span className="tabular font-semibold text-white">{todaySales} vente{todaySales > 1 ? 's' : ''} · {mask(todayIn)} encaissés</span>
          </div>
        </section>

        <SectionTiles value={tab} onChange={setTab}
          items={[
            { k: 'ventes', label: 'Ventes', Icon: ShoppingBag, value: `${open.length} à encaisser`, badge: late.length ? `${late.length} retard` : undefined, alert: late.length > 0 },
            { k: 'stock', label: 'Stock', Icon: Boxes, value: `${products.filter((p) => p.is_active).length} produits`, badge: empty ? `${empty} vide${empty > 1 ? 's' : ''}` : undefined, alert: empty > 0 },
            { k: 'achats', label: 'Achats & frais', Icon: Truck, value: mask(b.achats + b.frais) },
            { k: 'bilan', label: 'Bilan', Icon: ChartColumn, value: mask(b.benefice) },
            { k: 'pro', label: 'Business Pro', Icon: Briefcase, value: proActive.length ? `${proActive.length} actif${proActive.length > 1 ? 's' : ''}` : 'Collaborations', badge: proOut ? mask(proOut) : undefined },
          ]} />
      </div>
      {tab === 'ventes' && <Ventes />}
      {tab === 'stock' && <Stock />}
      {tab === 'achats' && <Achats />}
      {tab === 'bilan' && <Bilan />}
      {tab === 'pro' && <Pro />}
    </div>
  )
}

/* ---------- Ventes ---------- */
function Ventes() {
  const { sales, saleState, contactById, saleItems, productById, month, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const [f, setF] = useState<'mois' | DebtStatus>('en_cours')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return sales.filter((x) => {
      const st = saleState.get(x.id)!
      if (f === 'mois' ? !x.sold_on.startsWith(month) : f === 'en_cours' ? st.remaining <= 0 : st.status !== f) return false
      if (!s) return true
      const text = `${contactById.get(x.contact_id ?? '')?.name ?? ''} ${saleItems.filter((i) => i.sale_id === x.id).map((i) => productById.get(i.product_id)?.name).join(' ')}`
      return text.toLowerCase().includes(s)
    }).sort((a, b) => (saleState.get(b.id)!.overdue - saleState.get(a.id)!.overdue) || (a.sold_on < b.sold_on ? 1 : -1))
  }, [sales, saleState, f, month, q, contactById, saleItems, productById])
  const counts = { en_cours: sales.filter((x) => saleState.get(x.id)!.remaining > 0).length, en_retard: sales.filter((x) => saleState.get(x.id)!.status === 'en_retard').length }

  return (
    <div className="space-y-3 px-5 pb-10 lg:px-8">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <button onClick={() => setF('en_cours')} className={chip(f === 'en_cours')}>À encaisser ({counts.en_cours})</button>
        <button onClick={() => setF('en_retard')} className={chip(f === 'en_retard')}>En retard ({counts.en_retard})</button>
        <button onClick={() => setF('mois')} className={chip(f === 'mois')}>Ventes du mois</button>
        <button onClick={() => setF('solde')} className={chip(f === 'solde')}>Soldées</button>
      </div>
      {f === 'mois' && <MonthBar />}
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
        <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Client ou produit" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une vente" />
      </div>
      {list.length === 0 && <Empty icon="🛍️" text={f === 'en_retard' ? 'Aucun client en retard. 👏' : 'Aucune vente ici.'} />}
      <div className="grid gap-2 xl:grid-cols-2 3xl:grid-cols-3">
      {list.map((s) => {
        const st = saleState.get(s.id)!
        const what = saleItems.filter((i) => i.sale_id === s.id).map((i) => productById.get(i.product_id)?.name).filter(Boolean).join(', ')
        return (
          <button key={s.id} onClick={() => forms.open({ f: 'saleDetail', id: s.id })} className="flex w-full items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile p-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{(contactById.get(s.contact_id ?? '')?.name ?? 'C').charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{contactById.get(s.contact_id ?? '')?.name ?? 'Vente comptant'}</span>
              <span className="block truncate text-xs text-ink-muted">{what} · {fmtDateLong(s.sold_on)}</span>
              {st.remaining > 0 && st.nextDue && st.overdue <= 0 && <span className="block text-xs text-ink-muted">Prochaine échéance : {fmtDateLong(st.nextDue)}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular text-sm font-semibold">{hidden ? '••••' : fmt(st.remaining > 0 ? st.remaining : s.total_amount, cur)}</span>
              <StatusBadge s={st.status} />
            </span>
          </button>
        )
      })}
      </div>
    </div>
  )
}

/* ---------- Stock ---------- */
function Stock() {
  const { products, stockOf, cur } = useData()
  const forms = useForms()
  const [q, setQ] = useState('')
  const [showOff, setShowOff] = useState(false)
  const list = products.filter((p) => (showOff || p.is_active) && (!q.trim() || `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const byCat = new Map<string, typeof list>()
  for (const p of list) { const k = p.category ?? 'Autres'; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(p) }
  const value = products.filter((p) => p.is_active).reduce((a, p) => a + Math.max(0, stockOf.get(p.id) ?? 0) * p.cost_price, 0)
  const empty = products.filter((p) => p.is_active && (stockOf.get(p.id) ?? 0) <= 0).length

  return (
    <div className="space-y-3 px-5 pb-10 lg:px-8">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Valeur du stock (prix d'achat)</p><p className="tabular font-semibold">{fmt(value, cur)}</p></div>
        <div className={`rounded-2xl p-3 ${empty ? 'bg-red-50' : 'bg-cream-tile'}`}><p className={`text-xs ${empty ? 'text-red-700' : 'text-ink-muted'}`}>Produits épuisés</p><p className="tabular font-semibold">{empty}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => forms.open({ f: 'product' })} className="btn-primary"><Plus size={20} /> Produit</button>
        <button onClick={() => forms.open({ f: 'purchase' })} className="btn-ghost"><PackagePlus size={20} /> Réappro</button>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
        <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Chercher un produit" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un produit" />
      </div>
      {products.length === 0 && <Empty icon="📦" text="Ajoute tes produits (téléphones, JBL, parfums, riz…) avec leur prix d'achat et de vente." />}
      {[...byCat.entries()].map(([cat, ps]) => (
        <section key={cat}>
          <h3 className="mb-1 mt-2 text-sm font-semibold text-ink-muted">{cat}</h3>
          {ps.map((p) => {
            const st = stockOf.get(p.id) ?? 0
            return (
              <button key={p.id} onClick={() => forms.open({ f: 'product', item: p })} className={`flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0 ${p.is_active ? '' : 'opacity-50'}`}>
                <IconTile name={p.category ?? p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-ink-muted">Achat {fmt(p.cost_price, cur)} · vente {fmt(p.sale_price, cur)}</span>
                </span>
                <span className={`tabular shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st <= 0 ? 'bg-red-100 text-red-700' : st <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                  {String(st).replace('.', ',')} {p.unit === 'pièce' ? 'pc' : p.unit}
                </span>
              </button>
            )
          })}
        </section>
      ))}
      {products.some((p) => !p.is_active) && <button onClick={() => setShowOff(!showOff)} className="w-full py-1 text-sm text-ink-muted">{showOff ? 'Masquer' : 'Afficher'} les produits plus vendus</button>}
    </div>
  )
}

/* ---------- Achats et frais ---------- */
function Achats() {
  const { purchases, bizExpenses, purchaseItems, productById, methodById, month, cur } = useData()
  const forms = useForms()
  const p = purchases.filter((x) => x.purchased_on.startsWith(month))
  const e = bizExpenses.filter((x) => x.spent_on.startsWith(month))
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <MonthBar />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => forms.open({ f: 'purchase' })} className="btn-primary"><PackagePlus size={20} /> Achat</button>
        <button onClick={() => forms.open({ f: 'bizExpense' })} className="btn-ghost"><Truck size={20} /> Frais</button>
      </div>
      <section>
        <h3 className="mb-1 flex justify-between font-semibold"><span>Achats de stock</span><span className="tabular">{fmt(p.reduce((a, x) => a + x.total_amount, 0), cur)}</span></h3>
        {p.length === 0 && <p className="py-2 text-sm text-ink-muted">Aucun achat ce mois-ci.</p>}
        {p.map((x) => (
          <button key={x.id} onClick={() => forms.open({ f: 'purchase', item: x })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{purchaseItems.filter((i) => i.purchase_id === x.id).map((i) => `${String(i.quantity).replace('.', ',')} ${productById.get(i.product_id)?.name ?? ''}`).join(', ')}</span>
              <span className="block truncate text-xs text-ink-muted">{[fmtDateLong(x.purchased_on), x.supplier, methodLabel(methodById.get(x.payment_method_id ?? ''))].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="tabular shrink-0 font-semibold">−{fmt(x.total_amount, cur)}</span>
          </button>
        ))}
      </section>
      <section>
        <h3 className="mb-1 flex justify-between font-semibold"><span>Frais</span><span className="tabular">{fmt(e.reduce((a, x) => a + x.amount, 0), cur)}</span></h3>
        {e.length === 0 && <p className="py-2 text-sm text-ink-muted">Aucun frais ce mois-ci.</p>}
        {e.map((x) => (
          <button key={x.id} onClick={() => forms.open({ f: 'bizExpense', item: x })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.category}</span><span className="block truncate text-xs text-ink-muted">{[fmtDateLong(x.spent_on), methodLabel(methodById.get(x.payment_method_id ?? '')), x.note].filter(Boolean).join(' · ')}</span></span>
            <span className="tabular shrink-0 font-semibold">−{fmt(x.amount, cur)}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

/* ---------- Bilan du mois ---------- */
function Bilan() {
  const d = useData()
  const { month, methods, balanceOf, products, stockOf, sales, saleState, cur } = d
  const b = businessMonth(d, month)
  const caisse = methods.filter((m) => m.type === 'caisse_business' && m.is_active)
  const stockValue = products.filter((p) => p.is_active).reduce((a, p) => a + Math.max(0, stockOf.get(p.id) ?? 0) * p.cost_price, 0)
  const clients = sales.reduce((a, s) => a + Math.max(0, saleState.get(s.id)!.remaining), 0)
  const Line = ({ l, v, strong, tone }: { l: string; v: number; strong?: boolean; tone?: 'red' | 'green' }) => (
    <div className={`flex justify-between py-2.5 ${strong ? 'text-lg font-semibold' : ''}`}>
      <span>{l}</span><span className={`tabular ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-700' : ''}`}>{fmt(v, cur)}</span>
    </div>
  )
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <MonthBar />
      <div className="rounded-3xl border border-cream-line bg-cream-tile px-4 py-2 divide-y divide-cream-line">
        <Line l={`Chiffre d'affaires (${b.nbVentes} vente${b.nbVentes > 1 ? 's' : ''})`} v={b.ca} />
        <Line l="− Coût des produits vendus" v={b.cogs} />
        <Line l="− Frais du business" v={b.frais} />
        <Line l="= Bénéfice du mois" v={b.benefice} strong tone={b.benefice < 0 ? 'red' : 'green'} />
      </div>
      <p className="text-xs text-ink-muted">Le bénéfice compte les ventes du mois, même si le client n'a pas encore tout payé. L'argent réellement reçu est dans « Encaissé ».</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Encaissé ce mois</p><p className="tabular font-semibold">{fmt(b.encaisse, cur)}</p></div>
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Achats de stock</p><p className="tabular font-semibold">{fmt(b.achats, cur)}</p></div>
        {caisse.map((m) => <div key={m.id} className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">{m.name} (aujourd'hui)</p><p className="tabular font-semibold">{fmt(balanceOf.get(m.id) ?? 0, cur)}</p></div>)}
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Valeur du stock</p><p className="tabular font-semibold">{fmt(stockValue, cur)}</p></div>
        <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-sun-100 p-3">
          <AlertTriangle size={20} className="shrink-0" />
          <div className="flex-1"><p className="text-xs">Les clients me doivent encore (toutes ventes)</p><p className="tabular font-semibold">{fmt(clients, cur)}</p></div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Business Pro : investissements et collaborations ---------- */
function Pro() {
  const { investments, investState, contactById, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const mask = (n: number) => (hidden ? '••••' : fmt(n, cur))
  const totals = investments.reduce((a, i) => { const s = investState.get(i.id)!; return { inv: a.inv + s.invested, ret: a.ret + s.returned } }, { inv: 0, ret: 0 })
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Investi</p><p className="tabular text-sm font-semibold">{mask(totals.inv)}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Récupéré</p><p className="tabular text-sm font-semibold">{mask(totals.ret)}</p></div>
        <div className={`rounded-2xl p-3 ${totals.ret - totals.inv >= 0 ? 'bg-emerald-100' : 'bg-sun-100'}`}><p className="text-xs">{totals.ret - totals.inv >= 0 ? 'Gain' : 'Encore dehors'}</p><p className="tabular text-sm font-semibold">{mask(Math.abs(totals.ret - totals.inv))}</p></div>
      </div>
      <button onClick={() => forms.open({ f: 'investment' })} className="btn-primary w-full"><Plus size={20} /> Nouvelle collaboration</button>
      {investments.length === 0 && <Empty icon="🤝" text="Note ici l'argent que tu mets dans le business d'un partenaire (salon de coiffure, boutique…) et ce que tu récupères." />}
      <div className="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
        {investments.map((i) => {
          const st = investState.get(i.id)!
          const target = i.agreement_type === 'pret_remboursable' ? i.expected_return ?? st.invested : st.invested
          const pct = target ? (st.returned / target) * 100 : 0
          const [label, cls] = INV_STATUS[i.status]
          return (
            <button key={i.id} onClick={() => forms.open({ f: 'investDetail', id: i.id })} className="rounded-2xl border border-cream-line bg-cream-tile p-4 text-left transition hover:border-sun-300">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{i.project_name}</span>
                  <span className="block truncate text-xs text-ink-muted">{[contactById.get(i.contact_id)?.name, i.activity, AGREEMENT[i.agreement_type] + (i.share_pct != null ? ` ${i.share_pct} %` : '')].filter(Boolean).join(' · ')}</span></span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm"><span>Investi <b className="tabular">{mask(st.invested)}</b></span><span className="text-emerald-700">Récupéré <b className="tabular">{mask(st.returned)}</b></span></div>
              <div className="mt-2"><Bar pct={pct} color="bg-emerald-500" /></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
