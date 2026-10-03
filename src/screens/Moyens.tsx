import { useEffect, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, monthLabel, parseAmount } from '../lib/format'
import type { MethodType, PaymentMethod } from '../lib/types'
import { Sheet } from '../components/ui'
import { ErrorBox, FormActions, SmallAmount, TYPE_LABEL, chip, methodLabel } from '../components/forms'
import { useForms } from '../components/FormHost'

const COLORS = ['#10B981', '#F97316', '#FFCC00', '#3B82F6', '#8B5CF6', '#EF4444', '#0EA5E9', '#141414']
const TYPES: MethodType[] = ['carte', 'especes', 'caisse_business', 'mvola', 'orange_money', 'airtel_money']

/** Cartes bancaires, caisses (espèces perso, caisse business) et Mobile Money. */
export function MoyensPage() {
  const { methods, balanceOf, withdrawals, expenses, month, cur } = useData()
  const forms = useForms()
  const [edit, setEdit] = useState<{ item: PaymentMethod | null } | null>(null)
  const caisses = methods.filter((m) => m.track_balance)
  const cards = methods.filter((m) => m.type === 'carte')
  const others = methods.filter((m) => !m.track_balance && m.type !== 'carte')

  const Row = ({ m, children }: { m: PaymentMethod; children?: React.ReactNode }) => (
    <button onClick={() => setEdit({ item: m })} className={`flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0 ${m.is_active ? '' : 'opacity-50'}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: m.color ?? '#999' }}>
        {m.type === 'carte' ? <CreditCard size={22} /> : <span className="text-sm font-bold">{m.name.charAt(0)}</span>}
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{methodLabel(m)}{!m.is_active && ' (masqué)'}</span><span className="block truncate text-xs text-ink-muted">{children ?? TYPE_LABEL[m.type]}</span></span>
      {m.track_balance && <span className={`tabular shrink-0 font-semibold ${(balanceOf.get(m.id) ?? 0) < 0 ? 'text-red-600' : ''}`}>{fmt(balanceOf.get(m.id) ?? 0, cur)}</span>}
    </button>
  )

  return (
    <div className="space-y-6 px-5 pb-10 pt-2">
      <section>
        <h2 className="mb-1 font-semibold">Caisses (solde suivi)</h2>
        <p className="mb-2 text-xs text-ink-muted">Le solde se calcule tout seul : solde de départ + entrées − sorties.</p>
        {caisses.map((m) => <Row key={m.id} m={m} />)}
        <button onClick={() => forms.open({ f: 'transfer' })} className="btn-ghost mt-2 w-full py-2.5 text-sm">Virement entre caisses</button>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Cartes bancaires</h2>
        {cards.length === 0 && <p className="py-2 text-sm text-ink-muted">Ajoute tes cartes avec leur nom et les 4 derniers chiffres pour ne pas les confondre.</p>}
        {cards.map((m) => {
          const w = withdrawals.filter((x) => x.card_id === m.id && x.withdrawn_on.startsWith(month))
          const tpe = expenses.filter((x) => x.payment_method_id === m.id && x.spent_on.startsWith(month) && x.source !== 'frais_retrait')
          return <Row key={m.id} m={m}>{monthLabel(month)} : {w.length} retrait{w.length > 1 ? 's' : ''} ({fmt(w.reduce((a, x) => a + x.amount, 0), cur)}) · paiements {fmt(tpe.reduce((a, x) => a + x.amount, 0), cur)}</Row>
        })}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Mobile Money et autres</h2>
        {others.map((m) => <Row key={m.id} m={m} />)}
      </section>
      <button onClick={() => setEdit({ item: null })} className="btn-primary w-full"><Plus size={20} /> Ajouter une carte ou une caisse</button>
      <MethodForm open={!!edit} item={edit?.item ?? null} onClose={() => setEdit(null)} />
    </div>
  )
}

function MethodForm({ open, item, onClose }: { open: boolean; item: PaymentMethod | null; onClose: () => void }) {
  const { reload } = useData()
  const [type, setType] = useState<MethodType>('carte')
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [last4, setLast4] = useState('')
  const [color, setColor] = useState(COLORS[3])
  const [track, setTrack] = useState(false)
  const [initial, setInitial] = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setType(item?.type ?? 'carte'); setName(item?.name ?? ''); setBank(item?.bank ?? ''); setLast4(item?.last4 ?? '')
    setColor(item?.color ?? COLORS[3]); setTrack(item?.track_balance ?? false); setInitial(item?.initial_balance ? item.initial_balance.toLocaleString('fr-FR') : ''); setActive(item?.is_active ?? true)
  }, [open, item])
  const pickType = (t: MethodType) => { setType(t); setTrack(t === 'especes' || t === 'caisse_business') }

  const save = async () => {
    if (!name.trim()) return setErr(type === 'carte' ? 'Donne un nom à la carte (ex : BNI perso).' : 'Indique un nom.')
    if (type === 'carte' && !/^\d{4}$/.test(last4)) return setErr('Indique les 4 derniers chiffres de la carte (jamais le numéro complet).')
    setBusy(true); setErr('')
    const row = { type, name: name.trim(), bank: type === 'carte' ? bank.trim() || null : null, last4: type === 'carte' ? last4 : null, color, track_balance: track, initial_balance: track ? parseAmount(initial) : 0, is_active: active }
    const { error } = item ? await supabase.from('payment_methods').update(row).eq('id', item.id) : await supabase.from('payment_methods').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => {
    setBusy(true)
    const { error } = await supabase.from('payment_methods').delete().eq('id', item!.id)
    setBusy(false)
    if (error) return setErr('Déjà utilisé dans des retraits ou virements : décoche « Actif » pour le masquer au lieu de le supprimer.')
    await reload(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier' : 'Nouvelle carte ou caisse'}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{TYPES.map((t) => <button key={t} type="button" onClick={() => pickType(t)} className={chip(type === t)}>{TYPE_LABEL[t]}</button>)}</div>
        <div><label className="label" htmlFor="pm-name">Nom</label><input id="pm-name" className="input" placeholder={type === 'carte' ? 'Ex : BNI perso, BOA pro' : 'Ex : Espèces perso'} value={name} onChange={(e) => setName(e.target.value)} /></div>
        {type === 'carte' && (
          <div className="grid grid-cols-[1fr,8rem] gap-3">
            <div><label className="label" htmlFor="pm-bank">Banque</label><input id="pm-bank" className="input" placeholder="Ex : BNI" value={bank} onChange={(e) => setBank(e.target.value)} /></div>
            <div><label className="label" htmlFor="pm-last4">4 derniers chiffres</label><input id="pm-last4" className="input tabular text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} placeholder="0000" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} /></div>
          </div>
        )}
        {type === 'carte' && <p className="text-xs text-ink-muted">Ne saisis jamais le numéro complet de ta carte ni ton code : les 4 derniers chiffres suffisent pour la reconnaître.</p>}
        <div><p className="label">Couleur</p><div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => setColor(c)} className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-ink ring-offset-2' : ''}`} style={{ background: c }} />)}</div></div>
        {type !== 'carte' && (
          <label className="flex items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile px-4 py-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-ink" checked={track} onChange={(e) => setTrack(e.target.checked)} /> Suivre le solde (afficher combien il reste)
          </label>
        )}
        {track && <div><label className="label" htmlFor="pm-init">Solde de départ</label><SmallAmount id="pm-init" value={initial} onChange={setInitial} /><p className="mt-1 text-xs text-ink-muted">Ce que tu avais au moment de commencer à utiliser l'app.</p></div>}
        {item && (
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-ink" checked={active} onChange={(e) => setActive(e.target.checked)} /> Actif (proposé dans les saisies)</label>
        )}
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
