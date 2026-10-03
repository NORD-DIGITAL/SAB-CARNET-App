import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Pencil, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import type { Investment, InvestmentFlow } from '../lib/types'
import { Segmented, Sheet } from './ui'
import { DateField, fmtDateLong } from './DatePicker'
import { AmountField, ContactField, ErrorBox, FormActions, MethodChips, NO_CONTACT, SmallAmount, chip, ensureContact, methodLabel, useMethodOf } from './forms'
import type { ContactSel } from './forms'
import { useForms } from './FormHost'

export const PRO_ACTIVITIES = ['Coiffure', 'Boutique', 'Restauration', 'Transport', 'Couture', 'Élevage', 'Autre']
const amountStr = (n: number) => (n ? n.toLocaleString('fr-FR') : '')
const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Enregistrement impossible.'
export const AGREEMENT: Record<Investment['agreement_type'], string> = { pret_remboursable: 'Prêt remboursable', part_benefices: 'Part des bénéfices' }
export const INV_STATUS: Record<Investment['status'], [string, string]> = {
  actif: ['Actif', 'bg-emerald-100 text-emerald-800'], termine: ['Terminé', 'bg-neutral-100 text-ink-muted'], litige: ['Litige', 'bg-red-100 text-red-700'],
}

/* =====================================================================
   Nouvelle collaboration / investissement
   ===================================================================== */
export function InvestmentForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: Investment | null }) {
  const { reload, contactById } = useData()
  const methodOf = useMethodOf()
  const [partner, setPartner] = useState<ContactSel>(NO_CONTACT)
  const [name, setName] = useState('')
  const [activity, setActivity] = useState(PRO_ACTIVITIES[0])
  const [type, setType] = useState<Investment['agreement_type']>('part_benefices')
  const [share, setShare] = useState('')
  const [expected, setExpected] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [start, setStart] = useState(todayISO())
  const [status, setStatus] = useState<Investment['status']>('actif')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setPartner(item ? { id: item.contact_id, name: contactById.get(item.contact_id)?.name ?? '' } : NO_CONTACT)
    setName(item?.project_name ?? ''); setActivity(item?.activity ?? PRO_ACTIVITIES[0]); setType(item?.agreement_type ?? 'part_benefices')
    setShare(item?.share_pct != null ? String(item.share_pct) : ''); setExpected(amountStr(item?.expected_return ?? 0))
    setAmount(''); setMethodId(methodOf('banque') ?? methodOf('especes')); setStart(item?.start_date ?? todayISO()); setStatus(item?.status ?? 'actif'); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    if (!partner.id && !partner.name.trim()) return setErr('Indique le partenaire.')
    if (!name.trim()) return setErr('Donne un nom au projet (ex : Salon de coiffure de Tiana).')
    const amt = parseAmount(amount)
    if (!item && amt > 0 && !methodId) return setErr("Choisis d'où sort l'argent.")
    setBusy(true); setErr('')
    try {
      const contactId = await ensureContact(partner)
      const sh = Number(share.replace(',', '.'))
      const row = {
        contact_id: contactId, project_name: name.trim(), activity, agreement_type: type,
        share_pct: type === 'part_benefices' && share ? Math.min(100, Math.max(0, sh)) : null,
        expected_return: type === 'pret_remboursable' ? parseAmount(expected) || null : null,
        start_date: start, status, note: note.trim() || null,
      }
      if (item) { const { error } = await supabase.from('investments').update(row).eq('id', item.id); if (error) throw error }
      else {
        const { data, error } = await supabase.from('investments').insert(row).select('id').single(); if (error) throw error
        if (amt > 0) { const r = await supabase.from('investment_flows').insert({ investment_id: (data as { id: string }).id, kind: 'apport', amount: amt, flow_on: start, payment_method_id: methodId }); if (r.error) throw r.error }
      }
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr(errMsg(e)) }
  }
  const remove = async () => { setBusy(true); await supabase.from('investments').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier la collaboration' : 'Nouvelle collaboration'}>
      <div className="space-y-5">
        <ContactField label="Partenaire" value={partner} onChange={setPartner} />
        <div><label className="label" htmlFor="iv-name">Projet</label><input id="iv-name" className="input" placeholder="Ex : Salon de coiffure de Tiana" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><p className="label">Activité</p><div className="flex flex-wrap gap-2">{PRO_ACTIVITIES.map((a) => <button key={a} type="button" onClick={() => setActivity(a)} className={chip(activity === a)}>{a}</button>)}</div></div>
        <Segmented value={type} onChange={setType} options={[['part_benefices', 'Part des bénéfices'], ['pret_remboursable', 'Prêt remboursable']]} />
        {type === 'part_benefices' ? (
          <div><label className="label" htmlFor="iv-share">Ma part des bénéfices (%)</label><input id="iv-share" inputMode="decimal" className="input tabular" placeholder="Ex : 30" value={share} onChange={(e) => setShare(e.target.value.replace(/[^\d.,]/g, ''))} /></div>
        ) : (
          <div><label className="label" htmlFor="iv-exp">Montant à récupérer au total</label><SmallAmount id="iv-exp" value={expected} onChange={setExpected} /></div>
        )}
        {!item && (
          <div className="space-y-3 rounded-2xl border border-cream-line bg-cream-tile p-4">
            <div><label className="label" htmlFor="iv-amt">Apport de départ <span className="text-xs">(facultatif)</span></label><SmallAmount id="iv-amt" value={amount} onChange={setAmount} /></div>
            {parseAmount(amount) > 0 && <MethodChips label="L'argent sort de" value={methodId} onChange={setMethodId} />}
          </div>
        )}
        {item && <div><p className="label">Statut</p><div className="flex gap-2">{(Object.keys(INV_STATUS) as Investment['status'][]).map((k) => <button key={k} type="button" onClick={() => setStatus(k)} className={chip(status === k)}>{INV_STATUS[k][0]}</button>)}</div></div>}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="iv-start">Début</label>
          <DateField id="iv-start" value={start} onChange={setStart} className="py-3" />
          <label className="label mb-0" htmlFor="iv-note">Note</label>
          <input id="iv-note" className="input py-3" placeholder="Accord, conditions…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Apport ou retour d'argent
   ===================================================================== */
export function FlowForm({ open, onClose, investment, item, kind: kind0 }: { open: boolean; onClose: () => void; investment: Investment; item: InvestmentFlow | null; kind?: 'apport' | 'retour' }) {
  const { reload } = useData()
  const methodOf = useMethodOf()
  const [kind, setKind] = useState<'apport' | 'retour'>('retour')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setKind(item?.kind ?? kind0 ?? 'retour'); setAmount(amountStr(item?.amount ?? 0))
    setMethodId(item?.payment_method_id ?? methodOf('banque') ?? methodOf('especes')); setDate(item?.flow_on ?? todayISO()); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (!methodId) return setErr(kind === 'apport' ? "Choisis d'où sort l'argent." : "Choisis où l'argent est rangé.")
    setBusy(true); setErr('')
    const row = { investment_id: investment.id, kind, amount: amt, payment_method_id: methodId, flow_on: date, note: note.trim() || null }
    const { error } = item ? await supabase.from('investment_flows').update(row).eq('id', item.id) : await supabase.from('investment_flows').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('investment_flows').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le mouvement' : investment.project_name}>
      <div className="space-y-5">
        <Segmented value={kind} onChange={setKind} options={[['retour', "Je récupère de l'argent"], ['apport', "J'apporte de l'argent"]]} />
        <AmountField value={amount} onChange={setAmount} tone={kind === 'retour' ? 'green' : 'ink'} autoFocus={!item} />
        <MethodChips label={kind === 'apport' ? "L'argent sort de" : 'Rangé dans'} value={methodId} onChange={setMethodId} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="fl-date">Date</label>
          <DateField id="fl-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="fl-note">Note</label>
          <input id="fl-note" className="input py-3" placeholder="Ex : bénéfices de septembre" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Fiche d'une collaboration : chiffres + historique
   ===================================================================== */
export function InvestmentDetail({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const forms = useForms()
  const { investments, flows, investState, contactById, methodById, cur } = useData()
  const inv = investments.find((i) => i.id === id)
  if (!inv) return null
  const st = investState.get(id)!
  const partner = contactById.get(inv.contact_id)
  const target = inv.agreement_type === 'pret_remboursable' ? inv.expected_return ?? st.invested : st.invested
  const pct = target ? Math.min(100, Math.round((st.returned / target) * 100)) : 0
  const list = flows.filter((f) => f.investment_id === id).sort((a, b) => (a.flow_on < b.flow_on ? 1 : -1))
  const [label, cls] = INV_STATUS[inv.status]

  return (
    <Sheet open={open} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{inv.project_name}</p>
            <p className="text-sm text-ink-muted">{[inv.activity, partner?.name, AGREEMENT[inv.agreement_type] + (inv.share_pct != null ? ` ${inv.share_pct} %` : '')].filter(Boolean).join(' · ')}</p>
            {partner?.phone && <a href={`tel:${partner.phone.replace(/\s/g, '')}`} className="tabular mt-1 flex items-center gap-1 text-sm text-[#4A56E2]"><Phone size={14} /> {partner.phone}</a>}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
          <button onClick={() => forms.open({ f: 'investment', item: inv })} aria-label="Modifier" className="rounded-full p-2 hover:bg-cream-tile"><Pencil size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Investi</p><p className="tabular text-sm font-semibold">{fmt(st.invested, cur)}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Récupéré</p><p className="tabular text-sm font-semibold">{fmt(st.returned, cur)}</p></div>
          <div className={`rounded-2xl p-3 ${st.result >= 0 ? 'bg-emerald-100' : 'bg-red-50'}`}><p className={`text-xs ${st.result >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{st.result >= 0 ? 'Gain' : 'Encore dehors'}</p><p className="tabular text-sm font-semibold">{fmt(Math.abs(st.result), cur)}</p></div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-ink-muted"><span>Récupéré {pct} %{inv.agreement_type === 'pret_remboursable' && inv.expected_return ? ` de ${fmt(inv.expected_return, cur)}` : ' de l\'investi'}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => forms.open({ f: 'flow', investment: inv, kind: 'retour' })} className="btn-primary text-sm"><ArrowDownLeft size={18} /> Je récupère</button>
          <button onClick={() => forms.open({ f: 'flow', investment: inv, kind: 'apport' })} className="btn-ghost text-sm"><ArrowUpRight size={18} /> J'apporte</button>
        </div>
        <section>
          <h3 className="mb-2 font-semibold">Historique</h3>
          {list.length === 0 && <p className="text-sm text-ink-muted">Aucun mouvement pour l'instant.</p>}
          <ol className="relative ml-2 border-l-2 border-cream-line">
            {list.map((f) => (
              <li key={f.id} className="relative pb-3 pl-5 last:pb-0">
                <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${f.kind === 'retour' ? 'bg-emerald-500' : 'bg-ink'}`} />
                <button onClick={() => forms.open({ f: 'flow', investment: inv, item: f })} className="flex w-full items-start justify-between gap-2 text-left">
                  <span className="min-w-0"><span className="block text-sm font-medium">{f.kind === 'retour' ? 'Retour reçu' : 'Apport'}</span>
                    <span className="block text-xs text-ink-muted">{[fmtDateLong(f.flow_on), methodLabel(methodById.get(f.payment_method_id ?? '')), f.note].filter(Boolean).join(' · ')}</span></span>
                  <span className={`tabular shrink-0 text-sm font-semibold ${f.kind === 'retour' ? 'text-emerald-700' : ''}`}>{f.kind === 'retour' ? '+' : '−'}{fmt(f.amount, cur)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        {inv.note && <p className="rounded-2xl bg-cream-tile px-4 py-3 text-sm text-ink-soft">{inv.note}</p>}
      </div>
    </Sheet>
  )
}
