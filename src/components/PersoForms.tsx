import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, isoOf, parseAmount, todayISO } from '../lib/format'
import type { BeautyService, CatModule, SportPackage, SportSession } from '../lib/types'
import { Segmented, Sheet } from './ui'
import { DateField } from './DatePicker'
import { ErrorBox, FormActions, MethodChips, SmallAmount, chip, useMethodOf } from './forms'

const amountStr = (n: number) => (n ? n.toLocaleString('fr-FR') : '')
const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Enregistrement impossible.'
export const ACTIVITIES = ['Musculation', 'Cardio', 'Fitness', 'Boxe', 'Danse', 'Natation', 'Yoga', 'Course', 'Autre']
export const BEAUTY_TYPES = ['Coiffure', 'Tresses', 'Ongles', 'Soin visage', 'Épilation', 'Maquillage', 'Massage', 'Autre']

/* ---------- Choisir un nom existant ou en créer un ---------- */
export type Pick = { id: string | null; name: string }
const NONE: Pick = { id: null, name: '' }

function NamePicker({ label, items, value, onChange, placeholder, optional }: {
  label: string; items: { id: string; name: string }[]; value: Pick; onChange: (v: Pick) => void; placeholder: string; optional?: boolean
}) {
  const [typing, setTyping] = useState(false)
  return (
    <div>
      <p className="label">{label}{optional && <span className="text-xs"> (facultatif)</span>}</p>
      <div className="flex flex-wrap gap-2">
        {optional && <button type="button" onClick={() => { onChange(NONE); setTyping(false) }} className={chip(!value.id && !value.name)}>Aucun</button>}
        {items.map((x) => <button key={x.id} type="button" onClick={() => { onChange({ id: x.id, name: x.name }); setTyping(false) }} className={chip(value.id === x.id)}>{x.name}</button>)}
        {!typing && <button type="button" onClick={() => { setTyping(true); onChange(NONE) }} className={`${chip(false)} flex items-center gap-1`}><Plus size={14} /> Nouveau</button>}
      </div>
      {typing && <input autoFocus className="input mt-2 py-3" placeholder={placeholder} value={value.id ? '' : value.name} onChange={(e) => onChange({ id: null, name: e.target.value })} />}
    </div>
  )
}

async function ensureNamed(table: string, p: Pick, extra: Record<string, unknown> = {}): Promise<string | null> {
  if (p.id) return p.id
  if (!p.name.trim()) return null
  const { data, error } = await supabase.from(table).insert({ name: p.name.trim(), ...extra }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Crée, met à jour ou supprime la dépense liée à une séance / un forfait / une prestation. */
async function syncExpense(existing: string | null, row: { amount: number; spent_on: string; payment_method_id: string | null; label: string; source: 'sport' | 'beaute'; category_id: string | null } | null) {
  if (!row || row.amount <= 0) { if (existing) await supabase.from('expenses').delete().eq('id', existing); return null }
  if (existing) { const { error } = await supabase.from('expenses').update(row).eq('id', existing); if (error) throw error; return existing }
  const { data, error } = await supabase.from('expenses').insert(row).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
function useCat() { const { categories } = useData(); return (m: CatModule) => categories.find((c) => c.module === m)?.id ?? null }
const dayOf = (ts: string) => ts.slice(0, 10)

/* =====================================================================
   Séance de sport
   ===================================================================== */
export function SportSessionForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: SportSession | null }) {
  const { venues, coaches, packages, sessions, reload, expenses } = useData()
  const methodOf = useMethodOf()
  const catOf = useCat()
  const [date, setDate] = useState(todayISO())
  const [activity, setActivity] = useState(ACTIVITIES[0])
  const [venue, setVenue] = useState<Pick>(NONE)
  const [coach, setCoach] = useState<Pick>(NONE)
  const [pkg, setPkg] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [paid, setPaid] = useState(true)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    const last = sessions[0]
    setDate(item ? dayOf(item.session_date) : todayISO()); setActivity(item?.activity ?? last?.activity ?? ACTIVITIES[0])
    const v = item?.venue_id ?? (item ? null : last?.venue_id ?? null), c = item?.coach_id ?? (item ? null : last?.coach_id ?? null)
    setVenue(v ? { id: v, name: venues.find((x) => x.id === v)?.name ?? '' } : NONE)
    setCoach(c ? { id: c, name: coaches.find((x) => x.id === c)?.name ?? '' } : NONE)
    setPkg(item?.package_id ?? null); setPrice(amountStr(item?.price ?? 0)); setPaid(item?.is_paid ?? true)
    setMethodId(expenses.find((e) => e.id === item?.expense_id)?.payment_method_id ?? methodOf('especes')); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  // Forfaits en cours qui correspondent à l'établissement / au coach choisi
  const activePkgs = useMemo(() => packages.filter((p) => {
    if (p.end_date && p.end_date < date) return false
    if (p.kind === 'forfait_seances') { const used = sessions.filter((s) => s.package_id === p.id && s.id !== item?.id).length; if (used >= (p.sessions_total ?? 0)) return false }
    return (venue.id && p.venue_id === venue.id) || (coach.id && p.coach_id === coach.id) || p.id === pkg
  }), [packages, sessions, venue.id, coach.id, date, pkg, item?.id])

  const save = async () => {
    if (!venue.id && !venue.name.trim() && !coach.id && !coach.name.trim()) return setErr('Choisis un établissement ou un coach.')
    const amt = pkg ? 0 : parseAmount(price)
    if (!pkg && paid && amt > 0 && !methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    try {
      const venueId = await ensureNamed('sport_venues', venue)
      const coachId = await ensureNamed('coaches', coach)
      const where = [activity, venue.name || null, coach.name ? `coach ${coach.name}` : null].filter(Boolean).join(' · ')
      const expenseId = await syncExpense(item?.expense_id ?? null, !pkg && paid ? { amount: amt, spent_on: date, payment_method_id: methodId, label: `Séance ${where}`, source: 'sport', category_id: catOf('sport') } : null)
      const row = { session_date: `${date}T12:00:00`, activity, venue_id: venueId, coach_id: coachId, package_id: pkg, price: amt, is_paid: pkg ? true : paid, expense_id: expenseId, note: note.trim() || null }
      const { error } = item ? await supabase.from('sport_sessions').update(row).eq('id', item.id) : await supabase.from('sport_sessions').insert(row)
      if (error) throw error
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr(errMsg(e)) }
  }
  const remove = async () => {
    setBusy(true)
    await supabase.from('sport_sessions').delete().eq('id', item!.id)
    if (item!.expense_id) await supabase.from('expenses').delete().eq('id', item!.expense_id)
    setBusy(false); await reload(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier la séance' : 'Séance de sport'}>
      <div className="space-y-5">
        <div><p className="label">Activité</p><div className="flex flex-wrap gap-2">{ACTIVITIES.map((a) => <button key={a} type="button" onClick={() => setActivity(a)} className={chip(activity === a)}>{a}</button>)}</div></div>
        <NamePicker label="Établissement" items={venues} value={venue} onChange={(v) => { setVenue(v); setPkg(null) }} placeholder="Ex : Fitness Club Ivandry" optional />
        <NamePicker label="Coach personnel (indépendant)" items={coaches} value={coach} onChange={(v) => { setCoach(v); setPkg(null) }} placeholder="Nom du coach" optional />
        {activePkgs.length > 0 && (
          <div>
            <p className="label">Comptée dans un forfait ?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPkg(null)} className={chip(!pkg)}>Non, payée à part</button>
              {activePkgs.map((p) => <button key={p.id} type="button" onClick={() => setPkg(p.id)} className={chip(pkg === p.id)}>{p.kind === 'mensuel' ? 'Abonnement mensuel' : `Forfait ${p.sessions_total} séances`}</button>)}
            </div>
          </div>
        )}
        {!pkg && (
          <div className="space-y-3 rounded-2xl border border-cream-line bg-cream-tile p-4">
            <div><label className="label" htmlFor="ss-price">Prix de la séance</label><SmallAmount id="ss-price" value={price} onChange={setPrice} /></div>
            <Segmented value={paid ? 'oui' : 'non'} onChange={(v) => setPaid(v === 'oui')} options={[['oui', 'Payée'], ['non', 'Pas encore payée']]} />
            {paid && parseAmount(price) > 0 && <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />}
          </div>
        )}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="ss-date">Date</label>
          <DateField id="ss-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="ss-note">Note</label>
          <input id="ss-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Forfait / abonnement sport
   ===================================================================== */
export function SportPackageForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: SportPackage | null }) {
  const { venues, coaches, reload, sessions, cur, expenses } = useData()
  const methodOf = useMethodOf()
  const catOf = useCat()
  const [kind, setKind] = useState<'mensuel' | 'forfait_seances'>('mensuel')
  const [n, setN] = useState(10)
  const [venue, setVenue] = useState<Pick>(NONE)
  const [coach, setCoach] = useState<Pick>(NONE)
  const [price, setPrice] = useState('')
  const [start, setStart] = useState(todayISO())
  const [end, setEnd] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const plusMonth = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return isoOf(new Date(y, m, dd - 1)) }

  useEffect(() => {
    if (!open) return
    setErr(''); setKind(item?.kind ?? 'mensuel'); setN(item?.sessions_total ?? 10)
    setVenue(item?.venue_id ? { id: item.venue_id, name: venues.find((x) => x.id === item.venue_id)?.name ?? '' } : NONE)
    setCoach(item?.coach_id ? { id: item.coach_id, name: coaches.find((x) => x.id === item.coach_id)?.name ?? '' } : NONE)
    setPrice(amountStr(item?.price ?? 0)); setStart(item?.start_date ?? todayISO()); setEnd(item?.end_date ?? plusMonth(todayISO())); setMethodId(expenses.find((e) => e.id === item?.expense_id)?.payment_method_id ?? methodOf('especes'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    if (!venue.id && !venue.name.trim() && !coach.id && !coach.name.trim()) return setErr('Choisis un établissement ou un coach.')
    const amt = parseAmount(price)
    if (amt > 0 && !methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    try {
      const venueId = await ensureNamed('sport_venues', venue)
      const coachId = await ensureNamed('coaches', coach)
      const what = kind === 'mensuel' ? 'Abonnement sport' : `Forfait ${n} séances`
      const expenseId = await syncExpense(item?.expense_id ?? null, { amount: amt, spent_on: start, payment_method_id: methodId, label: [what, venue.name || coach.name].filter(Boolean).join(' · '), source: 'sport', category_id: catOf('sport') })
      const row = { kind, sessions_total: kind === 'forfait_seances' ? n : null, venue_id: venueId, coach_id: coachId, price: amt, start_date: start, end_date: end || null, expense_id: expenseId }
      const { error } = item ? await supabase.from('sport_packages').update(row).eq('id', item.id) : await supabase.from('sport_packages').insert(row)
      if (error) throw error
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr(errMsg(e)) }
  }
  const remove = async () => {
    setBusy(true)
    await supabase.from('sport_packages').delete().eq('id', item!.id)
    if (item!.expense_id) await supabase.from('expenses').delete().eq('id', item!.expense_id)
    setBusy(false); await reload(); onClose()
  }
  const used = item ? sessions.filter((s) => s.package_id === item.id).length : 0

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le forfait' : 'Abonnement ou forfait'}>
      <div className="space-y-5">
        <Segmented value={kind} onChange={setKind} options={[['mensuel', 'Abonnement'], ['forfait_seances', 'Carte de séances']]} />
        {kind === 'forfait_seances' && <div><p className="label">Nombre de séances</p><div className="flex flex-wrap gap-2">{[4, 5, 8, 10, 12, 16, 20].map((k) => <button key={k} type="button" onClick={() => setN(k)} className={chip(n === k)}>{k}</button>)}</div></div>}
        <NamePicker label="Établissement" items={venues} value={venue} onChange={setVenue} placeholder="Ex : Fitness Club Ivandry" optional />
        <NamePicker label="Coach personnel" items={coaches} value={coach} onChange={setCoach} placeholder="Nom du coach" optional />
        <div><label className="label" htmlFor="sp-price">Prix payé</label><SmallAmount id="sp-price" value={price} onChange={setPrice} /></div>
        {kind === 'forfait_seances' && parseAmount(price) > 0 && <p className="text-sm text-ink-soft">Soit <b>{fmt(Math.round(parseAmount(price) / n), cur)}</b> par séance.</p>}
        {parseAmount(price) > 0 && <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="sp-start">Début</label>
          <DateField id="sp-start" value={start} onChange={(v) => { setStart(v); if (kind === 'mensuel') setEnd(plusMonth(v)) }} className="py-3" />
          <label className="label mb-0" htmlFor="sp-end">Fin</label>
          <DateField id="sp-end" value={end} onChange={setEnd} clearable placeholder="Pas de date de fin" className="py-3" />
        </div>
        {item && kind === 'forfait_seances' && <p className="text-sm text-ink-muted">{used} séance{used > 1 ? 's' : ''} utilisée{used > 1 ? 's' : ''} sur {n}.</p>}
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Prestation beauté
   ===================================================================== */
export function BeautyForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: BeautyService | null }) {
  const { providers, beauty, reload, expenses } = useData()
  const methodOf = useMethodOf()
  const catOf = useCat()
  const [prov, setProv] = useState<Pick>(NONE)
  const [type, setType] = useState(BEAUTY_TYPES[0])
  const [date, setDate] = useState(todayISO())
  const [price, setPrice] = useState('')
  const [paid, setPaid] = useState(true)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    const pid = item?.provider_id ?? (item ? null : beauty[0]?.provider_id ?? null)
    setProv(pid ? { id: pid, name: providers.find((x) => x.id === pid)?.name ?? '' } : NONE)
    setType(item?.service_type ?? BEAUTY_TYPES[0]); setDate(item ? dayOf(item.service_date) : todayISO())
    setPrice(amountStr(item?.price ?? 0)); setPaid(item?.is_paid ?? true); setMethodId(expenses.find((e) => e.id === item?.expense_id)?.payment_method_id ?? methodOf('especes'))
    setNext(item?.next_appointment ? dayOf(item.next_appointment) : ''); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(price)
    if (!amt) return setErr('Indique le prix.')
    if (paid && !methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    try {
      const providerId = await ensureNamed('beauty_providers', prov)
      const expenseId = await syncExpense(item?.expense_id ?? null, paid ? { amount: amt, spent_on: date, payment_method_id: methodId, label: [type, prov.name].filter(Boolean).join(' · '), source: 'beaute', category_id: catOf('beaute') } : null)
      const row = { provider_id: providerId, service_type: type, service_date: `${date}T12:00:00`, price: amt, is_paid: paid, expense_id: expenseId, next_appointment: next ? `${next}T09:00:00` : null, note: note.trim() || null }
      const { error } = item ? await supabase.from('beauty_services').update(row).eq('id', item.id) : await supabase.from('beauty_services').insert(row)
      if (error) throw error
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr(errMsg(e)) }
  }
  const remove = async () => {
    setBusy(true)
    await supabase.from('beauty_services').delete().eq('id', item!.id)
    if (item!.expense_id) await supabase.from('expenses').delete().eq('id', item!.expense_id)
    setBusy(false); await reload(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier la prestation' : 'Beauté'}>
      <div className="space-y-5">
        <div><p className="label">Prestation</p><div className="flex flex-wrap gap-2">{BEAUTY_TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)} className={chip(type === t)}>{t}</button>)}</div></div>
        <NamePicker label="Salon ou prestataire" items={providers} value={prov} onChange={setProv} placeholder="Ex : Salon Fara, coiffeuse à domicile" optional />
        <div className="space-y-3 rounded-2xl border border-cream-line bg-cream-tile p-4">
          <div><label className="label" htmlFor="bt-price">Prix</label><SmallAmount id="bt-price" value={price} onChange={setPrice} /></div>
          <Segmented value={paid ? 'oui' : 'non'} onChange={(v) => setPaid(v === 'oui')} options={[['oui', 'Payée'], ['non', 'Pas encore payée']]} />
          {paid && <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />}
        </div>
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="bt-date">Date</label>
          <DateField id="bt-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="bt-next">Prochain RDV</label>
          <DateField id="bt-next" value={next} onChange={setNext} clearable placeholder="Aucun" className="py-3" />
          <label className="label mb-0" htmlFor="bt-note">Note</label>
          <input id="bt-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
