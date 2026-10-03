import { useEffect, useState } from 'react'
import { ChevronRight, HandCoins, HandHeart, MessageCircle, Pencil, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import type { DebtOwed, LoanGiven } from '../lib/types'
import { Sheet } from './ui'
import { fmtDateLong } from './DatePicker'
import { ErrorBox, waLink } from './forms'
import { useForms } from './FormHost'
import { StatusBadge } from './SaleDetail'

/** Fiche d'une personne : ce qu'elle me doit (ventes, prêts) et ce que je lui dois. */
export function ContactSheet({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const forms = useForms()
  const d = useData()
  const { contactById, sales, saleState, saleItems, productById, loans, loanState, loanRepayments, debts, debtState, debtRepayments, cur, reload } = d
  const c = contactById.get(id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const [showDone, setShowDone] = useState(false)
  useEffect(() => { if (c) { setName(c.name); setPhone(c.phone ?? '') } }, [c])
  if (!c) return null

  const mySales = sales.filter((s) => s.contact_id === id)
  const myLoans = loans.filter((l) => l.contact_id === id)
  const myDebts = debts.filter((x) => x.contact_id === id)
  const owesMe = mySales.reduce((a, s) => a + Math.max(0, saleState.get(s.id)!.remaining), 0) + myLoans.reduce((a, l) => a + Math.max(0, loanState.get(l.id)!.remaining), 0)
  const iOwe = myDebts.reduce((a, x) => a + Math.max(0, debtState.get(x.id)!.remaining), 0)
  const late = mySales.some((s) => saleState.get(s.id)!.status === 'en_retard') || myLoans.some((l) => loanState.get(l.id)!.status === 'en_retard')
  const isOpen = (r: number) => r > 0
  const doneCount = mySales.filter((s) => !isOpen(saleState.get(s.id)!.remaining)).length + myLoans.filter((l) => !isOpen(loanState.get(l.id)!.remaining)).length + myDebts.filter((x) => !isOpen(debtState.get(x.id)!.remaining)).length

  const saveContact = async () => {
    if (!name.trim()) return setErr('Le nom est obligatoire.')
    const { error } = await supabase.from('contacts').update({ name: name.trim(), phone: phone.trim() || null }).eq('id', id)
    if (error) return setErr(error.message)
    setEditing(false); setErr(''); await reload()
  }
  const msg = `Bonjour ${c.name.split(' ')[0]} 👋\nPetit rappel : il reste ${fmt(owesMe, cur)} à me régler.\nMerci beaucoup !`

  const LoanRow = ({ l, kind }: { l: LoanGiven | DebtOwed; kind: 'on_me_doit' | 'je_dois' }) => {
    const st = (kind === 'on_me_doit' ? loanState : debtState).get(l.id)!
    const reps = (kind === 'on_me_doit' ? loanRepayments.filter((r) => r.loan_id === l.id) : debtRepayments.filter((r) => r.debt_id === l.id))
    const date = kind === 'on_me_doit' ? (l as LoanGiven).lent_on : (l as DebtOwed).borrowed_on
    return (
      <div className="rounded-2xl border border-cream-line bg-cream-tile p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{kind === 'on_me_doit' ? 'Prêt' : 'Emprunt'} de {fmt(l.amount, cur)}</p>
            <p className="text-xs text-ink-muted">{fmtDateLong(date)}{l.due_date ? ` · à rendre le ${fmtDateLong(l.due_date)}` : ''}{l.reason ? ` · ${l.reason}` : ''}</p>
          </div>
          <StatusBadge s={st.status} />
        </div>
        {reps.map((r) => (
          <button key={r.id} onClick={() => forms.open({ f: 'repay', kind, parent: l, item: r })} className="mt-1 flex w-full justify-between text-left text-xs text-ink-soft">
            <span>↳ remboursé le {fmtDateLong('paid_on' in r ? r.paid_on : r.received_on)}</span><span className="tabular">{fmt(r.amount, cur)}</span>
          </button>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <span className="tabular flex-1 text-sm">Reste <b>{fmt(Math.max(0, st.remaining), cur)}</b></span>
          <button onClick={() => forms.open({ f: 'debt', kind, item: l })} aria-label="Modifier" className="rounded-full p-2 text-ink-muted"><Pencil size={16} /></button>
          {st.remaining > 0 && <button onClick={() => forms.open({ f: 'repay', kind, parent: l })} className="btn-dark px-4 py-2 text-sm">{kind === 'on_me_doit' ? 'Il/elle rembourse' : 'Je rembourse'}</button>}
        </div>
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="space-y-5">
        {editing ? (
          <div className="space-y-3">
            <input className="input" aria-label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input tabular" aria-label="Téléphone" inputMode="tel" placeholder="Téléphone (ex : 034 12 345 67)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <ErrorBox msg={err} />
            <div className="flex gap-2"><button onClick={() => setEditing(false)} className="btn-ghost flex-1">Annuler</button><button onClick={saveContact} className="btn-primary flex-1">Enregistrer</button></div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">{c.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-semibold">{c.name}</p>
              {c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="tabular flex items-center gap-1 text-sm text-[#4A56E2]"><Phone size={14} /> {c.phone}</a> : <p className="text-sm text-ink-muted">Pas de téléphone</p>}
            </div>
            <button onClick={() => setEditing(true)} aria-label="Modifier la personne" className="rounded-full p-2.5 hover:bg-cream-tile"><Pencil size={20} /></button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-2xl p-3 ${late ? 'bg-red-50' : 'bg-emerald-50'}`}><p className={`text-xs ${late ? 'text-red-700' : 'text-emerald-700'}`}>Me doit{late ? ' · retard' : ''}</p><p className="tabular text-lg font-semibold">{fmt(owesMe, cur)}</p></div>
          <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Je lui dois</p><p className="tabular text-lg font-semibold">{fmt(iOwe, cur)}</p></div>
        </div>
        {owesMe > 0 && c.phone && <a href={waLink(c.phone, msg)} target="_blank" rel="noopener" className="btn-dark w-full"><MessageCircle size={20} /> Envoyer un rappel WhatsApp</a>}

        <section className="space-y-2">
          <h3 className="font-semibold">Achats à crédit</h3>
          {mySales.filter((s) => showDone || isOpen(saleState.get(s.id)!.remaining)).map((s) => {
            const st = saleState.get(s.id)!
            const what = saleItems.filter((i) => i.sale_id === s.id).map((i) => productById.get(i.product_id)?.name).filter(Boolean).join(', ')
            return (
              <button key={s.id} onClick={() => forms.open({ f: 'saleDetail', id: s.id })} className="flex w-full items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile p-3 text-left">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{what || 'Vente'}</span><span className="block text-xs text-ink-muted">{fmtDateLong(s.sold_on)} · reste {fmt(Math.max(0, st.remaining), cur)}</span></span>
                <StatusBadge s={st.status} /><ChevronRight size={18} className="text-neutral-400" />
              </button>
            )
          })}
          {!mySales.length && <p className="text-sm text-ink-muted">Aucune vente.</p>}
        </section>

        {(myLoans.length > 0 || myDebts.length > 0) && (
          <section className="space-y-2">
            <h3 className="font-semibold">Prêts et emprunts</h3>
            {myLoans.filter((l) => showDone || isOpen(loanState.get(l.id)!.remaining)).map((l) => <LoanRow key={l.id} l={l} kind="on_me_doit" />)}
            {myDebts.filter((x) => showDone || isOpen(debtState.get(x.id)!.remaining)).map((x) => <LoanRow key={x.id} l={x} kind="je_dois" />)}
          </section>
        )}
        {doneCount > 0 && <button onClick={() => setShowDone(!showDone)} className="w-full py-1 text-sm text-ink-muted">{showDone ? 'Masquer' : 'Afficher'} les {doneCount} réglé{doneCount > 1 ? 's' : ''}</button>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => forms.open({ f: 'debt', kind: 'on_me_doit', contact: id })} className="btn-ghost text-sm"><HandHeart size={18} /> Je lui prête</button>
          <button onClick={() => forms.open({ f: 'debt', kind: 'je_dois', contact: id })} className="btn-ghost text-sm"><HandCoins size={18} /> Il/elle me prête</button>
        </div>
      </div>
    </Sheet>
  )
}
