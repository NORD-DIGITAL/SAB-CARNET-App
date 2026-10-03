import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Search, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { parseAmount } from '../lib/format'
import type { MethodType, PaymentMethod } from '../lib/types'

export const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`

export const TYPE_LABEL: Record<MethodType, string> = {
  especes: 'Espèces', caisse_business: 'Caisse business', carte: 'Carte bancaire', mvola: 'MVola', orange_money: 'Orange Money', airtel_money: 'Airtel Money',
}
/** « BNI perso ••4521 » pour une carte, sinon le nom seul. */
export const methodLabel = (m: PaymentMethod | undefined | null) => (m ? (m.type === 'carte' && m.last4 ? `${m.name} ••${m.last4}` : m.name) : '')

/** Montant en grand, saisi avec séparateurs de milliers. */
export function AmountField({ value, onChange, tone = 'ink', autoFocus, label = 'Montant' }: { value: string; onChange: (v: string) => void; tone?: 'ink' | 'green'; autoFocus?: boolean; label?: string }) {
  const { cur } = useData()
  return (
    <div className="flex items-baseline justify-center gap-2 rounded-3xl bg-sun-50 py-5">
      <input autoFocus={autoFocus} inputMode="numeric" placeholder="0" value={value} aria-label={label}
        onChange={(e) => { const n = parseAmount(e.target.value); onChange(n ? n.toLocaleString('fr-FR') : '') }}
        style={{ width: `${Math.max(2, value.length + 1)}ch` }}
        className={`tabular max-w-[75%] bg-transparent text-right text-[2.5rem] font-semibold outline-none placeholder:text-neutral-300 ${tone === 'green' ? 'text-emerald-600' : 'text-ink'}`} />
      <span className="text-2xl font-medium text-ink-muted">{cur}</span>
    </div>
  )
}

/** Petit champ montant (lignes de vente, frais…). */
export function SmallAmount({ id, value, onChange, placeholder = '0', className = '' }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <input id={id} inputMode="numeric" className="input tabular py-3 pr-11" placeholder={placeholder} value={value}
        onChange={(e) => { const n = parseAmount(e.target.value); onChange(n ? n.toLocaleString('fr-FR') : '') }} />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">Ar</span>
    </div>
  )
}

/** Choix d'un moyen de paiement (cartes affichées avec leurs 4 derniers chiffres). */
export function MethodChips({ value, onChange, types, label }: { value: string | null; onChange: (id: string) => void; types?: MethodType[]; label?: string }) {
  const { methods } = useData()
  const list = methods.filter((m) => (m.is_active || m.id === value) && (!types || types.includes(m.type)))
  return (
    <div>
      {label && <p className="section-title mb-2 text-base">{label}</p>}
      {list.length === 0 ? <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm text-ink-soft">Aucun moyen de paiement de ce type. Ajoute-le dans Compte › Cartes et moyens de paiement.</p> : (
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {list.map((m) => (
            <button key={m.id} type="button" onClick={() => onChange(m.id)} className={`${chip(value === m.id)} flex items-center gap-2`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color ?? '#999' }} />{methodLabel(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Premier moyen actif d'un type donné (ex. « Caisse business »). */
export function useMethodOf() {
  const { methods } = useData()
  return (t: MethodType) => methods.find((m) => m.is_active && m.type === t)?.id ?? null
}

export type ContactSel = { id: string | null; name: string; phone?: string }
export const NO_CONTACT: ContactSel = { id: null, name: '' }

/** Choix d'une personne existante, ou saisie d'un nouveau nom (créé à l'enregistrement). */
export function ContactField({ value, onChange, label = 'Personne', optional }: { value: ContactSel; onChange: (v: ContactSel) => void; label?: string; optional?: boolean }) {
  const { contacts } = useData()
  const [q, setQ] = useState(value.id ? '' : value.name)
  const [phone, setPhone] = useState('')
  const sel = value.id ? contacts.find((c) => c.id === value.id) : null
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? contacts.filter((c) => `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(s)) : contacts).slice(0, 8)
  }, [contacts, q])
  const exact = contacts.some((c) => c.name.trim().toLowerCase() === q.trim().toLowerCase())

  if (sel) return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-3 rounded-2xl border border-sun-500 bg-sun-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{sel.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{sel.name}</span>{sel.phone && <span className="tabular block text-xs text-ink-muted">{sel.phone}</span>}</span>
        <button type="button" onClick={() => { onChange(NO_CONTACT); setQ('') }} className="text-sm text-[#4A56E2]">Changer</button>
      </div>
    </div>
  )
  return (
    <div>
      <label className="label" htmlFor="contact-q">{label}{optional && <span className="text-xs"> (facultatif)</span>}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 focus-within:border-sun-500">
        <Search size={18} className="shrink-0 text-ink-muted" />
        <input id="contact-q" className="w-full bg-transparent py-3.5 outline-none" placeholder="Nom de la personne" autoComplete="off" value={q}
          onChange={(e) => { setQ(e.target.value); onChange({ id: null, name: e.target.value, phone }) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {hits.map((c) => <button key={c.id} type="button" onClick={() => { onChange({ id: c.id, name: c.name }); setQ('') }} className={chip(false)}>{c.name}</button>)}
      </div>
      {q.trim() && !exact && (
        <div className="mt-2 space-y-2 rounded-2xl border border-dashed border-ink/25 p-3">
          <p className="flex items-center gap-2 text-sm"><UserPlus size={16} /> Nouvelle personne : <b>{q.trim()}</b></p>
          <input className="input tabular py-2.5" inputMode="tel" placeholder="Téléphone (facultatif, pour WhatsApp)" value={phone}
            onChange={(e) => { setPhone(e.target.value); onChange({ id: null, name: q, phone: e.target.value }) }} />
        </div>
      )}
    </div>
  )
}

/** Renvoie l'identifiant de la personne, en la créant si c'est un nouveau nom. */
export async function ensureContact(sel: ContactSel): Promise<string | null> {
  if (sel.id) return sel.id
  const name = sel.name.trim()
  if (!name) return null
  const { data, error } = await supabase.from('contacts').insert({ name, phone: sel.phone?.trim() || null }).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export function ErrorBox({ msg }: { msg: string }) {
  return msg ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{msg}</p> : null
}

/** Boutons du bas : supprimer (avec confirmation) + enregistrer. */
export function FormActions({ busy, onSave, onDelete, saveLabel = 'Enregistrer' }: { busy: boolean; onSave: () => void; onDelete?: () => Promise<void> | void; saveLabel?: ReactNode }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex gap-2">
      {onDelete && (
        <button type="button" disabled={busy} onClick={() => (confirm ? onDelete() : setConfirm(true))} aria-label="Supprimer"
          className={`btn ${confirm ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><Trash2 size={18} />{confirm && 'Confirmer'}</button>
      )}
      <button type="button" onClick={onSave} disabled={busy} className="btn-primary flex-1 text-lg">{busy ? 'Enregistrement…' : <><Check size={20} /> {saveLabel}</>}</button>
    </div>
  )
}

/** Lien WhatsApp vers un numéro malgache (034 12 345 67 → 26134…). */
export function waLink(phone: string | null | undefined, text: string) {
  let d = (phone ?? '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '261' + d.slice(1)
  else if (d.length === 9) d = '261' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}
