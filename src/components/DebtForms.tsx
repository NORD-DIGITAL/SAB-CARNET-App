import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import type { DebtOwed, DebtOwedRepayment, LoanGiven, LoanRepayment } from '../lib/types'
import { Sheet } from './ui'
import { DateField } from './DatePicker'
import { AmountField, ContactField, ErrorBox, FormActions, MethodChips, NO_CONTACT, chip, ensureContact, useMethodOf } from './forms'
import type { ContactSel } from './forms'

const amountStr = (n: number) => (n ? n.toLocaleString('fr-FR') : '')

/* =====================================================================
   Nouvelle dette (« Je dois ») ou nouveau prêt (« On me doit »)
   ===================================================================== */
type Kind = 'je_dois' | 'on_me_doit'
const CFG = {
  je_dois: { table: 'debts_owed', date: 'borrowed_on', method: 'received_via_id', title: 'Nouvel emprunt', edit: "Modifier l'emprunt", who: 'Prêté par', money: "L'argent reçu dans", def: 'especes' as const },
  on_me_doit: { table: 'loans_given', date: 'lent_on', method: 'paid_via_id', title: "Prêt d'argent", edit: 'Modifier le prêt', who: 'Prêté à', money: "L'argent est sorti de", def: 'banque' as const },
}

export function DebtForm({ open, onClose, kind, item, presetContact }: { open: boolean; onClose: () => void; kind: Kind; item: DebtOwed | LoanGiven | null; presetContact?: string | null }) {
  const { reload, contactById } = useData()
  const methodOf = useMethodOf()
  const c = CFG[kind]
  const [who, setWho] = useState<ContactSel>(NO_CONTACT)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [noMoney, setNoMoney] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [due, setDue] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    const cid = item?.contact_id ?? presetContact ?? null
    setWho(cid ? { id: cid, name: contactById.get(cid)?.name ?? '' } : NO_CONTACT)
    setAmount(amountStr(item?.amount ?? 0))
    const m = item ? ((item as DebtOwed).received_via_id ?? (item as LoanGiven).paid_via_id ?? null) : methodOf(c.def) ?? methodOf('especes')
    setMethodId(m); setNoMoney(!!item && !m)
    setDate(item ? ((item as DebtOwed).borrowed_on ?? (item as LoanGiven).lent_on) : todayISO())
    setDue(item?.due_date ?? ''); setReason(item?.reason ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!who.id && !who.name.trim()) return setErr('Indique la personne.')
    if (!amt) return setErr('Indique un montant.')
    setBusy(true); setErr('')
    try {
      const contactId = await ensureContact(who)
      const row = { contact_id: contactId, amount: amt, [c.date]: date, [c.method]: noMoney ? null : methodId, due_date: due || null, reason: reason.trim() || null }
      const { error } = item ? await supabase.from(c.table).update(row).eq('id', item.id) : await supabase.from(c.table).insert(row)
      if (error) throw error
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr((e as { message?: string }).message ?? 'Enregistrement impossible.') }
  }
  const remove = async () => { setBusy(true); await supabase.from(c.table).delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? c.edit : c.title}>
      <div className="space-y-5">
        <ContactField label={c.who} value={who} onChange={setWho} />
        <AmountField value={amount} onChange={setAmount} />
        {!noMoney && <MethodChips label={c.money} value={methodId} onChange={setMethodId} />}
        <label className="flex items-center gap-3 text-sm text-ink-soft">
          <input type="checkbox" className="h-5 w-5 accent-ink" checked={noMoney} onChange={(e) => setNoMoney(e.target.checked)} />
          {kind === 'je_dois' ? "Pas d'argent reçu (ex : marchandise à crédit)" : "Pas d'argent sorti de mes caisses"}
        </label>
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="dt-date">Date</label>
          <DateField id="dt-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="dt-due">À rendre le</label>
          <DateField id="dt-due" value={due} onChange={setDue} clearable placeholder="Pas de date" className="py-3" />
          <label className="label mb-0" htmlFor="dt-reason">Motif</label>
          <input id="dt-reason" className="input py-3" placeholder="Facultatif" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Remboursement : je rembourse une dette, ou on me rembourse un prêt
   ===================================================================== */
export function RepayForm({ open, onClose, kind, parent, item }: {
  open: boolean; onClose: () => void; kind: Kind; parent: DebtOwed | LoanGiven | null; item: DebtOwedRepayment | LoanRepayment | null
}) {
  const { reload, debtState, loanState, contactById, cur } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const st = parent ? (kind === 'je_dois' ? debtState : loanState).get(parent.id) : undefined
  const maxAmt = (st?.remaining ?? 0) + (item?.amount ?? 0)
  const table = kind === 'je_dois' ? 'debts_owed_repayments' : 'loans_given_repayments'
  const dateCol = kind === 'je_dois' ? 'paid_on' : 'received_on'
  const fk = kind === 'je_dois' ? 'debt_id' : 'loan_id'

  useEffect(() => {
    if (!open) return
    setErr(''); setAmount(amountStr(item?.amount ?? 0)); setMethodId(item?.payment_method_id ?? (kind === 'on_me_doit' ? methodOf('banque') : null) ?? methodOf('especes'))
    setDate(item ? ((item as DebtOwedRepayment).paid_on ?? (item as LoanRepayment).received_on) : todayISO()); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (amt > maxAmt) return setErr(`Il ne reste que ${fmt(maxAmt, cur)} à rembourser.`)
    if (!methodId) return setErr(kind === 'je_dois' ? 'Choisis avec quoi tu rembourses.' : "Choisis où l'argent est rangé.")
    setBusy(true); setErr('')
    const row = { [fk]: parent!.id, amount: amt, payment_method_id: methodId, [dateCol]: date, note: note.trim() || null }
    const { error } = item ? await supabase.from(table).update(row).eq('id', item.id) : await supabase.from(table).insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from(table).delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }
  const name = parent ? contactById.get(parent.contact_id)?.name : ''

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le remboursement' : kind === 'je_dois' ? `Je rembourse ${name}` : `${name} me rembourse`}>
      <div className="space-y-5">
        {st && <p className="rounded-2xl bg-cream-tile px-4 py-3 text-sm">Reste : <b className="tabular">{fmt(maxAmt, cur)}</b> sur {fmt(parent!.amount, cur)}</p>}
        <AmountField value={amount} onChange={setAmount} tone={kind === 'on_me_doit' ? 'green' : 'ink'} autoFocus={!item} />
        {!item && maxAmt > 0 && <button type="button" onClick={() => setAmount(amountStr(maxAmt))} className={chip(parseAmount(amount) === maxAmt)}>Tout le reste ({fmt(maxAmt, cur)})</button>}
        <MethodChips label={kind === 'je_dois' ? 'Payé avec' : 'Reçu dans'} value={methodId} onChange={setMethodId} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="rp-date">Date</label>
          <DateField id="rp-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="rp-note">Note</label>
          <input id="rp-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
