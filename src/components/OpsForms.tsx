import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import type { Expense, Transfer, Withdrawal } from '../lib/types'
import { BareIcon, Segmented, Sheet } from './ui'
import { DateField } from './DatePicker'
import { AmountField, ErrorBox, FormActions, MethodChips, SmallAmount, methodLabel, useMethodOf } from './forms'

const amountStr = (n: number) => (n ? n.toLocaleString('fr-FR') : '')

/* =====================================================================
   Dépense perso
   ===================================================================== */
export function ExpenseForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: Expense | null }) {
  const { categories, methodById, reload } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState<string | null>(null)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [cardOp, setCardOp] = useState<'tpe' | 'en_ligne'>('tpe')
  const [date, setDate] = useState(todayISO())
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setAmount(amountStr(item?.amount ?? 0)); setCatId(item?.category_id ?? null)
    setMethodId(item ? item.payment_method_id : methodOf('especes')); setCardOp(item?.card_operation ?? 'tpe')
    setDate(item?.spent_on ?? todayISO()); setLabel(item?.label ?? item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const isCard = methodById.get(methodId ?? '')?.type === 'carte'
  const tiles = categories.filter((c) => c.module !== 'frais_bancaires' || c.id === catId)

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (!methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    const row = { amount: amt, category_id: catId, payment_method_id: methodId, card_operation: isCard ? cardOp : null, spent_on: date, label: label.trim() || null }
    const { error } = item ? await supabase.from('expenses').update(row).eq('id', item.id) : await supabase.from('expenses').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('expenses').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier la dépense' : 'Nouvelle dépense'}>
      <div className="space-y-5">
        <AmountField value={amount} onChange={setAmount} autoFocus={!item} />
        <div>
          <p className="section-title mb-3 text-base">Catégorie</p>
          <div className="grid grid-cols-3 gap-2.5">
            {tiles.map((c) => (
              <button key={c.id} type="button" onClick={() => setCatId(c.id)}
                className={`flex h-[5.5rem] flex-col justify-between rounded-2xl border p-2.5 text-left transition ${catId === c.id ? 'border-sun-500 bg-sun-100' : 'border-cream-line bg-cream-tile'}`}>
                <BareIcon name={c.name} emoji={c.icon ?? undefined} size={26} />
                <span className="line-clamp-2 text-[0.75rem] leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
        <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />
        {isCard && <Segmented value={cardOp} onChange={setCardOp} options={[['tpe', 'Paiement TPE'], ['en_ligne', 'En ligne']]} />}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="ex-date">Date</label>
          <DateField id="ex-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="ex-label">Note</label>
          <input id="ex-label" className="input py-3" placeholder="Ex : marché d'Analakely" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Retrait au distributeur : carte -> espèces perso ou caisse business
   ===================================================================== */
export function WithdrawalForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: Withdrawal | null }) {
  const { categories, methods, reload, cur } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [fees, setFees] = useState('')
  const [cardId, setCardId] = useState<string | null>(null)
  const [destId, setDestId] = useState<string | null>(null)
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setAmount(amountStr(item?.amount ?? 0)); setFees(amountStr(item?.fees ?? 0))
    setCardId(item?.card_id ?? methods.find((m) => m.is_active && m.type === 'carte')?.id ?? null)
    setDestId(item?.dest_method_id ?? methodOf('especes')); setPlace(item?.place ?? ''); setDate(item?.withdrawn_on ?? todayISO())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount), fee = parseAmount(fees)
    if (!cardId) return setErr('Choisis la carte utilisée.')
    if (!amt) return setErr('Indique le montant retiré.')
    if (!destId) return setErr("Choisis où va l'argent.")
    setBusy(true); setErr('')
    try {
      // Les frais de retrait sont une vraie dépense (catégorie « Frais bancaires », payée par la carte)
      let feeId = item?.fee_expense_id ?? null
      const feeRow = { amount: fee, spent_on: date, payment_method_id: cardId, source: 'frais_retrait', label: 'Frais de retrait',
        category_id: categories.find((c) => c.module === 'frais_bancaires')?.id ?? null }
      if (fee > 0 && feeId) { const { error } = await supabase.from('expenses').update(feeRow).eq('id', feeId); if (error) throw error }
      else if (fee > 0) { const { data, error } = await supabase.from('expenses').insert(feeRow).select('id').single(); if (error) throw error; feeId = (data as { id: string }).id }
      const row = { card_id: cardId, dest_method_id: destId, amount: amt, fees: fee, fee_expense_id: fee > 0 ? feeId : null, withdrawn_on: date, place: place.trim() || null }
      const { error } = item ? await supabase.from('cash_withdrawals').update(row).eq('id', item.id) : await supabase.from('cash_withdrawals').insert(row)
      if (error) throw error
      if (fee === 0 && item?.fee_expense_id) await supabase.from('expenses').delete().eq('id', item.fee_expense_id)
      await reload(); onClose()
    } catch (e) { setErr((e as { message?: string }).message ?? 'Enregistrement impossible.') }
    setBusy(false)
  }
  const remove = async () => {
    setBusy(true)
    await supabase.from('cash_withdrawals').delete().eq('id', item!.id)
    if (item!.fee_expense_id) await supabase.from('expenses').delete().eq('id', item!.fee_expense_id)
    setBusy(false); await reload(); onClose()
  }
  const total = parseAmount(amount) + parseAmount(fees)

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le retrait' : 'Retrait au distributeur'}>
      <div className="space-y-5">
        <MethodChips label="Carte utilisée" value={cardId} onChange={setCardId} types={['carte']} />
        <AmountField value={amount} onChange={setAmount} label="Montant retiré" autoFocus={!item} />
        <div>
          <label className="label" htmlFor="wd-fees">Frais de retrait <span className="text-xs">(facultatif)</span></label>
          <SmallAmount id="wd-fees" value={fees} onChange={setFees} />
          {parseAmount(fees) > 0 && <p className="mt-1.5 text-xs text-ink-muted">Débité sur la carte au total : <b className="tabular">{fmt(total, cur)}</b>. Les frais sont comptés comme une dépense.</p>}
        </div>
        <MethodChips label="L'argent va dans" value={destId} onChange={setDestId} types={['especes', 'caisse_business']} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="wd-place">Lieu</label>
          <input id="wd-place" className="input py-3" placeholder="Ex : DAB BOA Analakely" value={place} onChange={(e) => setPlace(e.target.value)} />
          <label className="label mb-0" htmlFor="wd-date">Date</label>
          <DateField id="wd-date" value={date} onChange={setDate} className="py-3" />
        </div>
        <p className="rounded-2xl bg-sun-50 px-4 py-3 text-xs text-ink-soft">Un retrait n'est pas une dépense : l'argent passe de la carte à tes espèces. Tes dépenses en espèces sont notées ensuite.</p>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Virement interne : espèces perso <-> caisse business, MVola -> espèces…
   ===================================================================== */
export function TransferForm({ open, onClose, item, preset }: { open: boolean; onClose: () => void; item: Transfer | null; preset?: { from?: string; to?: string } }) {
  const { methodById, reload } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setAmount(amountStr(item?.amount ?? 0))
    setFromId(item?.from_method_id ?? preset?.from ?? methodOf('caisse_business')); setToId(item?.to_method_id ?? preset?.to ?? methodOf('especes'))
    setDate(item?.transfer_on ?? todayISO()); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (!fromId || !toId) return setErr("Choisis d'où vient l'argent et où il va.")
    if (fromId === toId) return setErr('Le départ et l\'arrivée doivent être différents.')
    setBusy(true); setErr('')
    const row = { from_method_id: fromId, to_method_id: toId, amount: amt, transfer_on: date, note: note.trim() || null }
    const { error } = item ? await supabase.from('transfers').update(row).eq('id', item.id) : await supabase.from('transfers').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('transfers').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le virement' : 'Virement entre caisses'}>
      <div className="space-y-5">
        <AmountField value={amount} onChange={setAmount} autoFocus={!item} />
        <MethodChips label="De" value={fromId} onChange={setFromId} />
        <MethodChips label="Vers" value={toId} onChange={setToId} />
        {fromId && toId && fromId !== toId && (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-cream-tile px-4 py-3 text-sm">
            <b>{methodLabel(methodById.get(fromId))}</b><ArrowRight size={16} /><b>{methodLabel(methodById.get(toId))}</b>
          </p>
        )}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="tr-date">Date</label>
          <DateField id="tr-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="tr-note">Note</label>
          <input id="tr-note" className="input py-3" placeholder="Ex : je me verse ma part du mois" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
