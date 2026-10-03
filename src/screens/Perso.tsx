import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock, Dumbbell, Plus, Receipt, Sparkles, Ticket } from 'lucide-react'
import { useData } from '../lib/data'
import { addMonths, fmt } from '../lib/format'
import { fixedExpenses, personalExpenses } from '../lib/derive'
import { buildActivity } from '../lib/activity'
import { useHidden } from '../lib/prefs'
import { BareIcon, Empty, Header } from '../components/ui'
import { MonthBar, fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { ActivityList } from '../components/ActivityList'
import { Bar, SectionTiles } from '../components/Tiles'
import { methodLabel } from '../components/forms'

export type PersoSection = 'depenses' | 'fixes' | 'sport' | 'beaute'

export default function PersoScreen({ section, setSection, onBack }: { section: PersoSection; setSection: (s: PersoSection) => void; onBack?: () => void }) {
  const d = useData()
  const { month, methods, balanceOf, sessions, beauty, cur } = d
  const forms = useForms()
  const [hidden] = useHidden()
  const mask = (n: number) => (hidden ? '••••' : fmt(n, cur))
  const perso = methods.find((m) => m.is_active && m.type === 'especes')
  const all = personalExpenses(d, month)
  const total = all.reduce((a, e) => a + e.amount, 0)
  const fixedTotal = fixedExpenses(d, month).reduce((a, e) => a + e.amount, 0)
  const sportTotal = all.filter((e) => e.source === 'sport').reduce((a, e) => a + e.amount, 0)
  const beautyTotal = all.filter((e) => e.source === 'beaute').reduce((a, e) => a + e.amount, 0)
  const nSessions = sessions.filter((s) => s.session_date.startsWith(month)).length
  const nBeauty = beauty.filter((b) => b.service_date.startsWith(month)).length
  const prevFixed = fixedExpenses(d, addMonths(month, -1))
  const nowFixed = fixedExpenses(d, month)
  const todo = prevFixed.filter((p) => !nowFixed.some((n) => n.category_id === p.category_id && (n.label ?? '') === (p.label ?? '')))

  return (
    <div className="lg:mx-auto lg:max-w-5xl 3xl:max-w-7xl">
      <Header title="Dépense perso" onBack={onBack} />
      <div className="space-y-4 px-5 pb-10 lg:px-8">
        {/* Résumé */}
        <section className="hero overflow-hidden rounded-[28px] p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="hero-muted text-xs font-semibold uppercase tracking-wider">Dépensé ce mois</p>
              <p className="tabular text-[2.25rem] font-semibold leading-tight">{mask(total)}</p>
              {perso && <p className="hero-muted text-sm">{methodLabel(perso)} : <b className="tabular">{mask(balanceOf.get(perso.id) ?? 0)}</b> disponible</p>}
            </div>
            <div className="w-full max-w-xs text-ink sm:w-auto"><MonthBar /></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[['Fixes', fixedTotal], ['Sport', sportTotal], ['Beauté', beautyTotal]].map(([l, v]) => (
              <div key={l as string} className="hero-card rounded-2xl bg-white/60 px-3 py-2.5"><p className="hero-muted text-[0.6875rem]">{l}</p><p className="tabular truncate text-sm font-semibold">{mask(v as number)}</p></div>
            ))}
          </div>
          <button onClick={() => forms.open(section === 'sport' ? { f: 'sportSession' } : section === 'beaute' ? { f: 'beauty' } : { f: 'expense', preset: section === 'fixes' ? { is_fixed: true } : undefined })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 font-semibold text-ink active:scale-[.98]">
            <Plus size={20} /> {section === 'sport' ? 'Nouvelle séance' : section === 'beaute' ? 'Nouvelle prestation' : section === 'fixes' ? 'Dépense fixe' : 'Nouvelle dépense'}
          </button>
        </section>

        <SectionTiles value={section} onChange={setSection} cols="grid-cols-4"
          items={[
            { k: 'depenses', label: 'Dépenses', Icon: Receipt, value: mask(total) },
            { k: 'fixes', label: 'Fixes', Icon: CalendarCheck, value: mask(fixedTotal), badge: todo.length ? `${todo.length} à noter` : undefined, alert: todo.length > 0 },
            { k: 'sport', label: 'Sport', Icon: Dumbbell, value: `${nSessions} séance${nSessions > 1 ? 's' : ''}` },
            { k: 'beaute', label: 'Beauté', Icon: Sparkles, value: `${nBeauty} presta.` },
          ]} />

        {section === 'depenses' && <Depenses />}
        {section === 'fixes' && (
          <div className="space-y-4">
            {todo.length > 0 && (
              <section className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                <h3 className="mb-2 font-semibold">Pas encore notées ce mois-ci</h3>
                {todo.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{e.label || d.catById.get(e.category_id ?? '')?.name || 'Dépense fixe'}</span><span className="block text-xs text-ink-muted">Le mois dernier : {fmt(e.amount, cur)}</span></span>
                    <button onClick={() => forms.open({ f: 'expense', preset: { amount: e.amount, category_id: e.category_id, label: e.label, payment_method_id: e.payment_method_id, is_fixed: true } })} className="btn-dark px-4 py-2 text-sm">Noter</button>
                  </div>
                ))}
              </section>
            )}
            {nowFixed.length === 0 ? <Empty icon="📅" text="Aucune dépense fixe ce mois-ci (loyer, Jirama, écolage, abonnements…)." /> : (
              <div>{nowFixed.map((e) => (
                <button key={e.id} onClick={() => forms.open({ f: 'expense', item: e })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
                  <BareIcon name={d.catById.get(e.category_id ?? '')?.name ?? 'autre'} size={26} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{e.label || d.catById.get(e.category_id ?? '')?.name}</span><span className="block text-xs text-ink-muted">{fmtDateLong(e.spent_on)} · {methodLabel(d.methodById.get(e.payment_method_id ?? ''))}</span></span>
                  <span className="tabular font-semibold">−{fmt(e.amount, cur)}</span>
                </button>
              ))}</div>
            )}
          </div>
        )}
        {section === 'sport' && <Sport />}
        {section === 'beaute' && <Beaute />}
      </div>
    </div>
  )
}

/* ---------- Dépenses du mois : répartition + liste ---------- */
function Depenses() {
  const d = useData()
  const { month, catById, cur } = d
  const list = personalExpenses(d, month)
  const total = list.reduce((a, e) => a + e.amount, 0)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of list) { const k = e.category_id ?? '-'; m.set(k, (m.get(k) ?? 0) + e.amount) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [list])
  const activity = useMemo(() => buildActivity(d).filter((a) => a.key.startsWith('e') && a.date.startsWith(month)), [d, month])
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section>
        <h3 className="mb-3 font-semibold">Par catégorie</h3>
        {byCat.length === 0 && <p className="text-sm text-ink-muted">Rien ce mois-ci.</p>}
        <div className="space-y-3">
          {byCat.map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 flex items-center gap-2 text-sm"><BareIcon name={catById.get(k)?.name ?? 'autre'} size={18} /><span className="flex-1 truncate">{catById.get(k)?.name ?? 'Sans catégorie'}</span><span className="tabular font-medium">{fmt(v, cur)}</span><span className="w-10 text-right text-xs text-ink-muted">{Math.round((v / total) * 100)} %</span></div>
              <Bar pct={(v / total) * 100} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Toutes les dépenses</h3>
        {activity.length === 0 ? <Empty icon="🧾" text="Aucune dépense ce mois-ci." /> : <ActivityList items={activity} />}
      </section>
    </div>
  )
}

/* ---------- Sport ---------- */
function Sport() {
  const d = useData()
  const { month, sessions, packages, venues, coaches, expenses, cur } = d
  const forms = useForms()
  const name = (list: { id: string; name: string }[], id: string | null) => (id ? list.find((x) => x.id === id)?.name : null)
  const monthSessions = sessions.filter((s) => s.session_date.startsWith(month))
  const spent = expenses.filter((e) => e.source === 'sport' && e.spent_on.startsWith(month)).reduce((a, e) => a + e.amount, 0)
  const today = new Date().toISOString().slice(0, 10)
  const active = packages.filter((p) => !p.end_date || p.end_date >= today)
  const unpaid = sessions.filter((s) => !s.is_paid && !s.package_id)
  const spentBy = (key: 'venue_id' | 'coach_id', id: string) =>
    sessions.filter((s) => s[key] === id && !s.package_id && s.is_paid).reduce((a, s) => a + s.price, 0) + packages.filter((p) => p[key] === id).reduce((a, p) => a + p.price, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Séances</p><p className="tabular text-lg font-semibold">{monthSessions.length}</p></div>
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Dépensé</p><p className="tabular text-sm font-semibold">{fmt(spent, cur)}</p></div>
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Par séance</p><p className="tabular text-sm font-semibold">{monthSessions.length ? fmt(Math.round(spent / monthSessions.length), cur) : '—'}</p></div>
      </div>
      {unpaid.length > 0 && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{unpaid.length} séance{unpaid.length > 1 ? 's' : ''} pas encore payée{unpaid.length > 1 ? 's' : ''} ({fmt(unpaid.reduce((a, s) => a + s.price, 0), cur)}).</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center"><h3 className="flex-1 font-semibold">Abonnements et forfaits</h3><button onClick={() => forms.open({ f: 'sportPackage' })} className="flex items-center gap-1 text-sm text-[#4A56E2]"><Ticket size={16} /> Ajouter</button></div>
          {active.length === 0 && <p className="text-sm text-ink-muted">Aucun forfait en cours.</p>}
          <div className="space-y-2">
            {active.map((p) => {
              const used = sessions.filter((s) => s.package_id === p.id).length
              return (
                <button key={p.id} onClick={() => forms.open({ f: 'sportPackage', item: p })} className="w-full rounded-2xl border border-cream-line bg-cream-tile p-3 text-left">
                  <div className="flex items-start gap-2"><span className="min-w-0 flex-1"><span className="block font-medium">{p.kind === 'mensuel' ? 'Abonnement' : `Carte de ${p.sessions_total} séances`}</span>
                    <span className="block truncate text-xs text-ink-muted">{[name(venues, p.venue_id), name(coaches, p.coach_id) && `coach ${name(coaches, p.coach_id)}`].filter(Boolean).join(' · ')}{p.end_date ? ` · jusqu'au ${fmtDateLong(p.end_date)}` : ''}</span></span>
                    <span className="tabular text-sm font-semibold">{fmt(p.price, cur)}</span></div>
                  {p.kind === 'forfait_seances' && <div className="mt-2"><Bar pct={(used / (p.sessions_total || 1)) * 100} color="bg-ink" /><p className="mt-1 text-xs text-ink-muted">{used} utilisée{used > 1 ? 's' : ''} · reste {Math.max(0, (p.sessions_total ?? 0) - used)}</p></div>}
                </button>
              )
            })}
          </div>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Séances du mois</h3>
          {monthSessions.length === 0 && <Empty icon="💪" text="Aucune séance ce mois-ci." />}
          {monthSessions.map((s) => (
            <button key={s.id} onClick={() => forms.open({ f: 'sportSession', item: s })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
              <Dumbbell size={22} strokeWidth={1.6} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.activity ?? 'Séance'}</span>
                <span className="block truncate text-xs text-ink-muted">{[fmtDateLong(s.session_date.slice(0, 10)), name(venues, s.venue_id), name(coaches, s.coach_id) && `coach ${name(coaches, s.coach_id)}`].filter(Boolean).join(' · ')}</span></span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.package_id ? 'bg-sky-100 text-sky-800' : s.is_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{s.package_id ? 'Forfait' : s.is_paid ? fmt(s.price, cur) : 'À payer'}</span>
            </button>
          ))}
        </section>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">Établissements et coachs</h3>
        {venues.length + coaches.length === 0 && <p className="text-sm text-ink-muted">Ils s'ajoutent quand tu notes une séance ou un forfait.</p>}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => <div key={v.id} className="rounded-2xl border border-cream-line p-3"><p className="text-xs text-ink-muted">Établissement</p><p className="truncate font-medium">{v.name}</p><p className="tabular text-xs text-ink-muted">Total payé : {fmt(spentBy('venue_id', v.id), cur)}</p></div>)}
          {coaches.map((c) => <div key={c.id} className="rounded-2xl border border-cream-line p-3"><p className="text-xs text-ink-muted">Coach indépendant</p><p className="truncate font-medium">{c.name}</p><p className="tabular text-xs text-ink-muted">Total payé : {fmt(spentBy('coach_id', c.id), cur)}</p></div>)}
        </div>
      </section>
    </div>
  )
}

/* ---------- Beauté ---------- */
function Beaute() {
  const { month, beauty, providers, cur } = useData()
  const forms = useForms()
  const [all, setAll] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const list = beauty.filter((b) => all || b.service_date.startsWith(month))
  const spent = beauty.filter((b) => b.service_date.startsWith(month)).reduce((a, b) => a + b.price, 0)
  const next = beauty.filter((b) => b.next_appointment && b.next_appointment.slice(0, 10) >= today).sort((a, b) => (a.next_appointment! < b.next_appointment! ? -1 : 1))
  const prov = (id: string | null) => (id ? providers.find((p) => p.id === id)?.name : null)
  const byProv = providers.map((p) => ({ p, total: beauty.filter((b) => b.provider_id === p.id).reduce((a, b) => a + b.price, 0), n: beauty.filter((b) => b.provider_id === p.id).length })).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Dépensé ce mois</p><p className="tabular font-semibold">{fmt(spent, cur)}</p></div>
        <div className="rounded-2xl bg-sun-100 p-3"><p className="flex items-center gap-1 text-xs"><CalendarClock size={14} /> Prochain RDV</p><p className="truncate text-sm font-semibold">{next[0] ? `${fmtDateLong(next[0].next_appointment!.slice(0, 10))}` : 'Aucun'}</p></div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-2 flex items-center"><h3 className="flex-1 font-semibold">{all ? 'Toutes les prestations' : 'Prestations du mois'}</h3><button onClick={() => setAll(!all)} className="text-sm text-ink-muted">{all ? 'Ce mois' : 'Tout voir'}</button></div>
          {list.length === 0 && <Empty icon="💅" text="Aucune prestation." />}
          {list.map((b) => (
            <button key={b.id} onClick={() => forms.open({ f: 'beauty', item: b })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
              <Sparkles size={22} strokeWidth={1.6} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.service_type}</span><span className="block truncate text-xs text-ink-muted">{[fmtDateLong(b.service_date.slice(0, 10)), prov(b.provider_id)].filter(Boolean).join(' · ')}</span></span>
              <span className={`tabular shrink-0 text-sm font-semibold ${b.is_paid ? '' : 'text-red-600'}`}>{b.is_paid ? fmt(b.price, cur) : 'À payer'}</span>
            </button>
          ))}
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Mes prestataires</h3>
          {byProv.length === 0 && <p className="text-sm text-ink-muted">Ils s'ajoutent avec ta première prestation.</p>}
          {byProv.map(({ p, total, n }) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="block text-xs text-ink-muted">{n} prestation{n > 1 ? 's' : ''}</span></span>
              <span className="tabular text-sm">{fmt(total, cur)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
