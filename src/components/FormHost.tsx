import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeftRight, Banknote, Briefcase, CalendarCheck, Dumbbell, HandCoins, HandHeart, Landmark, PackagePlus, Receipt, ShoppingBag, Sparkles, Truck, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BeautyService, BizExpense, DebtOwed, Investment, InvestmentFlow, SportPackage, SportSession, DebtOwedRepayment, Expense, LoanGiven, LoanRepayment, Product, Purchase, Sale, SalePayment, Transfer, Withdrawal } from '../lib/types'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { fmtDateLong } from './DatePicker'
import { Empty } from './ui'
import { Sheet } from './ui'
import { ExpenseForm, TransferForm, WithdrawalForm } from './OpsForms'
import { BizExpenseForm, ProductForm, PurchaseForm, SaleForm, SalePaymentForm } from './BizForms'
import { DebtForm, RepayForm } from './DebtForms'
import { SaleDetail } from './SaleDetail'
import { ContactSheet } from './ContactSheet'
import { BeautyForm, SportPackageForm, SportSessionForm } from './PersoForms'
import { FlowForm, InvestmentDetail, InvestmentForm } from './ProForms'

type DebtKind = 'je_dois' | 'on_me_doit'
export type FormReq =
  | { f: 'quick' }
  | { f: 'expense'; item?: Expense; preset?: Partial<Expense> }
  | { f: 'withdrawal'; item?: Withdrawal }
  | { f: 'transfer'; item?: Transfer; preset?: { from?: string; to?: string } }
  | { f: 'sale' }
  | { f: 'saleDetail'; id: string }
  | { f: 'salePayment'; sale: Sale; item?: SalePayment }
  | { f: 'purchase'; item?: Purchase }
  | { f: 'bizExpense'; item?: BizExpense }
  | { f: 'product'; item?: Product }
  | { f: 'debt'; kind: DebtKind; item?: DebtOwed | LoanGiven; contact?: string | null }
  | { f: 'repay'; kind: DebtKind; parent: DebtOwed | LoanGiven; item?: DebtOwedRepayment | LoanRepayment }
  | { f: 'contact'; id: string }
  | { f: 'pickSale' }
  | { f: 'sportSession'; item?: SportSession }
  | { f: 'sportPackage'; item?: SportPackage }
  | { f: 'beauty'; item?: BeautyService }
  | { f: 'investment'; item?: Investment }
  | { f: 'investDetail'; id: string }
  | { f: 'flow'; investment: Investment; item?: InvestmentFlow; kind?: 'apport' | 'retour' }

interface FormsCtx { open: (r: FormReq) => void; closeAll: () => void; count: number }
const Ctx = createContext<FormsCtx>({ open: () => undefined, closeAll: () => undefined, count: 0 })
export const useForms = () => useContext(Ctx)

/** Gère toutes les feuilles de saisie : une pile, pour pouvoir ouvrir un versement par-dessus le détail d'une vente. */
export function FormHost({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<{ key: number; r: FormReq }[]>([])
  const open = useCallback((r: FormReq) => setStack((s) => [...s, { key: Date.now() + Math.random(), r }]), [])
  const closeAll = useCallback(() => setStack([]), [])
  const value = useMemo(() => ({ open, closeAll, count: stack.length }), [open, closeAll, stack.length])

  return (
    <Ctx.Provider value={value}>
      {children}
      {stack.map(({ key, r }) => {
        const close = () => setStack((s) => s.filter((x) => x.key !== key))
        const p = { open: true, onClose: close }
        switch (r.f) {
          case 'quick': return <QuickAdd key={key} onClose={close} />
          case 'expense': return <ExpenseForm key={key} {...p} item={r.item ?? null} preset={r.preset} />
          case 'withdrawal': return <WithdrawalForm key={key} {...p} item={r.item ?? null} />
          case 'transfer': return <TransferForm key={key} {...p} item={r.item ?? null} preset={r.preset} />
          case 'sale': return <SaleForm key={key} {...p} onCreated={(id) => open({ f: 'saleDetail', id })} />
          case 'saleDetail': return <SaleDetail key={key} {...p} id={r.id} />
          case 'salePayment': return <SalePaymentForm key={key} {...p} sale={r.sale} item={r.item ?? null} />
          case 'purchase': return <PurchaseForm key={key} {...p} item={r.item ?? null} />
          case 'bizExpense': return <BizExpenseForm key={key} {...p} item={r.item ?? null} />
          case 'product': return <ProductForm key={key} {...p} item={r.item ?? null} />
          case 'debt': return <DebtForm key={key} {...p} kind={r.kind} item={r.item ?? null} presetContact={r.contact} />
          case 'repay': return <RepayForm key={key} {...p} kind={r.kind} parent={r.parent} item={r.item ?? null} />
          case 'contact': return <ContactSheet key={key} {...p} id={r.id} />
          case 'pickSale': return <PickSale key={key} onClose={close} />
          case 'sportSession': return <SportSessionForm key={key} {...p} item={r.item ?? null} />
          case 'sportPackage': return <SportPackageForm key={key} {...p} item={r.item ?? null} />
          case 'beauty': return <BeautyForm key={key} {...p} item={r.item ?? null} />
          case 'investment': return <InvestmentForm key={key} {...p} item={r.item ?? null} />
          case 'investDetail': return <InvestmentDetail key={key} {...p} id={r.id} />
          case 'flow': return <FlowForm key={key} {...p} investment={r.investment} item={r.item ?? null} kind={r.kind} />
        }
      })}
    </Ctx.Provider>
  )
}

/* ---------- Menu du bouton « + » ---------- */
function QuickAdd({ onClose }: { onClose: () => void }) {
  const { open } = useForms()
  const { salesOpenCount } = useQuickCounts()
  const go = (r: FormReq) => () => { onClose(); open(r) }
  const sections: { title: string; items: { label: string; Icon: LucideIcon; run: () => void; hint?: string }[] }[] = [
    { title: 'Perso', items: [
      { label: 'Dépense', Icon: Receipt, run: go({ f: 'expense' }) },
      { label: 'Retrait DAB', Icon: Landmark, run: go({ f: 'withdrawal' }) },
      { label: 'Dépense fixe', Icon: CalendarCheck, run: go({ f: 'expense', preset: { is_fixed: true } }) },
      { label: 'Séance de sport', Icon: Dumbbell, run: go({ f: 'sportSession' }) },
      { label: 'Beauté', Icon: Sparkles, run: go({ f: 'beauty' }) },
      { label: 'Virement entre caisses', Icon: ArrowLeftRight, run: go({ f: 'transfer' }) },
    ] },
    { title: 'Business', items: [
      { label: 'Vente', Icon: ShoppingBag, run: go({ f: 'sale' }) },
      { label: 'Versement client', Icon: Banknote, run: go({ f: 'pickSale' }), hint: salesOpenCount ? `${salesOpenCount} en cours` : undefined },
      { label: 'Achat de stock', Icon: PackagePlus, run: go({ f: 'purchase' }) },
      { label: 'Frais business', Icon: Truck, run: go({ f: 'bizExpense' }) },
      { label: 'Business Pro', Icon: Briefcase, run: go({ f: 'investment' }) },
    ] },
    { title: 'Dettes', items: [
      { label: "J'emprunte", Icon: HandCoins, run: go({ f: 'debt', kind: 'je_dois' }) },
      { label: 'Je prête', Icon: HandHeart, run: go({ f: 'debt', kind: 'on_me_doit' }) },
      { label: 'Caisses et cartes', Icon: Wallet, run: () => { onClose(); window.dispatchEvent(new CustomEvent('sab:open-sub', { detail: 'moyens' })) } },
    ] },
  ]
  return (
    <Sheet open onClose={onClose}>
      <div className="-mx-6 divide-y divide-neutral-100">
        {sections.map((s) => (
          <section key={s.title} className="px-6 py-5 first:pt-1">
            <h3 className="mb-3 text-lg font-semibold">{s.title}</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {s.items.map(({ label, Icon, run, hint }) => (
                <button key={label} onClick={run} className="tile relative flex h-[6.25rem] flex-col justify-between p-3 text-left active:scale-[.98]">
                  <Icon size={28} strokeWidth={1.5} />
                  <span className="text-[0.8125rem] leading-tight">{label}</span>
                  {hint && <span className="absolute right-2 top-2 rounded-full bg-sun-500 px-1.5 text-[0.625rem] font-semibold">{hint}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  )
}

function useQuickCounts() {
  const { sales, saleState } = useData()
  return { salesOpenCount: sales.filter((s) => (saleState.get(s.id)?.remaining ?? 0) > 0).length }
}

/* ---------- Choisir la vente pour un versement ---------- */
function PickSale({ onClose }: { onClose: () => void }) {
  const { open } = useForms()
  const { sales, saleState, contactById, cur } = useData()
  const list = sales.filter((s) => (saleState.get(s.id)?.remaining ?? 0) > 0)
    .sort((a, b) => (saleState.get(b.id)!.overdue - saleState.get(a.id)!.overdue) || (a.sold_on < b.sold_on ? -1 : 1))
  return (
    <Sheet open onClose={onClose} title="Quel client paie ?">
      {list.length === 0 && <Empty icon="🎉" text="Aucune vente en attente de paiement." />}
      <div className="-mx-2">
        {list.map((s) => {
          const st = saleState.get(s.id)!
          return (
            <button key={s.id} onClick={() => { onClose(); open({ f: 'salePayment', sale: s }) }} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-cream-tile">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{(contactById.get(s.contact_id ?? '')?.name ?? '?').charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{contactById.get(s.contact_id ?? '')?.name ?? 'Client sans nom'}</span>
                <span className="block truncate text-xs text-ink-muted">Vente du {fmtDateLong(s.sold_on)}{st.overdue > 0 ? ' · en retard' : st.nextDue ? ` · prochaine le ${fmtDateLong(st.nextDue)}` : ''}</span>
              </span>
              <span className={`tabular shrink-0 text-right text-sm font-semibold ${st.overdue > 0 ? 'text-red-600' : ''}`}>{fmt(st.remaining, cur)}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
