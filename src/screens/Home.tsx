import { useMemo, useState } from 'react'
import { ArrowLeftRight, Banknote, ChevronRight, Eye, EyeOff, HandCoins, History, Landmark, Mail, PackagePlus, Receipt, RefreshCw, ShoppingBag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useData } from '../lib/data'
import { addMonths, fmt, monthLabel } from '../lib/format'
import { useHidden, userInfo } from '../lib/prefs'
import { personalExpenses } from '../lib/derive'
import { buildActivity } from '../lib/activity'
import { useBadge } from '../lib/inbox'
import { ByNord, Empty } from '../components/ui'
import { MonthBar } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { ActivityList } from '../components/ActivityList'
import { methodLabel } from '../components/forms'
import type { SubPage } from './Compte'

export default function HomeScreen({ openSub, goTab, onRefresh }: { openSub: (p: SubPage) => void; goTab: (t: 'dettes' | 'business' | 'historique') => void; onRefresh: () => Promise<void> }) {
  const d = useData()
  const { session, profile, methods, balanceOf, month, receivableTotal, receivableLate, payableTotal, cur } = d
  const forms = useForms()
  const [hidden, toggleHidden] = useHidden()
  const [refreshing, setRefreshing] = useState(false)
  const me = userInfo(session, profile)
  const inboxN = useBadge()
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))

  const caisses = methods.filter((m) => m.is_active && m.track_balance)
  const spent = personalExpenses(d, month).reduce((a, e) => a + e.amount, 0)
  const spentPrev = personalExpenses(d, addMonths(month, -1)).reduce((a, e) => a + e.amount, 0)
  const delta = spentPrev ? Math.round(((spent - spentPrev) / spentPrev) * 100) : null
  const activity = useMemo(() => buildActivity(d).filter((a) => a.date.startsWith(month)), [d, month])

  const shortcuts: { label: string; Icon: LucideIcon; run: () => void }[] = [
    { label: 'Dépense', Icon: Receipt, run: () => forms.open({ f: 'expense' }) },
    { label: 'Retrait DAB', Icon: Landmark, run: () => forms.open({ f: 'withdrawal' }) },
    { label: 'Vente', Icon: ShoppingBag, run: () => forms.open({ f: 'sale' }) },
    { label: 'Versement client', Icon: Banknote, run: () => forms.open({ f: 'pickSale' }) },
    { label: 'Achat de stock', Icon: PackagePlus, run: () => forms.open({ f: 'purchase' }) },
    { label: 'Virement', Icon: ArrowLeftRight, run: () => forms.open({ f: 'transfer' }) },
    { label: "J'emprunte", Icon: HandCoins, run: () => forms.open({ f: 'debt', kind: 'je_dois' }) },
    { label: 'Historique', Icon: History, run: () => goTab('historique') },
  ]

  return (
    <div className="bg-white lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-2 lg:p-4 xl:grid-cols-[460px_1fr]">
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

        {/* Caisses suivies : espèces perso, caisse business */}
        <section className="px-5">
          <div className={`grid gap-3 ${caisses.length > 1 ? 'grid-cols-2' : ''}`}>
            {caisses.map((m) => {
              const b = balanceOf.get(m.id) ?? 0
              return (
                <button key={m.id} onClick={() => openSub('moyens')} className="hero-card rounded-2xl bg-white/60 px-4 py-3 text-left">
                  <p className="hero-muted flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: m.color ?? '#999' }} />{methodLabel(m)}</p>
                  <p className={`tabular mt-1 text-xl font-semibold ${!hidden && b < 0 ? 'low-balance' : ''}`}>{mask(b)}</p>
                </button>
              )
            })}
          </div>
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
        {activity.length === 0 ? <Empty icon="📒" text="Aucune opération ce mois-ci. Touche le bouton + pour en ajouter une." /> : <ActivityList items={activity.slice(0, 25)} />}
      </section>
    </div>
  )
}
