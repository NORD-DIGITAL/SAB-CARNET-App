import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, isoOf, parseAmount, todayISO } from '../lib/format'
import { splitInstallments } from '../lib/derive'
import type { BizExpense, Frequency, Product, Purchase, Sale, SalePayment } from '../lib/types'
import { Segmented, Sheet } from './ui'
import { DateField, fmtDateLong } from './DatePicker'
import { AmountField, ContactField, ErrorBox, FormActions, MethodChips, NO_CONTACT, SmallAmount, chip, ensureContact, useMethodOf } from './forms'
import type { ContactSel } from './forms'

export const PRODUCT_CATS = ['Téléphones', 'Accessoires téléphone', 'Audio (JBL…)', 'Parfums', 'Déodorants', 'Vêtements', 'Riz', 'Autres']
const BIZ_EXPENSE_CATS = ['Transport', 'Emballage', 'Crédit téléphone', 'Livraison', 'Publicité', 'Autres']
const UNITS = ['pièce', 'kg', 'sac', 'kapoaka', 'litre', 'lot']
const amountStr = (n: number) => (n ? n.toLocaleString('fr-FR') : '')
const qtyStr = (n: number) => String(n).replace('.', ',')
const toQty = (s: string) => Number(s.replace(',', '.')) || 0
const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days); return isoOf(d) }
const addMonth = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return isoOf(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))) }
const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Enregistrement impossible.'

/* =====================================================================
   Produit
   ===================================================================== */
export function ProductForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: Product | null }) {
  const { reload, products, stockOf } = useData()
  const [name, setName] = useState('')
  const [cat, setCat] = useState(PRODUCT_CATS[0])
  const [unit, setUnit] = useState('pièce')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const cats = useMemo(() => [...new Set([...PRODUCT_CATS, ...products.map((p) => p.category).filter(Boolean) as string[]])], [products])

  useEffect(() => {
    if (!open) return
    setErr(''); setName(item?.name ?? ''); setCat(item?.category ?? PRODUCT_CATS[0]); setUnit(item?.unit ?? 'pièce')
    setCost(amountStr(item?.cost_price ?? 0)); setPrice(amountStr(item?.sale_price ?? 0)); setStock(item ? qtyStr(item.initial_stock) : ''); setActive(item?.is_active ?? true)
  }, [open, item])

  const save = async () => {
    if (!name.trim()) return setErr('Indique le nom du produit.')
    setBusy(true); setErr('')
    const row = { name: name.trim(), category: cat.trim() || null, unit, cost_price: parseAmount(cost), sale_price: parseAmount(price), initial_stock: toQty(stock), is_active: active }
    const { error } = item ? await supabase.from('biz_products').update(row).eq('id', item.id) : await supabase.from('biz_products').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => {
    setBusy(true)
    const { error } = await supabase.from('biz_products').delete().eq('id', item!.id)
    setBusy(false)
    if (error) return setErr('Ce produit apparaît dans des ventes ou des achats : il ne peut pas être supprimé. Tu peux le masquer (« Plus vendu »).')
    await reload(); onClose()
  }
  const margin = parseAmount(price) - parseAmount(cost)

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le produit' : 'Nouveau produit'}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="pr-name">Nom</label><input id="pr-name" className="input" placeholder="Ex : JBL Flip 6" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <p className="label">Catégorie</p>
          <div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>)}</div>
        </div>
        <div>
          <p className="label">Vendu à la</p>
          <div className="flex flex-wrap gap-2">{UNITS.map((u) => <button key={u} type="button" onClick={() => setUnit(u)} className={chip(unit === u)}>{u}</button>)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pr-cost">Prix d'achat</label><SmallAmount id="pr-cost" value={cost} onChange={setCost} /></div>
          <div><label className="label" htmlFor="pr-price">Prix de vente</label><SmallAmount id="pr-price" value={price} onChange={setPrice} /></div>
        </div>
        {parseAmount(price) > 0 && <p className={`text-sm ${margin < 0 ? 'text-red-600' : 'text-ink-soft'}`}>Bénéfice par {unit} : <b className="tabular">{fmt(margin, 'Ar')}</b></p>}
        <div>
          <label className="label" htmlFor="pr-stock">Stock de départ ({unit})</label>
          <input id="pr-stock" inputMode="decimal" className="input tabular" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d.,]/g, ''))} />
          {item && <p className="mt-1.5 text-xs text-ink-muted">Stock actuel (avec achats et ventes) : <b>{qtyStr(stockOf.get(item.id) ?? 0)} {unit}</b>. Les réapprovisionnements se notent dans « Achat de stock ».</p>}
        </div>
        {item && (
          <label className="flex items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile px-4 py-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-ink" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Plus vendu (masqué des nouvelles ventes)
          </label>
        )}
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Choix de produits (ventes et achats)
   ===================================================================== */
type Line = { product_id: string; qty: string; price: string }

function ProductLines({ lines, setLines, priceKey, priceLabel }: { lines: Line[]; setLines: (l: Line[]) => void; priceKey: 'sale_price' | 'cost_price'; priceLabel: string }) {
  const { products, productById, stockOf } = useData()
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(lines.length === 0)
  const list = products.filter((p) => p.is_active && (!q.trim() || `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const add = (p: Product) => {
    const i = lines.findIndex((l) => l.product_id === p.id)
    if (i >= 0) setLines(lines.map((l, j) => (j === i ? { ...l, qty: qtyStr(toQty(l.qty) + 1) } : l)))
    else setLines([...lines, { product_id: p.id, qty: '1', price: amountStr(p[priceKey]) }])
    setPicking(false); setQ('')
  }
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-2">
      <p className="section-title text-base">Produits</p>
      {lines.map((l, i) => {
        const p = productById.get(l.product_id)
        const st = stockOf.get(l.product_id) ?? 0
        return (
          <div key={l.product_id} className="space-y-2 rounded-2xl border border-cream-line bg-cream-tile p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{p?.name}</p><p className="text-xs text-ink-muted">En stock : {qtyStr(st)} {p?.unit}</p></div>
              <button type="button" aria-label="Retirer" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="rounded-full p-1 text-ink-muted"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full bg-white">
                <button type="button" aria-label="Moins" onClick={() => set(i, { qty: qtyStr(Math.max(1, toQty(l.qty) - 1)) })} className="p-2.5"><Minus size={16} /></button>
                <input aria-label="Quantité" inputMode="decimal" className="tabular w-12 bg-transparent text-center font-semibold outline-none" value={l.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^\d.,]/g, '') })} />
                <button type="button" aria-label="Plus" onClick={() => set(i, { qty: qtyStr(toQty(l.qty) + 1) })} className="p-2.5"><Plus size={16} /></button>
              </div>
              <span className="text-xs text-ink-muted">×</span>
              <SmallAmount value={l.price} onChange={(v) => set(i, { price: v })} className="flex-1" />
            </div>
            {priceKey === 'sale_price' && toQty(l.qty) > st && <p className="text-xs text-amber-700">Attention : plus que le stock noté ({qtyStr(st)}).</p>}
          </div>
        )
      })}
      {picking ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-ink/25 p-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3"><Search size={16} className="text-ink-muted" />
            <input autoFocus className="w-full bg-transparent py-2.5 outline-none" placeholder="Chercher un produit" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {products.length === 0 && <p className="text-sm text-ink-muted">Aucun produit pour l'instant : ajoute-les dans Business › Stock.</p>}
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {list.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-cream-tile">
                <span className="min-w-0 flex-1"><span className="block truncate">{p.name}</span><span className="block text-xs text-ink-muted">{p.category} · stock {qtyStr(stockOf.get(p.id) ?? 0)}</span></span>
                <span className="tabular text-sm">{fmt(p[priceKey], 'Ar')}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setPicking(true)} className="btn-ghost w-full py-2.5 text-sm"><Plus size={18} /> Ajouter un produit</button>
      )}
      {lines.length > 0 && <p className="text-xs text-ink-muted">{priceLabel} modifiable pour chaque ligne.</p>}
    </div>
  )
}

/* =====================================================================
   Nouvelle vente (comptant ou échelonnée)
   ===================================================================== */
export function SaleForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { reload, productById, cur } = useData()
  const methodOf = useMethodOf()
  const [client, setClient] = useState<ContactSel>(NO_CONTACT)
  const [lines, setLines] = useState<Line[]>([])
  const [finalPrice, setFinalPrice] = useState('')
  const [mode, setMode] = useState<'comptant' | 'echelonne'>('echelonne')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [down, setDown] = useState('')
  const [n, setN] = useState(3)
  const [freq, setFreq] = useState<Frequency>('mensuel')
  const [first, setFirst] = useState(addMonth(todayISO()))
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setClient(NO_CONTACT); setLines([]); setFinalPrice(''); setMode('echelonne'); setMethodId(methodOf('caisse_business'))
    setDown(''); setN(3); setFreq('mensuel'); setFirst(addMonth(todayISO())); setDate(todayISO()); setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sum = lines.reduce((a, l) => a + toQty(l.qty) * parseAmount(l.price), 0)
  const total = finalPrice ? parseAmount(finalPrice) : sum
  const downAmt = mode === 'comptant' ? total : parseAmount(down)
  const schedule = mode === 'echelonne' ? splitInstallments(total - downAmt, n, first, freq) : []
  const changeFreq = (f: Frequency) => { setFreq(f); setFirst(f === 'mensuel' ? addMonth(date) : addDays(date, f === 'hebdomadaire' ? 7 : 15)) }

  const save = async () => {
    if (!lines.length) return setErr('Ajoute au moins un produit.')
    if (lines.some((l) => toQty(l.qty) <= 0)) return setErr('Chaque produit doit avoir une quantité.')
    if (!total) return setErr('Le prix total est à 0.')
    if (mode === 'echelonne' && !client.name.trim() && !client.id) return setErr('Pour une vente à crédit, indique le nom du client.')
    if (mode === 'echelonne' && downAmt >= total) return setErr("L'acompte couvre tout le prix : choisis plutôt « Comptant ».")
    if (downAmt > 0 && !methodId) return setErr("Choisis où l'argent est encaissé.")
    setBusy(true); setErr('')
    let saleId: string | null = null
    try {
      const contactId = await ensureContact(client)
      const { data, error } = await supabase.from('biz_sales').insert({
        contact_id: contactId, sold_on: date, payment_mode: mode, total_amount: total,
        installments_nb: mode === 'echelonne' ? n : null, frequency: mode === 'echelonne' ? freq : null, note: note.trim() || null,
      }).select('id').single()
      if (error) throw error
      saleId = (data as { id: string }).id
      const items = lines.map((l) => ({ sale_id: saleId, product_id: l.product_id, quantity: toQty(l.qty), unit_price: parseAmount(l.price), unit_cost: productById.get(l.product_id)?.cost_price ?? 0 }))
      const r1 = await supabase.from('biz_sale_items').insert(items); if (r1.error) throw r1.error
      if (schedule.length) { const r2 = await supabase.from('biz_installments').insert(schedule.map((s) => ({ ...s, sale_id: saleId }))); if (r2.error) throw r2.error }
      if (downAmt > 0) {
        const r3 = await supabase.from('biz_sale_payments').insert({ sale_id: saleId, amount: downAmt, paid_on: date, payment_method_id: methodId, is_down_payment: mode === 'echelonne' })
        if (r3.error) throw r3.error
      }
      await reload(); setBusy(false); onClose(); if (saleId) onCreated?.(saleId)
    } catch (e) {
      if (saleId) await supabase.from('biz_sales').delete().eq('id', saleId)
      setBusy(false); setErr(errMsg(e))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle vente">
      <div className="space-y-5">
        <ContactField label="Client" value={client} onChange={setClient} optional={mode === 'comptant'} />
        <ProductLines lines={lines} setLines={setLines} priceKey="sale_price" priceLabel="Prix de vente" />
        {lines.length > 0 && (
          <div className="rounded-2xl bg-ink p-4 text-white">
            <div className="flex items-center justify-between"><span className="text-sm text-white/70">Total des produits</span><span className="tabular font-semibold">{fmt(sum, cur)}</span></div>
            <label className="mt-3 block text-sm text-white/70" htmlFor="sale-final">Prix final convenu (si remise)</label>
            <input id="sale-final" inputMode="numeric" className="tabular mt-1 w-full rounded-xl bg-white/10 px-3 py-2.5 text-lg font-semibold outline-none placeholder:text-white/40" placeholder={sum.toLocaleString('fr-FR')}
              value={finalPrice} onChange={(e) => { const v = parseAmount(e.target.value); setFinalPrice(v ? v.toLocaleString('fr-FR') : '') }} />
          </div>
        )}
        <Segmented value={mode} onChange={setMode} options={[['echelonne', 'Échelonné (à crédit)'], ['comptant', 'Comptant']]} />
        {mode === 'comptant' ? (
          <MethodChips label="Encaissé dans" value={methodId} onChange={setMethodId} />
        ) : (
          <div className="space-y-4">
            <div><label className="label" htmlFor="sale-down">Acompte reçu aujourd'hui <span className="text-xs">(facultatif)</span></label><SmallAmount id="sale-down" value={down} onChange={setDown} /></div>
            {parseAmount(down) > 0 && <MethodChips label="Acompte encaissé dans" value={methodId} onChange={setMethodId} />}
            <div>
              <p className="label">Nombre d'échéances</p>
              <div className="flex flex-wrap gap-2">{[2, 3, 4, 5, 6, 8, 10, 12].map((k) => <button key={k} type="button" onClick={() => setN(k)} className={chip(n === k)}>{k}</button>)}</div>
            </div>
            <Segmented value={freq} onChange={changeFreq} options={[['hebdomadaire', 'Chaque semaine'], ['quinzaine', '15 jours'], ['mensuel', 'Chaque mois']]} />
            <div><label className="label" htmlFor="sale-first">Première échéance</label><DateField id="sale-first" value={first} onChange={setFirst} /></div>
            {schedule.length > 0 && (
              <div className="rounded-2xl border border-cream-line bg-cream-tile p-3">
                <p className="mb-2 text-sm font-semibold">Échéancier · reste {fmt(total - downAmt, cur)}</p>
                {schedule.map((s, i) => (
                  <div key={i} className="flex justify-between border-b border-cream-line py-1.5 text-sm last:border-0">
                    <span>{i + 1}. {fmtDateLong(s.due_date)}</span><span className="tabular font-medium">{fmt(s.amount, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="sale-date">Date</label>
          <DateField id="sale-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="sale-note">Note</label>
          <input id="sale-note" className="input py-3" placeholder="Ex : couleur noire, garantie 3 mois" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} saveLabel="Enregistrer la vente" />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Encaissement d'un client (versement sur une vente)
   ===================================================================== */
export function SalePaymentForm({ open, onClose, sale, item }: { open: boolean; onClose: () => void; sale: Sale | null; item: SalePayment | null }) {
  const { reload, saleState, contactById, cur } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const st = sale ? saleState.get(sale.id) : undefined
  const maxAmt = (st?.remaining ?? 0) + (item?.amount ?? 0)

  useEffect(() => {
    if (!open || !sale) return
    setErr('')
    const suggest = st ? (st.overdue > 0 ? st.overdue : Math.min(st.remaining, Math.ceil(st.remaining / Math.max(1, sale.installments_nb ?? 1)))) : 0
    setAmount(amountStr(item?.amount ?? suggest)); setMethodId(item?.payment_method_id ?? methodOf('caisse_business'))
    setDate(item?.paid_on ?? todayISO()); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, sale?.id])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique le montant reçu.')
    if (amt > maxAmt) return setErr(`Le client ne doit plus que ${fmt(maxAmt, cur)} sur cette vente.`)
    if (!methodId) return setErr("Choisis où l'argent est encaissé.")
    setBusy(true); setErr('')
    const row = { sale_id: sale!.id, amount: amt, payment_method_id: methodId, paid_on: date, note: note.trim() || null }
    const { error } = item ? await supabase.from('biz_sale_payments').update(row).eq('id', item.id) : await supabase.from('biz_sale_payments').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('biz_sale_payments').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }
  const who = sale?.contact_id ? contactById.get(sale.contact_id)?.name : 'Client'

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le versement' : `Versement de ${who}`}>
      <div className="space-y-5">
        {st && <p className="rounded-2xl bg-cream-tile px-4 py-3 text-sm">Reste à payer : <b className="tabular">{fmt(maxAmt, cur)}</b>{st.overdue > 0 && <> · <span className="text-red-600">en retard : {fmt(st.overdue, cur)}</span></>}</p>}
        <AmountField value={amount} onChange={setAmount} tone="green" autoFocus={!item} />
        {!item && maxAmt > 0 && <button type="button" onClick={() => setAmount(amountStr(maxAmt))} className={chip(parseAmount(amount) === maxAmt)}>Tout le reste ({fmt(maxAmt, cur)})</button>}
        <MethodChips label="Encaissé dans" value={methodId} onChange={setMethodId} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="sp-date">Date</label>
          <DateField id="sp-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="sp-note">Note</label>
          <input id="sp-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Achat de stock (réapprovisionnement)
   ===================================================================== */
export function PurchaseForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: Purchase | null }) {
  const { reload, purchaseItems, cur } = useData()
  const methodOf = useMethodOf()
  const [supplier, setSupplier] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setSupplier(item?.supplier ?? ''); setMethodId(item?.payment_method_id ?? methodOf('caisse_business'))
    setDate(item?.purchased_on ?? todayISO()); setNote(item?.note ?? '')
    setLines(item ? purchaseItems.filter((i) => i.purchase_id === item.id).map((i) => ({ product_id: i.product_id, qty: qtyStr(i.quantity), price: amountStr(i.unit_cost) })) : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const total = lines.reduce((a, l) => a + toQty(l.qty) * parseAmount(l.price), 0)
  const save = async () => {
    if (!lines.length) return setErr('Ajoute au moins un produit acheté.')
    if (!methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    try {
      const row = { supplier: supplier.trim() || null, purchased_on: date, total_amount: total, payment_method_id: methodId, note: note.trim() || null }
      let id = item?.id
      if (item) { const { error } = await supabase.from('biz_purchases').update(row).eq('id', item.id); if (error) throw error; await supabase.from('biz_purchase_items').delete().eq('purchase_id', item.id) }
      else { const { data, error } = await supabase.from('biz_purchases').insert(row).select('id').single(); if (error) throw error; id = (data as { id: string }).id }
      const { error } = await supabase.from('biz_purchase_items').insert(lines.map((l) => ({ purchase_id: id, product_id: l.product_id, quantity: toQty(l.qty), unit_cost: parseAmount(l.price) })))
      if (error) throw error
      await reload(); setBusy(false); onClose()
    } catch (e) { setBusy(false); setErr(errMsg(e)) }
  }
  const remove = async () => { setBusy(true); await supabase.from('biz_purchases').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? "Modifier l'achat" : 'Achat de stock'}>
      <div className="space-y-5">
        <div><label className="label" htmlFor="pu-sup">Fournisseur <span className="text-xs">(facultatif)</span></label><input id="pu-sup" className="input" placeholder="Ex : grossiste Behoririka" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
        <ProductLines lines={lines} setLines={setLines} priceKey="cost_price" priceLabel="Prix d'achat unitaire" />
        {lines.length > 0 && <p className="flex justify-between rounded-2xl bg-ink px-4 py-3 text-white"><span className="text-white/70">Total payé</span><b className="tabular">{fmt(total, cur)}</b></p>}
        <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="pu-date">Date</label>
          <DateField id="pu-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="pu-note">Note</label>
          <input id="pu-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}

/* =====================================================================
   Frais du business
   ===================================================================== */
export function BizExpenseForm({ open, onClose, item }: { open: boolean; onClose: () => void; item: BizExpense | null }) {
  const { reload } = useData()
  const methodOf = useMethodOf()
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState(BIZ_EXPENSE_CATS[0])
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setAmount(amountStr(item?.amount ?? 0)); setCat(item?.category ?? BIZ_EXPENSE_CATS[0])
    setMethodId(item?.payment_method_id ?? methodOf('caisse_business')); setDate(item?.spent_on ?? todayISO()); setNote(item?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (!methodId) return setErr('Choisis avec quoi tu as payé.')
    setBusy(true); setErr('')
    const row = { amount: amt, category: cat, payment_method_id: methodId, spent_on: date, note: note.trim() || null }
    const { error } = item ? await supabase.from('biz_expenses').update(row).eq('id', item.id) : await supabase.from('biz_expenses').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('biz_expenses').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier le frais' : 'Frais du business'}>
      <div className="space-y-5">
        <AmountField value={amount} onChange={setAmount} autoFocus={!item} />
        <div><p className="label">Type de frais</p><div className="flex flex-wrap gap-2">{BIZ_EXPENSE_CATS.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>)}</div></div>
        <MethodChips label="Payé avec" value={methodId} onChange={setMethodId} />
        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="be-date">Date</label>
          <DateField id="be-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="be-note">Note</label>
          <input id="be-note" className="input py-3" placeholder="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
