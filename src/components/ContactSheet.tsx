import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, HandCoins, HandHeart, MessageCircle, Pencil, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import type { DebtOwed, LoanGiven, PersonCat } from '../lib/types'
import { Sheet } from './ui'
import { fmtDateLong } from './DatePicker'
import { ErrorBox, PersonBadge, PersonCatChips, methodLabel, waLink } from './forms'
import { useForms } from './FormHost'
import type { FormReq } from './FormHost'
import { StatusBadge } from './SaleDetail'
import { Bar } from './Tiles'

type Ev = { key: string; date: string; label: string; sub: string; delta: number; open: FormReq; kind: 'out' | 'in' }

/** Fiche d'une personne : totaux, dossiers en cours, historique complet avec solde. */
export function ContactSheet({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const forms = useForms()
  const d = useData()
  const { contactById, sales, saleState, saleItems, salePayments, productById, loans, loanState, loanRepayments, debts, debtState, debtRepayments, methodById, cur, reload } = d
  const c = contactById.get(id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cat, setCat] = useState<PersonCat>('autre')
  const [err, setErr] = useState('')
  useEffect(() => { if (c) { setName(c.name); setPhone(c.phone ?? ''); setCat(c.category ?? 'autre') } }, [c])

  const mySales = sales.filter((s) => s.contact_id === id)
  const myLoans = loans.filter((l) => l.contact_id === id)
  const myDebts = debts.filter((x) => x.contact_id === id)
  const what = (saleId: string) => saleItems.filter((i) => i.sale_id === saleId).map((i) => productById.get(i.product_id)?.name).filter(Boolean).join(', ')
  const m = (mid: string | null) => methodLabel(methodById.get(mid ?? ''))

  // Historique : + ce qu'elle me doit en plus, − ce qui le réduit (ou ce que je lui dois)
  const history = useMemo(() => {
    const ev: Ev[] = []
    for (const s of mySales) {
      ev.push({ key: `s${s.id}`, date: s.sold_on, label: `Achat à crédit : ${what(s.id) || 'vente'}`, sub: s.payment_mode === 'echelonne' ? `en ${s.installments_nb} fois` : 'comptant', delta: s.total_amount, open: { f: 'saleDetail', id: s.id }, kind: 'out' })
      for (const p of salePayments.filter((x) => x.sale_id === s.id))
        ev.push({ key: `p${p.id}`, date: p.paid_on, label: p.is_down_payment ? 'Acompte reçu' : 'Versement reçu', sub: [m(p.payment_method_id), p.note].filter(Boolean).join(' · '), delta: -p.amount, open: { f: 'salePayment', sale: s, item: p }, kind: 'in' })
    }
    for (const l of myLoans) {
      ev.push({ key: `l${l.id}`, date: l.lent_on, label: "Je lui prête de l'argent", sub: [m(l.paid_via_id), l.reason].filter(Boolean).join(' · '), delta: l.amount, open: { f: 'debt', kind: 'on_me_doit', item: l }, kind: 'out' })
      for (const r of loanRepayments.filter((x) => x.loan_id === l.id))
        ev.push({ key: `lr${r.id}`, date: r.received_on, label: 'Remboursement reçu', sub: [m(r.payment_method_id), r.note].filter(Boolean).join(' · '), delta: -r.amount, open: { f: 'repay', kind: 'on_me_doit', parent: l, item: r }, kind: 'in' })
    }
    for (const x of myDebts) {
      ev.push({ key: `d${x.id}`, date: x.borrowed_on, label: "Il/elle me prête de l'argent", sub: [m(x.received_via_id), x.reason].filter(Boolean).join(' · '), delta: -x.amount, open: { f: 'debt', kind: 'je_dois', item: x }, kind: 'in' })
      for (const r of debtRepayments.filter((y) => y.debt_id === x.id))
        ev.push({ key: `dr${r.id}`, date: r.paid_on, label: 'Je rembourse', sub: [m(r.payment_method_id), r.note].filter(Boolean).join(' · '), delta: r.amount, open: { f: 'repay', kind: 'je_dois', parent: x, item: r }, kind: 'out' })
    }
    ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.delta - a.delta))
    let bal = 0
    return ev.map((e) => { bal += e.delta; return { ...e, bal } }).reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySales, myLoans, myDebts, salePayments, loanRepayments, debtRepayments])

  if (!c) return null

  const openSales = mySales.filter((s) => saleState.get(s.id)!.remaining > 0)
  const openLoans = myLoans.filter((l) => loanState.get(l.id)!.remaining > 0)
  const openDebts = myDebts.filter((x) => debtState.get(x.id)!.remaining > 0)
  const principal = openSales.reduce((a, s) => a + s.total_amount, 0) + openLoans.reduce((a, l) => a + l.amount, 0)
  const owesMe = openSales.reduce((a, s) => a + saleState.get(s.id)!.remaining, 0) + openLoans.reduce((a, l) => a + loanState.get(l.id)!.remaining, 0)
  const iOwe = openDebts.reduce((a, x) => a + debtState.get(x.id)!.remaining, 0)
  const iOwePrincipal = openDebts.reduce((a, x) => a + x.amount, 0)
  const late = openSales.some((s) => saleState.get(s.id)!.status === 'en_retard') || openLoans.some((l) => loanState.get(l.id)!.status === 'en_retard')
  const pct = principal ? ((principal - owesMe) / principal) * 100 : 0

  const saveContact = async () => {
    if (!name.trim()) return setErr('Le nom est obligatoire.')
    const { error } = await supabase.from('contacts').update({ name: name.trim(), phone: phone.trim() || null, category: cat }).eq('id', id)
    if (error) return setErr(error.message)
    setEditing(false); setErr(''); await reload()
  }
  const msg = `Bonjour ${c.name.split(' ')[0]} 👋\nPetit rappel : il reste ${fmt(owesMe, cur)} à me régler.\nMerci beaucoup !`

  const LoanCard = ({ l, kind }: { l: LoanGiven | DebtOwed; kind: 'on_me_doit' | 'je_dois' }) => {
    const st = (kind === 'on_me_doit' ? loanState : debtState).get(l.id)!
    const date = kind === 'on_me_doit' ? (l as LoanGiven).lent_on : (l as DebtOwed).borrowed_on
    return (
      <div className="rounded-2xl border border-cream-line bg-cream-tile p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{kind === 'on_me_doit' ? 'Prêt' : 'Emprunt'} de {fmt(l.amount, cur)}</p>
            <p className="text-xs text-ink-muted">{fmtDateLong(date)}{l.due_date ? ` · à rendre le ${fmtDateLong(l.due_date)}` : ''}</p>
          </div>
          <StatusBadge s={st.status} />
        </div>
        <div className="mt-2"><Bar pct={(st.repaid / l.amount) * 100} color={kind === 'on_me_doit' ? 'bg-emerald-500' : 'bg-ink'} /></div>
        <div className="mt-2 flex items-center gap-2">
          <span className="tabular flex-1 text-sm">Reste <b>{fmt(Math.max(0, st.remaining), cur)}</b></span>
          <button onClick={() => forms.open({ f: 'debt', kind, item: l })} aria-label="Modifier" className="rounded-full p-2 text-ink-muted"><Pencil size={16} /></button>
          <button onClick={() => forms.open({ f: 'repay', kind, parent: l })} className="btn-dark px-4 py-2 text-sm">{kind === 'on_me_doit' ? 'Il/elle rembourse' : 'Je rembourse'}</button>
        </div>
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} wide>
      <div className="space-y-5">
        {editing ? (
          <div className="space-y-3">
            <input className="input" aria-label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input tabular" aria-label="Téléphone" inputMode="tel" placeholder="Téléphone (ex : 034 12 345 67)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <PersonCatChips value={cat} onChange={setCat} />
            <ErrorBox msg={err} />
            <div className="flex gap-2"><button onClick={() => setEditing(false)} className="btn-ghost flex-1">Annuler</button><button onClick={saveContact} className="btn-primary flex-1">Enregistrer</button></div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white ${late ? 'bg-red-500' : 'bg-ink'}`}>{c.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2"><span className="truncate text-xl font-semibold">{c.name}</span><PersonBadge k={c.category} /></p>
              {c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="tabular flex items-center gap-1 text-sm text-[#4A56E2]"><Phone size={14} /> {c.phone}</a> : <p className="text-sm text-ink-muted">Pas de téléphone</p>}
            </div>
            <button onClick={() => setEditing(true)} aria-label="Modifier la personne" className="rounded-full p-2.5 hover:bg-cream-tile"><Pencil size={20} /></button>
          </div>
        )}

        {/* Totaux du premier coup d'œil */}
        <div className={`rounded-2xl p-4 ${late ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <div className="flex items-end justify-between gap-3">
            <div><p className={`text-xs ${late ? 'text-red-700' : 'text-emerald-800'}`}>Me doit encore{late ? ' · en retard' : ''}</p><p className="tabular text-3xl font-bold">{fmt(owesMe, cur)}</p></div>
            <div className="text-right text-xs text-ink-soft"><p>Prêté / vendu <b className="tabular">{fmt(principal, cur)}</b></p><p>Remboursé <b className="tabular">{fmt(principal - owesMe, cur)}</b></p></div>
          </div>
          <div className="mt-3"><Bar pct={pct} color={late ? 'bg-red-500' : 'bg-emerald-500'} /></div>
          {iOwe > 0 && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm">Je lui dois <b className="tabular text-red-600">{fmt(iOwe, cur)}</b> <span className="text-ink-muted">sur {fmt(iOwePrincipal, cur)} emprunté</span></p>}
        </div>
        {owesMe > 0 && c.phone && <a href={waLink(c.phone, msg)} target="_blank" rel="noopener" className="btn-dark w-full"><MessageCircle size={20} /> Envoyer un rappel WhatsApp</a>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Dossiers en cours */}
          <section className="space-y-2">
            <h3 className="font-semibold">Dossiers en cours</h3>
            {openSales.length + openLoans.length + openDebts.length === 0 && <p className="text-sm text-ink-muted">Tout est réglé. 🎉</p>}
            {openSales.map((s) => {
              const st = saleState.get(s.id)!
              return (
                <button key={s.id} onClick={() => forms.open({ f: 'saleDetail', id: s.id })} className="block w-full rounded-2xl border border-cream-line bg-cream-tile p-3 text-left">
                  <span className="flex items-center gap-2"><span className="min-w-0 flex-1"><span className="block truncate font-medium">{what(s.id) || 'Vente'}</span><span className="block text-xs text-ink-muted">{fmtDateLong(s.sold_on)}{st.nextDue ? ` · prochaine le ${fmtDateLong(st.nextDue)}` : ''}</span></span>
                    <StatusBadge s={st.status} /><ChevronRight size={18} className="text-neutral-400" /></span>
                  <span className="mt-2 block"><Bar pct={(st.paid / s.total_amount) * 100} color={st.status === 'en_retard' ? 'bg-red-500' : 'bg-emerald-500'} /></span>
                  <span className="tabular mt-1 block text-sm">Reste <b>{fmt(st.remaining, cur)}</b> sur {fmt(s.total_amount, cur)}</span>
                </button>
              )
            })}
            {openLoans.map((l) => <LoanCard key={l.id} l={l} kind="on_me_doit" />)}
            {openDebts.map((x) => <LoanCard key={x.id} l={x} kind="je_dois" />)}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => forms.open({ f: 'debt', kind: 'on_me_doit', contact: id })} className="btn-ghost text-sm"><HandHeart size={18} /> Je lui prête</button>
              <button onClick={() => forms.open({ f: 'debt', kind: 'je_dois', contact: id })} className="btn-ghost text-sm"><HandCoins size={18} /> Il/elle me prête</button>
            </div>
          </section>

          {/* Historique complet */}
          <section>
            <h3 className="mb-2 font-semibold">Historique</h3>
            {history.length === 0 && <p className="text-sm text-ink-muted">Rien pour l'instant.</p>}
            <ol className="relative ml-2 border-l-2 border-cream-line">
              {history.map((e) => (
                <li key={e.key} className="relative pb-3 pl-5 last:pb-0">
                  <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${e.kind === 'in' ? 'bg-emerald-500' : 'bg-ink'}`} />
                  <button onClick={() => forms.open(e.open)} className="w-full text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0"><span className="block text-sm font-medium">{e.label}</span><span className="block text-xs text-ink-muted">{[fmtDateLong(e.date), e.sub].filter(Boolean).join(' · ')}</span></span>
                      <span className={`tabular shrink-0 text-sm font-semibold ${e.kind === 'in' ? 'text-emerald-700' : ''}`}>{e.kind === 'in' ? '−' : '+'}{fmt(Math.abs(e.delta), cur)}</span>
                    </span>
                    <span className="tabular block text-right text-[0.6875rem] text-ink-muted">{e.bal > 0 ? `me doit ${fmt(e.bal, cur)}` : e.bal < 0 ? `je lui dois ${fmt(-e.bal, cur)}` : 'à jour'}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Sheet>
  )
}
