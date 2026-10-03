import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Boxes, Briefcase, ChartColumn, ChevronRight, Handshake, History, PackagePlus, Plus, Search, ShoppingBag, Store, Truck } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt, monthShort, todayISO } from '../lib/format'
import { bilanInsights, costInsights, monthSeries, proInsights, salesInsights, stockInsights } from '../lib/insights'
import { buildActivity } from '../lib/activity'
import { businessMonth } from '../lib/derive'
import { useHidden } from '../lib/prefs'
import type { DebtStatus } from '../lib/types'
import { Empty, Header, IconTile, Segmented } from '../components/ui'
import { MonthBar, fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import type { FormReq } from '../components/FormHost'
import { Insights } from '../components/Insights'
import { ActivityList } from '../components/ActivityList'
import { StatusBadge } from '../components/SaleDetail'
import { chip, methodLabel } from '../components/forms'
import { SectionTiles, Bar } from '../components/Tiles'
import { AGREEMENT, INV_STATUS } from '../components/ProForms'

type TabP = 'ventes' | 'stock' | 'achats' | 'bilan'
type TabPro = 'collab' | 'mouvements' | 'bilanpro'

export default function BusinessScreen() {
  const [mode, setMode] = useState<'perso' | 'pro' | null>(null)
  const [tabP, setTabP] = useState<TabP>('ventes')
  const [tabPro, setTabPro] = useState<TabPro>('collab')
  if (!mode) return <Choice onPick={setMode} />
  const other = mode === 'perso' ? 'pro' : 'perso'
  return (
    <div className="lg:mx-auto lg:max-w-5xl 3xl:max-w-7xl">
      <Header title={mode === 'perso' ? 'Business Perso' : 'Business Pro'} onBack={() => setMode(null)}
        right={<button onClick={() => setMode(other)} className="whitespace-nowrap rounded-full border border-cream-line bg-cream-tile px-3 py-1.5 text-xs font-medium">{other === 'pro' ? 'Pro →' : 'Perso →'}</button>} />
      {mode === 'perso' ? <PersoBiz tab={tabP} setTab={setTabP} /> : <ProBiz tab={tabPro} setTab={setTabPro} />}
    </div>
  )
}

/* ---------- Écran de choix : deux grandes cases ---------- */
function Choice({ onPick }: { onPick: (m: 'perso' | 'pro') => void }) {
  const { methods, balanceOf, sales, saleState, investments, investState, products, cur } = useData()
  const [hidden] = useHidden()
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))
  const caisse = methods.find((m) => m.is_active && m.type === 'caisse_business')
  const open = sales.filter((s) => saleState.get(s.id)!.remaining > 0)
  const late = open.filter((s) => saleState.get(s.id)!.status === 'en_retard').length
  const inv = investments.reduce((a, i) => a + investState.get(i.id)!.invested, 0)
  const ret = investments.reduce((a, i) => a + investState.get(i.id)!.returned, 0)
  const actifs = investments.filter((i) => i.status === 'actif').length
  return (
    <div className="lg:mx-auto lg:max-w-5xl 3xl:max-w-7xl">
      <Header title="Business" />
      <div className="grid gap-4 px-5 pb-10 sm:grid-cols-2 lg:px-8">
        <button onClick={() => onPick('perso')} className="group relative flex min-h-[15rem] flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0F1B3D] via-[#14264F] to-[#0B3B5C] p-6 text-left text-white shadow-lg transition active:scale-[.99] lg:min-h-[19rem] lg:p-8 3xl:min-h-[28rem] 3xl:p-10">
          <Store size={120} strokeWidth={1} className="pointer-events-none absolute -bottom-4 -right-4 text-white/10" />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)' }}><ShoppingBag size={26} className="text-ink" /></span>
          <span className="mt-4 text-2xl font-bold lg:text-3xl 3xl:text-4xl">Business Perso</span>
          <span className="mt-1 text-sm text-white/70">Mes ventes : téléphones, JBL, parfums, riz… Stock, ventes à crédit, bilan.</span>
          <span className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <span className="rounded-2xl bg-white/10 p-3"><span className="block text-[0.6875rem] text-white/60">Caisse business</span><span className="tabular block font-bold">{mask(caisse ? balanceOf.get(caisse.id) ?? 0 : 0)}</span></span>
            <span className="rounded-2xl bg-white/10 p-3"><span className="block text-[0.6875rem] text-white/60">À encaisser{late ? ` · ${late} retard` : ''}</span><span className="tabular block font-bold">{mask(open.reduce((a, s) => a + saleState.get(s.id)!.remaining, 0))}</span></span>
          </span>
          <span className="mt-3 flex items-center justify-between text-sm font-semibold"><span className="text-white/70">{products.filter((p) => p.is_active).length} produits · {open.length} ventes en cours</span><ChevronRight className="transition group-hover:translate-x-1" /></span>
        </button>
        <button onClick={() => onPick('pro')} className="group relative flex min-h-[15rem] flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3B0F4A] via-[#5B1A6E] to-[#9D2A6B] p-6 text-left text-white shadow-lg transition active:scale-[.99] lg:min-h-[19rem] lg:p-8 3xl:min-h-[28rem] 3xl:p-10">
          <Handshake size={120} strokeWidth={1} className="pointer-events-none absolute -bottom-4 -right-4 text-white/10" />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white"><Briefcase size={26} className="text-[#5B1A6E]" /></span>
          <span className="mt-4 text-2xl font-bold lg:text-3xl 3xl:text-4xl">Business Pro</span>
          <span className="mt-1 text-sm text-white/70">Mes collaborations et investissements chez des partenaires : salon de coiffure, boutique…</span>
          <span className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <span className="rounded-2xl bg-white/10 p-3"><span className="block text-[0.6875rem] text-white/60">Investi</span><span className="tabular block font-bold">{mask(inv)}</span></span>
            <span className="rounded-2xl bg-white/10 p-3"><span className="block text-[0.6875rem] text-white/60">Récupéré</span><span className="tabular block font-bold">{mask(ret)}</span></span>
          </span>
          <span className="mt-3 flex items-center justify-between text-sm font-semibold"><span className="text-white/70">{actifs} collaboration{actifs > 1 ? 's' : ''} active{actifs > 1 ? 's' : ''}</span><ChevronRight className="transition group-hover:translate-x-1" /></span>
        </button>
      </div>
    </div>
  )
}

/* ---------- Business Perso ---------- */
function PersoBiz({ tab, setTab }: { tab: TabP; setTab: (t: TabP) => void }) {
  const d = useData()
  const { methods, balanceOf, month, sales, saleState, salePayments, products, stockOf, cur } = d
  const forms = useForms()
  const [hidden] = useHidden()
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

  return (
    <>
      <div className="space-y-4 px-5 pb-4 lg:px-8">
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
                  <p className="tabular truncate text-[0.8125rem] font-bold sm:text-base lg:text-lg">{x.v}</p>
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

        <SectionTiles value={tab} onChange={setTab} cols="grid-cols-4"
          items={[
            { k: 'ventes', label: 'Ventes', Icon: ShoppingBag, value: `${open.length} en cours`, badge: late.length ? `${late.length} retard` : undefined, alert: late.length > 0 },
            { k: 'stock', label: 'Stock', Icon: Boxes, value: `${products.filter((p) => p.is_active).length} produits`, badge: empty ? `${empty} vide${empty > 1 ? 's' : ''}` : undefined, alert: empty > 0 },
            { k: 'achats', label: 'Achats', Icon: Truck, value: mask(b.achats + b.frais) },
            { k: 'bilan', label: 'Bilan', Icon: ChartColumn, value: mask(b.benefice) },
          ]} />
      </div>
      {tab === 'ventes' && <Ventes />}
      {tab === 'stock' && <Stock />}
      {tab === 'achats' && <Achats />}
      {tab === 'bilan' && <Bilan />}
    </>
  )
}

/* ---------- Business Pro ---------- */
function ProBiz({ tab, setTab }: { tab: TabPro; setTab: (t: TabPro) => void }) {
  const d = useData()
  const { investments, investState, flows, cur } = d
  const forms = useForms()
  const [hidden] = useHidden()
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))
  const inv = investments.reduce((a, i) => a + investState.get(i.id)!.invested, 0)
  const ret = investments.reduce((a, i) => a + investState.get(i.id)!.returned, 0)
  const actifs = investments.filter((i) => i.status === 'actif')
  const month = todayISO().slice(0, 7)
  const gotMonth = flows.filter((f) => f.kind === 'retour' && f.flow_on.startsWith(month)).reduce((a, f) => a + f.amount, 0)
  return (
    <>
      <div className="space-y-4 px-5 pb-4 lg:px-8">
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3B0F4A] via-[#5B1A6E] to-[#9D2A6B] p-5 text-white shadow-lg lg:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/60">{ret >= inv ? 'Gain net' : 'Encore dehors'}</p>
              <p className="tabular whitespace-nowrap text-[2.25rem] font-bold leading-tight sm:text-[2.5rem] lg:text-5xl">{mask(Math.abs(ret - inv))}</p>
              <p className="text-sm text-white/60">{actifs.length} collaboration{actifs.length > 1 ? 's' : ''} active{actifs.length > 1 ? 's' : ''} · {mask(gotMonth)} reçus ce mois</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 lg:gap-3">
            {[['Investi', inv], ['Récupéré', ret], ['Rendement', null]].map(([l, v]) => (
              <div key={l as string} className="rounded-2xl bg-white/10 p-3">
                <p className="truncate text-[0.6875rem] text-white/70">{l}</p>
                <p className="tabular truncate text-[0.8125rem] font-bold sm:text-base lg:text-lg">{v === null ? (inv ? `${Math.round((ret / inv) * 100)} %` : '—') : mask(v as number)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button onClick={() => forms.open({ f: 'investment' })} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-lg font-semibold text-[#5B1A6E] active:scale-[.98]"><Plus size={22} /> Nouvelle collaboration</button>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button onClick={() => forms.open({ f: 'pickInvest', kind: 'retour' })} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm hover:bg-white/20"><ArrowDownLeft size={20} /> Retour reçu</button>
              <button onClick={() => forms.open({ f: 'pickInvest', kind: 'apport' })} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm hover:bg-white/20"><ArrowUpRight size={20} /> Apport</button>
            </div>
          </div>
        </section>
        <SectionTiles value={tab} onChange={setTab} cols="grid-cols-3"
          items={[
            { k: 'collab', label: 'Partenaires', Icon: Handshake, value: `${investments.length} au total` },
            { k: 'mouvements', label: 'Historique', Icon: History, value: `${flows.length} mouvement${flows.length > 1 ? 's' : ''}` },
            { k: 'bilanpro', label: 'Bilan Pro', Icon: ChartColumn, value: inv ? `${Math.round((ret / inv) * 100)} % récupéré` : '—' },
          ]} />
      </div>
      {tab === 'collab' && <Pro />}
      {tab === 'mouvements' && <ProHistory />}
      {tab === 'bilanpro' && <ProBilan />}
    </>
  )
}

/* ---------- Ventes ---------- */
function Ventes() {
  const { sales, saleState, contactById, saleItems, productById, month, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const d = useData()
  const [f, setF] = useState<'mois' | 'histo' | DebtStatus>('en_cours')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return sales.filter((x) => {
      const st = saleState.get(x.id)!
      if (f === 'histo') return false
      if (f === 'mois' ? !x.sold_on.startsWith(month) : f === 'en_cours' ? st.remaining <= 0 : st.status !== f) return false
      if (!s) return true
      const text = `${contactById.get(x.contact_id ?? '')?.name ?? ''} ${saleItems.filter((i) => i.sale_id === x.id).map((i) => productById.get(i.product_id)?.name).join(' ')}`
      return text.toLowerCase().includes(s)
    }).sort((a, b) => (saleState.get(b.id)!.overdue - saleState.get(a.id)!.overdue) || (a.sold_on < b.sold_on ? 1 : -1))
  }, [sales, saleState, f, month, q, contactById, saleItems, productById])
  const counts = { en_cours: sales.filter((x) => saleState.get(x.id)!.remaining > 0).length, en_retard: sales.filter((x) => saleState.get(x.id)!.status === 'en_retard').length }

  return (
    <div className="space-y-3 px-5 pb-10 lg:px-8">
      <Insights items={salesInsights(d)} />
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        <button onClick={() => setF('en_cours')} className={chip(f === 'en_cours')}>À encaisser ({counts.en_cours})</button>
        <button onClick={() => setF('en_retard')} className={chip(f === 'en_retard')}>En retard ({counts.en_retard})</button>
        <button onClick={() => setF('mois')} className={chip(f === 'mois')}>Ventes du mois</button>
        <button onClick={() => setF('solde')} className={chip(f === 'solde')}>Soldées</button>
        <button onClick={() => setF('histo')} className={`${chip(f === 'histo')} flex items-center gap-1`}><History size={14} /> Historique</button>
      </div>
      {f === 'mois' && <MonthBar />}
      {f === 'histo' && <SalesHistory q={q} />}
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
        <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Client ou produit" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une vente" />
      </div>
      {list.length === 0 && f !== 'histo' && <Empty icon="🛍️" text={f === 'en_retard' ? 'Aucun client en retard. 👏' : 'Aucune vente ici.'} />}
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
  const d = useData()
  const { products, stockOf, cur } = d
  const forms = useForms()
  const [view, setView] = useState<'produits' | 'mouvements'>('produits')
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
      <Insights items={stockInsights(d)} />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => forms.open({ f: 'product' })} className="btn-primary"><Plus size={20} /> Produit</button>
        <button onClick={() => forms.open({ f: 'purchase' })} className="btn-ghost"><PackagePlus size={20} /> Réappro</button>
      </div>
      <Segmented value={view} onChange={setView} options={[['produits', 'Produits'], ['mouvements', 'Entrées / sorties']]} />
      {view === 'mouvements' ? <StockMoves q={q} /> : <>
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
      </>}
    </div>
  )
}

/* ---------- Achats et frais ---------- */
function Achats() {
  const d = useData()
  const { purchases, bizExpenses, purchaseItems, productById, methodById, month, cur } = d
  const forms = useForms()
  const p = purchases.filter((x) => x.purchased_on.startsWith(month))
  const e = bizExpenses.filter((x) => x.spent_on.startsWith(month))
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <MonthBar />
      <Insights items={costInsights(d, month)} />
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
      <Insights items={bilanInsights(d, month)} />
      <SixMonths />
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
  const d = useData()
  const { investments, investState, contactById, cur } = d
  const forms = useForms()
  const [hidden] = useHidden()
  const mask = (n: number) => (hidden ? '••••' : fmt(n, cur))
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <Insights items={proInsights(d)} />
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

/* ---------- Historique des ventes et encaissements ---------- */
function SalesHistory({ q }: { q: string }) {
  const d = useData()
  const items = useMemo(() => buildActivity(d).filter((a) => (a.key.startsWith('s') || a.key.startsWith('p')) && a.scope === 'business'
    && (!q.trim() || `${a.title} ${a.sub}`.toLowerCase().includes(q.trim().toLowerCase()))), [d, q])
  const inn = items.filter((a) => a.tone === 'in').reduce((x, a) => x + a.amount, 0)
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-cream-tile px-4 py-3 text-sm">{items.length} opérations · <b className="tabular text-emerald-700">{fmt(inn, 'Ar')}</b> encaissés au total</p>
      {items.length === 0 ? <Empty icon="🗂️" text="Aucune vente pour l'instant." /> : <ActivityList items={items.slice(0, 300)} />}
    </div>
  )
}

/* ---------- Entrées et sorties de stock ---------- */
function StockMoves({ q }: { q: string }) {
  const { purchases, purchaseItems, sales, saleItems, productById, contactById } = useData()
  const forms = useForms()
  const rows = useMemo(() => {
    const out: { key: string; date: string; product: string; qty: number; unit: string; who: string; open: FormReq }[] = []
    for (const i of purchaseItems) {
      const p = purchases.find((x) => x.id === i.purchase_id); const pr = productById.get(i.product_id)
      if (p) out.push({ key: `in${i.id}`, date: p.purchased_on, product: pr?.name ?? '?', qty: i.quantity, unit: pr?.unit ?? '', who: p.supplier ?? 'Réapprovisionnement', open: { f: 'purchase', item: p } })
    }
    for (const i of saleItems) {
      const s = sales.find((x) => x.id === i.sale_id); const pr = productById.get(i.product_id)
      if (s) out.push({ key: `out${i.id}`, date: s.sold_on, product: pr?.name ?? '?', qty: -i.quantity, unit: pr?.unit ?? '', who: s.contact_id ? contactById.get(s.contact_id)?.name ?? 'Client' : 'Vente comptant', open: { f: 'saleDetail', id: s.id } })
    }
    const s = q.trim().toLowerCase()
    return out.filter((r) => !s || `${r.product} ${r.who}`.toLowerCase().includes(s)).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [purchases, purchaseItems, sales, saleItems, productById, contactById, q])
  if (!rows.length) return <Empty icon="📦" text="Aucun mouvement de stock." />
  return (
    <div className="grid gap-x-6 lg:grid-cols-2">
      {rows.slice(0, 300).map((r) => (
        <button key={r.key} onClick={() => forms.open(r.open)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{r.qty > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.product}</span><span className="block truncate text-xs text-ink-muted">{fmtDateLong(r.date)} · {r.who}</span></span>
          <span className={`tabular shrink-0 font-semibold ${r.qty > 0 ? 'text-emerald-700' : ''}`}>{r.qty > 0 ? '+' : '−'}{String(Math.abs(r.qty)).replace('.', ',')} {r.unit === 'pièce' ? 'pc' : r.unit}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------- 6 derniers mois en barres ---------- */
function SixMonths() {
  const d = useData()
  const series = monthSeries(d, d.month)
  const max = Math.max(1, ...series.map((s) => Math.max(s.ca, s.benefice)))
  return (
    <section className="rounded-3xl border border-cream-line p-4">
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-muted"><span className="flex-1 text-sm font-semibold text-ink">6 derniers mois</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#14264F]" />Ventes</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Bénéfice</span></div>
      <div className="flex h-36 items-end gap-2">
        {series.map((s) => (
          <button key={s.m} onClick={() => d.setMonth(s.m)} title={`${monthShort(s.m)} : ventes ${fmt(s.ca, 'Ar')}, bénéfice ${fmt(s.benefice, 'Ar')}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="flex h-full w-full items-end justify-center gap-1">
              <span className="w-1/3 rounded-t bg-[#14264F]" style={{ height: `${(s.ca / max) * 100}%` }} />
              <span className="w-1/3 rounded-t bg-emerald-500" style={{ height: `${(Math.max(0, s.benefice) / max) * 100}%` }} />
            </span>
            <span className={`text-[0.6875rem] ${s.m === d.month ? 'font-bold text-ink' : 'text-ink-muted'}`}>{monthShort(s.m)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/* ---------- Business Pro : historique et bilan ---------- */
function ProHistory() {
  const d = useData()
  const items = useMemo(() => buildActivity(d).filter((a) => a.key.startsWith('f')), [d])
  return <div className="px-5 pb-10 lg:px-8">{items.length === 0 ? <Empty icon="🗂️" text="Aucun apport ni retour pour l'instant." /> : <ActivityList items={items} />}</div>
}
function ProBilan() {
  const d = useData()
  const forms = useForms()
  const { investments, investState, contactById, cur } = d
  const rows = investments.map((i) => ({ i, s: investState.get(i.id)! })).sort((a, b) => b.s.returned - a.s.returned)
  const max = Math.max(1, ...rows.map((r) => Math.max(r.s.invested, r.s.returned)))
  return (
    <div className="space-y-4 px-5 pb-10 lg:px-8">
      <Insights items={proInsights(d)} />
      <section className="rounded-3xl border border-cream-line p-4">
        <h3 className="mb-3 font-semibold">Investi / récupéré par collaboration</h3>
        {rows.length === 0 && <p className="text-sm text-ink-muted">Aucune collaboration.</p>}
        <div className="space-y-4">
          {rows.map(({ i, s }) => (
            <button key={i.id} onClick={() => forms.open({ f: 'investDetail', id: i.id })} className="block w-full text-left">
              <span className="flex items-baseline gap-2 text-sm"><span className="flex-1 truncate font-medium">{i.project_name}</span><span className="text-xs text-ink-muted">{contactById.get(i.contact_id)?.name}</span></span>
              <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-[#5B1A6E]" style={{ width: `${(s.invested / max) * 100}%` }} /></span>
              <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(s.returned / max) * 100}%` }} /></span>
              <span className="tabular mt-1 flex justify-between text-xs text-ink-muted"><span>Investi {fmt(s.invested, cur)}</span><span className={s.result >= 0 ? 'text-emerald-700' : ''}>{s.result >= 0 ? `Gain ${fmt(s.result, cur)}` : `Dehors ${fmt(-s.result, cur)}`}</span></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
