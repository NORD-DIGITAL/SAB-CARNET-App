import { useState } from 'react'
import { CalendarClock, ChevronRight, HandCoins, HandHeart, Search, Users } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { useHidden } from '../lib/prefs'
import type { ContactBalance } from '../lib/derive'
import { Empty, Header } from '../components/ui'
import { fmtDateLong } from '../components/DatePicker'
import { useForms } from '../components/FormHost'
import { Bar, SectionTiles } from '../components/Tiles'
import { PERSON_CATS, PersonBadge, chip } from '../components/forms'
import type { PersonCat } from '../lib/types'

type Tab = 'on_me_doit' | 'je_dois' | 'personnes'

export default function DettesScreen() {
  const { receivables, receivableTotal, receivablePrincipal, receivableLate, payables, payableTotal, payablePrincipal, contacts, contactById, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const [tab, setTab] = useState<Tab>('on_me_doit')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'retard' | 'montant' | 'nom'>('retard')
  const [cat, setCat] = useState<'tous' | PersonCat>('tous')
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))
  const match = (id: string) => (cat === 'tous' || (contactById.get(id)?.category ?? 'autre') === cat) && (!q.trim() || `${contactById.get(id)?.name ?? ''} ${contactById.get(id)?.phone ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const sorted = (rows: ContactBalance[]) => [...rows].filter((r) => match(r.contact_id)).sort((a, b) =>
    sort === 'nom' ? (contactById.get(a.contact_id)?.name ?? '').localeCompare(contactById.get(b.contact_id)?.name ?? '')
      : sort === 'montant' ? b.total - a.total : Number(b.late) - Number(a.late) || b.total - a.total)

  const isOwed = tab !== 'je_dois'
  const principal = isOwed ? receivablePrincipal : payablePrincipal
  const remaining = isOwed ? receivableTotal : payableTotal
  const repaid = principal - remaining
  const pct = principal ? (repaid / principal) * 100 : 0
  const rows = tab === 'je_dois' ? payables : receivables

  return (
    <div className="lg:mx-auto lg:max-w-5xl 3xl:max-w-7xl">
      <Header title="Dettes" />
      <div className="space-y-4 px-5 pb-10 lg:px-8">
        {/* Vue d'ensemble */}
        <section className={`overflow-hidden rounded-[28px] p-5 text-white shadow-lg lg:p-6 ${isOwed ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500' : 'bg-gradient-to-br from-rose-700 via-rose-600 to-orange-500'}`}>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/70">{isOwed ? 'On me doit encore' : 'Je dois encore'}</p>
          <p className="tabular text-[2.5rem] font-bold leading-tight lg:text-5xl">{mask(remaining)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-[0.6875rem] text-white/75">{isOwed ? 'Prêté / vendu' : 'Emprunté'}</p><p className="tabular truncate text-[0.8125rem] font-bold sm:text-base">{mask(principal)}</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-[0.6875rem] text-white/75">Remboursé</p><p className="tabular truncate text-[0.8125rem] font-bold sm:text-base">{mask(repaid)}</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-[0.6875rem] text-white/75">{isOwed ? 'Personnes' : 'Créanciers'}</p><p className="tabular font-bold">{rows.length}{isOwed && receivableLate ? <span className="ml-1 rounded-full bg-white px-1.5 text-[0.625rem] text-red-600">{receivableLate} retard</span> : null}</p></div>
          </div>
          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1.5 text-xs text-white/75">{Math.round(pct)} % déjà remboursé sur les dossiers en cours</p>
          </div>
        </section>

        <SectionTiles value={tab} onChange={setTab} cols="grid-cols-3"
          items={[
            { k: 'on_me_doit', label: 'On me doit', Icon: HandHeart, value: mask(receivableTotal), badge: receivableLate ? `${receivableLate} retard` : undefined, alert: receivableLate > 0 },
            { k: 'je_dois', label: 'Je dois', Icon: HandCoins, value: mask(payableTotal) },
            { k: 'personnes', label: 'Personnes', Icon: Users, value: `${contacts.length} contact${contacts.length > 1 ? 's' : ''}` },
          ]} />

        {/* Catégories de personnes, avec le montant de chacune */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          <button onClick={() => setCat('tous')} className={chip(cat === 'tous')}>Tout le monde</button>
          {PERSON_CATS.map((pc) => {
            const sum = (tab === 'je_dois' ? payables : receivables).filter((r) => (contactById.get(r.contact_id)?.category ?? 'autre') === pc.k).reduce((a, r) => a + r.total, 0)
            const n = contacts.filter((x) => (x.category ?? 'autre') === pc.k).length
            return (
              <button key={pc.k} onClick={() => setCat(cat === pc.k ? 'tous' : pc.k)} className={`${chip(cat === pc.k)} flex items-center gap-1.5`}>
                {pc.label}{tab === 'personnes' ? <span className="opacity-60">{n}</span> : sum > 0 && !hidden ? <span className="tabular text-xs opacity-70">{fmt(sum, cur)}</span> : null}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
            <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Nom ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une personne" />
          </div>
          {tab !== 'personnes' && (
            <select aria-label="Trier" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="retard">Retards d'abord</option><option value="montant">Plus gros reste</option><option value="nom">Par nom</option>
            </select>
          )}
          {tab === 'on_me_doit' && <button onClick={() => forms.open({ f: 'debt', kind: 'on_me_doit' })} className="btn-primary px-5 py-2.5 text-sm"><HandHeart size={18} /> Je prête</button>}
          {tab === 'je_dois' && <button onClick={() => forms.open({ f: 'debt', kind: 'je_dois' })} className="btn-primary px-5 py-2.5 text-sm"><HandCoins size={18} /> J'emprunte</button>}
        </div>

        {tab !== 'personnes' && (
          <>
            {rows.length === 0 && <Empty icon={isOwed ? '🤝' : '✅'} text={isOwed ? 'Personne ne te doit d\'argent. Les ventes à crédit et les prêts apparaissent ici.' : 'Tu ne dois d\'argent à personne.'} />}
            <div className="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
              {sorted(rows).map((r) => <PersonCard key={r.contact_id} r={r} owed={isOwed} />)}
            </div>
          </>
        )}
        {tab === 'personnes' && (
          <>
            {contacts.length === 0 && <Empty icon="👥" text="Les personnes s'ajoutent toutes seules quand tu notes une vente, un prêt ou un emprunt." />}
            <div className="grid gap-x-6 lg:grid-cols-2 3xl:grid-cols-3">
              {contacts.filter((c) => match(c.id)).map((c) => {
                const owe = receivables.find((r) => r.contact_id === c.id)?.total ?? 0
                const mine = payables.find((r) => r.contact_id === c.id)?.total ?? 0
                return (
                  <button key={c.id} onClick={() => forms.open({ f: 'contact', id: c.id })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{c.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-medium">{c.name}</span><PersonBadge k={c.category} /></span><span className="tabular block truncate text-xs text-ink-muted">{c.phone ?? 'Pas de téléphone'}</span></span>
                    <span className="text-right text-xs">
                      {owe > 0 && <span className="tabular block font-semibold text-emerald-700">+{fmt(owe, cur)}</span>}
                      {mine > 0 && <span className="tabular block font-semibold text-red-600">−{fmt(mine, cur)}</span>}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Carte d'une personne : prêté, remboursé, reste, progression, prochaine échéance. */
function PersonCard({ r, owed }: { r: ContactBalance; owed: boolean }) {
  const { contactById, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const c = contactById.get(r.contact_id)
  const pct = r.principal ? (r.repaid / r.principal) * 100 : 0
  const mask = (n: number) => (hidden ? '••••' : fmt(n, cur))
  return (
    <button onClick={() => forms.open({ f: 'contact', id: r.contact_id })}
      className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${r.late ? 'border-red-200 bg-red-50/60' : 'border-cream-line bg-cream-tile'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-white ${r.late ? 'bg-red-500' : 'bg-ink'}`}>{(c?.name ?? '?').charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="truncate font-semibold">{c?.name ?? 'Personne supprimée'}</span><PersonBadge k={c?.category} /></span>
          <span className="block truncate text-xs text-ink-muted">{r.count} dossier{r.count > 1 ? 's' : ''}{owed && r.sales && r.loans ? ' · ventes + prêts' : owed && r.sales ? ' · ventes à crédit' : owed ? ' · prêts' : ''}</span>
        </span>
        <span className="text-right">
          <span className="block text-[0.6875rem] text-ink-muted">Reste</span>
          <span className={`tabular block text-lg font-bold ${r.late ? 'text-red-600' : ''}`}>{mask(r.total)}</span>
        </span>
      </div>
      <div className="mt-3"><Bar pct={pct} color={r.late ? 'bg-red-500' : owed ? 'bg-emerald-500' : 'bg-ink'} /></div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs text-ink-muted">
        <span>{owed ? 'Prêté' : 'Emprunté'} <b className="tabular text-ink">{mask(r.principal)}</b> · remboursé <b className="tabular text-ink">{mask(r.repaid)}</b></span>
        {r.late ? <span className="font-semibold text-red-600">En retard</span> : r.nextDue ? <span className="flex items-center gap-1"><CalendarClock size={12} /> {fmtDateLong(r.nextDue)}</span> : null}
      </div>
    </button>
  )
}
