import { useMemo, useState } from 'react'
import { Banknote, CalendarClock, ChevronRight, Dumbbell, Eye, EyeOff, HandHeart, History, Landmark, Mail, Receipt, RefreshCw, ShoppingBag, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useData } from '../lib/data'
import { addMonths, fmt, monthLabel } from '../lib/format'
import { useHidden, userInfo } from '../lib/prefs'
import { fixedExpenses, personalExpenses } from '../lib/derive'
import { buildActivity } from '../lib/activity'
import { useBadge } from '../lib/inbox'
import { ByNord, Empty } from '../components/ui'
import { MonthBar, fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { ActivityList } from '../components/ActivityList'
import type { SubPage } from './Compte'
import type { PersoSection } from './Perso'

export type GoTab = (t: 'dettes' | 'business' | 'historique' | 'perso', section?: PersoSection) => void

export default function HomeScreen({ openSub, goTab, onRefresh }: { openSub: (p: SubPage) => void; goTab: GoTab; onRefresh: () => Promise<void> }) {
  const d = useData()
  const { session, profile, methods, balanceOf, month, receivableTotal, receivableLate, payableTotal, cur } = d
  const forms = useForms()
  const [hidden, toggleHidden] = useHidden()
  const [refreshing, setRefreshing] = useState(false)
  const me = userInfo(session, profile)
  const inboxN = useBadge()
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))

  const spent = personalExpenses(d, month).reduce((a, e) => a + e.amount, 0)
  const spentPrev = personalExpenses(d, addMonths(month, -1)).reduce((a, e) => a + e.amount, 0)
  const delta = spentPrev ? Math.round(((spent - spentPrev) / spentPrev) * 100) : null
  const fixed = fixedExpenses(d, month).reduce((a, e) => a + e.amount, 0)
  const activity = useMemo(() => buildActivity(d).filter((a) => a.date.startsWith(month)), [d, month])
  const first = (t: string) => methods.find((m) => m.is_active && m.type === t)

  // Les 4 cases : Dépense perso, Caisse business, Ma Banque, Dépense fixe
  const boxes: { key: string; label: string; color: string; value: number; sub?: string; run: () => void }[] = []
  const perso = first('especes'), biz = first('caisse_business'), bank = first('banque')
  if (perso) boxes.push({ key: 'perso', label: perso.name, color: perso.color ?? '#10B981', value: balanceOf.get(perso.id) ?? 0, run: () => goTab('perso') })
  if (biz) boxes.push({ key: 'biz', label: biz.name, color: biz.color ?? '#F97316', value: balanceOf.get(biz.id) ?? 0, run: () => goTab('business') })
  if (bank) boxes.push({ key: 'bank', label: bank.name, color: bank.color ?? '#0EA5E9', value: balanceOf.get(bank.id) ?? 0, run: () => openSub('moyens') })
  boxes.push({ key: 'fixe', label: 'Dépense fixe', color: '#A855F7', value: fixed, run: () => goTab('perso', 'fixes') })

  const shortcuts: { label: string; Icon: LucideIcon; run: () => void }[] = [
    { label: 'Dépense', Icon: Receipt, run: () => forms.open({ f: 'expense' }) },
    { label: 'Retrait DAB', Icon: Landmark, run: () => forms.open({ f: 'withdrawal' }) },
    { label: 'Vente', Icon: ShoppingBag, run: () => forms.open({ f: 'sale' }) },
    { label: 'Versement client', Icon: Banknote, run: () => forms.open({ f: 'pickSale' }) },
    { label: 'Je prête', Icon: HandHeart, run: () => forms.open({ f: 'debt', kind: 'on_me_doit' }) },
    { label: 'Sport', Icon: Dumbbell, run: () => goTab('perso', 'sport') },
    { label: 'Beauté', Icon: Sparkles, run: () => goTab('perso', 'beaute') },
    { label: 'Historique', Icon: History, run: () => goTab('historique') },
  ]

  return (
    <div className="bg-white lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-2 lg:p-4 xl:grid-cols-[460px_1fr] 2xl:grid-cols-[460px_1fr_380px] 2xl:gap-4 3xl:grid-cols-[520px_1fr_440px] 3xl:gap-6 3xl:p-6">
      <div className="hero pb-8 lg:sticky lg:top-4 lg:overflow-hidden lg:rounded-[28px] lg:pb-2">
        <header className="pt-safe px-5">
          <div className="flex items-center gap-3 py-4">
            <button onClick={() => openSub('profil')} aria-label="Mon profil" className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-base font-semibold text-white">{me.initials}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="hero-muted block text-sm">Bonjour</span>
                <span className="block truncate text-[1.0625rem] font-medium">{me.name}</span>
              </span>
            </button>
            <button aria-label={`Boîte de réception${inboxN ? ` : ${inboxN} non lu${inboxN > 1 ? 's' : ''}` : ''}`} onClick={() => openSub('inbox')} className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/25">
              <Mail size={22} strokeWidth={1.8} />
              {inboxN > 0 && <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6875rem] font-bold text-white">{inboxN > 99 ? '99+' : inboxN}</span>}
            </button>
            <button aria-label="Actualiser" onClick={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false) }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/25">
              <RefreshCw size={22} strokeWidth={1.8} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={toggleHidden} aria-label={hidden ? 'Afficher les montants' : 'Masquer les montants'} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/25">
              {hidden ? <Eye size={22} strokeWidth={1.8} /> : <EyeOff size={22} strokeWidth={1.8} />}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 px-5">
          {boxes.map((b) => (
            <button key={b.key} onClick={b.run} className="hero-card rounded-2xl bg-white/60 px-4 py-3 text-left transition active:scale-[.98]">
              <p className="hero-muted flex items-center gap-1.5 truncate text-xs"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />{b.label}{b.sub && <span className="opacity-80"> · {b.sub}</span>}</p>
              <p className={`tabular mt-1 truncate text-xl font-semibold ${!hidden && b.value < 0 && b.key !== 'fixe' ? 'low-balance' : ''}`}>{mask(b.value)}</p>
            </button>
          ))}
        </section>

        <section className="px-5 pt-5 text-center">
          <div className="mx-auto max-w-xs text-ink"><MonthBar /></div>
          <p className="hero-muted mt-4 text-sm">Dépenses perso · {monthLabel(month).toLowerCase()}</p>
          <p className="tabular text-[2rem] font-semibold tracking-tight">{mask(spent)}</p>
          {delta !== null && !hidden && <p className="hero-muted text-xs">{delta === 0 ? 'Comme le mois précédent' : `${delta > 0 ? '+' : ''}${delta} % par rapport au mois précédent`}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 px-5 pt-5 text-ink">
          <button onClick={() => goTab('dettes')} className="rounded-2xl bg-white px-4 py-3 text-left">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="h-2 w-2 rounded-full bg-emerald-500" />On me doit</p>
            <p className="tabular mt-0.5 font-semibold">{mask(receivableTotal)}</p>
            {receivableLate > 0 && <p className="mt-1 w-fit rounded-full bg-red-100 px-2 py-0.5 text-[0.6875rem] font-medium text-red-700">{receivableLate} en retard</p>}
          </button>
          <button onClick={() => goTab('dettes')} className="rounded-2xl bg-white px-4 py-3 text-left">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="h-2 w-2 rounded-full bg-red-500" />Je dois</p>
            <p className="tabular mt-0.5 font-semibold">{mask(payableTotal)}</p>
          </button>
        </section>

        <section className="grid grid-cols-4 gap-y-5 px-3 pb-6 pt-7">
          {shortcuts.map(({ label, Icon, run }) => (
            <button key={label} onClick={run} className="flex flex-col items-center gap-2 text-center">
              <Icon size={28} strokeWidth={1.5} />
              <span className="text-[0.8125rem] leading-tight">{label}</span>
            </button>
          ))}
        </section>
        <ByNord onHero className="pb-4" />
      </div>

      <section className="relative -mt-6 min-h-[40vh] rounded-t-[28px] bg-white px-5 pb-6 pt-6 lg:mt-0 lg:px-8 lg:pt-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="section-title flex-1">Opérations du mois</h2>
          <button onClick={() => goTab('historique')} className="flex items-center gap-1 text-sm text-ink-muted">Tout voir <ChevronRight size={16} /></button>
        </div>
        {activity.length === 0 ? <Empty icon="📒" text="Aucune opération ce mois-ci. Touche le bouton + pour en ajouter une." /> : <ActivityList items={activity.slice(0, 40)} />}
      </section>

      <HomeAside goTab={goTab} />
    </div>
  )
}

/* ---------- 3e colonne sur grand écran : qui me doit, prochaines échéances ---------- */
function HomeAside({ goTab }: { goTab: GoTab }) {
  const { receivables, contactById, sales, saleState, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const upcoming = sales.map((s) => ({ s, st: saleState.get(s.id)! })).filter((x) => x.st.remaining > 0 && x.st.nextDue)
    .sort((a, b) => (a.st.nextDue! < b.st.nextDue! ? -1 : 1)).slice(0, 6)
  return (
    <aside className="hidden space-y-4 2xl:block 2xl:sticky 2xl:top-4">
      <section className="rounded-[28px] border border-cream-line bg-cream-tile p-5">
        <div className="mb-3 flex items-center"><h3 className="flex-1 font-semibold">Qui me doit</h3><button onClick={() => goTab('dettes')} className="text-sm text-ink-muted">Tout voir</button></div>
        {receivables.length === 0 && <p className="text-sm text-ink-muted">Personne ne te doit d'argent.</p>}
        {receivables.slice(0, 6).map((r) => {
          const pct = r.principal ? Math.round((r.repaid / r.principal) * 100) : 0
          return (
            <button key={r.contact_id} onClick={() => forms.open({ f: 'contact', id: r.contact_id })} className="block w-full py-2.5 text-left">
              <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{contactById.get(r.contact_id)?.name}</span>
                <span className={`tabular text-sm font-semibold ${r.late ? 'text-red-600' : ''}`}>{hidden ? '••••' : fmt(r.total, cur)}</span></span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-neutral-100"><span className={`block h-full rounded-full ${r.late ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></span>
            </button>
          )
        })}
      </section>
      <section className="rounded-[28px] border border-cream-line bg-cream-tile p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock size={18} /> Prochaines échéances</h3>
        {upcoming.length === 0 && <p className="text-sm text-ink-muted">Aucune échéance à venir.</p>}
        {upcoming.map(({ s, st }) => (
          <button key={s.id} onClick={() => forms.open({ f: 'saleDetail', id: s.id })} className="flex w-full items-center gap-2 py-2 text-left text-sm">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{contactById.get(s.contact_id ?? '')?.name ?? 'Client'}</span><span className="block text-xs text-ink-muted">{fmtDateLong(st.nextDue!)}</span></span>
            <span className="tabular">{hidden ? '••••' : fmt(st.remaining, cur)}</span>
          </button>
        ))}
      </section>
    </aside>
  )
}
