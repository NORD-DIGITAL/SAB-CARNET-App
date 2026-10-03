import { useMemo, useState } from 'react'
import { AlertTriangle, PackagePlus, Plus, Search, ShoppingBag, Truck } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { businessMonth } from '../lib/derive'
import { useHidden } from '../lib/prefs'
import type { DebtStatus } from '../lib/types'
import { Empty, Header, IconTile } from '../components/ui'
import { MonthBar, fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { StatusBadge } from '../components/SaleDetail'
import { chip, methodLabel } from '../components/forms'

type Tab = 'ventes' | 'stock' | 'achats' | 'bilan'
const TABS: [Tab, string][] = [['ventes', 'Ventes'], ['stock', 'Stock'], ['achats', 'Achats & frais'], ['bilan', 'Bilan']]

export default function BusinessScreen() {
  const [tab, setTab] = useState<Tab>('ventes')
  return (
    <div className="lg:mx-auto lg:max-w-4xl">
      <Header title="Business perso" />
      <div className="flex gap-2 overflow-x-auto px-5 pb-3 pt-1">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={chip(tab === k)}>{l}</button>)}
      </div>
      {tab === 'ventes' && <Ventes />}
      {tab === 'stock' && <Stock />}
      {tab === 'achats' && <Achats />}
      {tab === 'bilan' && <Bilan />}
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
    <div className="space-y-3 px-5 pb-10">
      <button onClick={() => forms.open({ f: 'sale' })} className="btn-primary w-full"><ShoppingBag size={20} /> Nouvelle vente</button>
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
    <div className="space-y-3 px-5 pb-10">
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
    <div className="space-y-4 px-5 pb-10">
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
    <div className="space-y-4 px-5 pb-10">
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
