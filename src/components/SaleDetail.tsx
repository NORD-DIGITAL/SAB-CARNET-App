import { useState } from 'react'
import { Banknote, MessageCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, todayISO } from '../lib/format'
import type { DebtStatus } from '../lib/types'
import { Sheet } from './ui'
import { fmtDateLong } from './DatePicker'
import { methodLabel, waLink } from './forms'
import { useForms } from './FormHost'

export const STATUS_BADGE: Record<DebtStatus, [string, string]> = {
  solde: ['Soldé', 'bg-emerald-100 text-emerald-800'],
  en_cours: ['En cours', 'bg-sun-100 text-ink'],
  en_retard: ['En retard', 'bg-red-100 text-red-700'],
}
export function StatusBadge({ s }: { s: DebtStatus }) {
  const [l, c] = STATUS_BADGE[s]
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{l}</span>
}

/** Fiche d'une vente : produits, échéancier, versements, rappel WhatsApp. */
export function SaleDetail({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const forms = useForms()
  const { saleById, saleItems, installments, salePayments, saleState, contactById, productById, methodById, reload, cur } = useData()
  const [confirm, setConfirm] = useState(false)
  const sale = saleById.get(id)
  if (!sale) return null
  const st = saleState.get(id)!
  const client = sale.contact_id ? contactById.get(sale.contact_id) : undefined
  const items = saleItems.filter((i) => i.sale_id === id)
  const sched = installments.filter((i) => i.sale_id === id).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
  const pays = salePayments.filter((p) => p.sale_id === id).sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1))
  const today = todayISO()
  const downPaid = pays.filter((p) => p.is_down_payment).reduce((a, p) => a + p.amount, 0)
  const what = items.map((i) => productById.get(i.product_id)?.name).filter(Boolean).join(', ')

  // Les versements (hors acompte) couvrent les échéances dans l'ordre
  let pool = st.paid - downPaid
  const rows = sched.map((i) => {
    const covered = Math.max(0, Math.min(i.amount, pool)); pool -= covered
    const state = covered >= i.amount ? 'payee' : i.due_date < today ? 'retard' : covered > 0 ? 'partielle' : 'avenir'
    return { ...i, covered, state }
  })

  const reminder = [
    `Bonjour ${client?.name?.split(' ')[0] ?? ''} 👋`,
    `Petit rappel pour ${what || 'ton achat'} du ${fmtDateLong(sale.sold_on).toLowerCase()} :`,
    `reste à payer ${fmt(st.remaining, cur)}${st.overdue > 0 ? `, dont ${fmt(st.overdue, cur)} déjà échu` : ''}.`,
    st.nextDue && st.overdue <= 0 ? `Prochaine échéance le ${fmtDateLong(st.nextDue).toLowerCase()}.` : '',
    'Merci beaucoup !',
  ].filter(Boolean).join('\n')

  const remove = async () => {
    if (!confirm) return setConfirm(true)
    await supabase.from('biz_sales').delete().eq('id', id)
    await reload(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{client?.name ?? 'Vente comptant'}</p>
            <p className="text-sm text-ink-muted">{fmtDateLong(sale.sold_on)} · {sale.payment_mode === 'echelonne' ? `échelonné en ${sale.installments_nb} fois` : 'comptant'}</p>
          </div>
          <StatusBadge s={st.status} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-cream-tile p-3"><p className="text-xs text-ink-muted">Prix</p><p className="tabular text-sm font-semibold">{fmt(sale.total_amount, cur)}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Payé</p><p className="tabular text-sm font-semibold">{fmt(st.paid, cur)}</p></div>
          <div className={`rounded-2xl p-3 ${st.overdue > 0 ? 'bg-red-50' : 'bg-sun-100'}`}><p className={`text-xs ${st.overdue > 0 ? 'text-red-700' : 'text-ink-muted'}`}>Reste</p><p className="tabular text-sm font-semibold">{fmt(st.remaining, cur)}</p></div>
        </div>
        {st.overdue > 0 && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">En retard : <b className="tabular">{fmt(st.overdue, cur)}</b> auraient déjà dû être payés.</p>}

        <div className="flex gap-2">
          {st.remaining > 0 && <button onClick={() => forms.open({ f: 'salePayment', sale })} className="btn-primary flex-1"><Banknote size={20} /> Encaisser</button>}
          {st.remaining > 0 && client?.phone && <a href={waLink(client.phone, reminder)} target="_blank" rel="noopener" className="btn-dark flex-1"><MessageCircle size={20} /> Rappel</a>}
        </div>
        {st.remaining > 0 && client && !client.phone && <p className="text-xs text-ink-muted">Ajoute le téléphone de {client.name} (fiche de la personne) pour lui envoyer un rappel WhatsApp.</p>}

        <section>
          <h3 className="mb-2 font-semibold">Produits</h3>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between border-b border-neutral-100 py-2 text-sm last:border-0">
              <span>{String(i.quantity).replace('.', ',')} × {productById.get(i.product_id)?.name ?? 'Produit supprimé'}</span>
              <span className="tabular">{fmt(i.quantity * i.unit_price, cur)}</span>
            </div>
          ))}
          {sale.note && <p className="mt-2 text-sm text-ink-muted">Note : {sale.note}</p>}
        </section>

        {rows.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold">Échéancier</h3>
            {downPaid > 0 && <div className="flex justify-between border-b border-neutral-100 py-2 text-sm"><span>Acompte</span><span className="tabular text-emerald-700">{fmt(downPaid, cur)} ✔</span></div>}
            {rows.map((r, n) => (
              <div key={r.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0">
                <span className="min-w-0 flex-1">{n + 1}. {fmtDateLong(r.due_date)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${r.state === 'payee' ? 'bg-emerald-100 text-emerald-800' : r.state === 'retard' ? 'bg-red-100 text-red-700' : r.state === 'partielle' ? 'bg-sun-100' : 'bg-neutral-100 text-ink-muted'}`}>
                  {r.state === 'payee' ? 'Payée' : r.state === 'retard' ? 'En retard' : r.state === 'partielle' ? `${fmt(r.covered, cur)} reçus` : 'À venir'}
                </span>
                <span className="tabular w-28 text-right">{fmt(r.amount, cur)}</span>
              </div>
            ))}
          </section>
        )}

        <section>
          <h3 className="mb-2 font-semibold">Versements reçus</h3>
          {pays.length === 0 && <p className="text-sm text-ink-muted">Aucun versement pour l'instant.</p>}
          {pays.map((p) => (
            <button key={p.id} onClick={() => forms.open({ f: 'salePayment', sale, item: p })} className="flex w-full justify-between border-b border-neutral-100 py-2.5 text-left text-sm last:border-0">
              <span>{fmtDateLong(p.paid_on)}<span className="block text-xs text-ink-muted">{[p.is_down_payment ? 'Acompte' : null, methodLabel(methodById.get(p.payment_method_id ?? '')), p.note].filter(Boolean).join(' · ')}</span></span>
              <span className="tabular font-medium text-emerald-700">+{fmt(p.amount, cur)}</span>
            </button>
          ))}
        </section>

        <button onClick={remove} className={`btn w-full ${confirm ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
          <Trash2 size={18} /> {confirm ? 'Confirmer : supprimer la vente et ses versements' : 'Supprimer la vente'}
        </button>
      </div>
    </Sheet>
  )
}
