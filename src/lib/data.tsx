import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { monthKey } from './format'
import type {
  BizExpense, Category, Contact, DebtOwed, DebtOwedRepayment, Expense, Installment, LoanGiven, LoanRepayment, PaymentMethod,
  Product, Profile, Project, Purchase, PurchaseItem, Sale, SaleItem, SalePayment, Transfer, Withdrawal,
} from './types'
import { derive } from './derive'
import type { Derived } from './derive'

export interface Store {
  methods: PaymentMethod[]; categories: Category[]; contacts: Contact[]; projects: Project[]
  expenses: Expense[]; withdrawals: Withdrawal[]; transfers: Transfer[]
  debts: DebtOwed[]; debtRepayments: DebtOwedRepayment[]; loans: LoanGiven[]; loanRepayments: LoanRepayment[]
  products: Product[]; purchases: Purchase[]; purchaseItems: PurchaseItem[]; bizExpenses: BizExpense[]
  sales: Sale[]; saleItems: SaleItem[]; installments: Installment[]; salePayments: SalePayment[]
}
const EMPTY: Store = {
  methods: [], categories: [], contacts: [], projects: [], expenses: [], withdrawals: [], transfers: [],
  debts: [], debtRepayments: [], loans: [], loanRepayments: [], products: [], purchases: [], purchaseItems: [], bizExpenses: [],
  sales: [], saleItems: [], installments: [], salePayments: [],
}

interface DataCtx extends Store, Derived {
  session: Session | null
  authReady: boolean
  profile: Profile | null
  profileReady: boolean
  reloadProfile: () => Promise<void>
  isAdmin: boolean
  expiresAt: string | null
  accessReady: boolean
  reloadAccess: () => Promise<void>
  dataReady: boolean
  reload: () => Promise<void>
  month: string
  setMonth: (m: string) => void
  cur: string
  methodById: Map<string, PaymentMethod>
  catById: Map<string, Category>
  contactById: Map<string, Contact>
  productById: Map<string, Product>
  saleById: Map<string, Sale>
}

const Ctx = createContext<DataCtx>(null as unknown as DataCtx)
export const useData = () => useContext(Ctx)

/** Lit toute une table (par pages de 1000 lignes) : le RLS ne renvoie que les lignes du compte connecté. */
async function all<T>(table: string, order: string, asc = true): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order, { ascending: asc }).range(from, from + 999)
    if (error || !data) break
    out.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return out
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [accessReady, setAccessReady] = useState(false)
  const [store, setStore] = useState<Store>(EMPTY)
  const [dataReady, setDataReady] = useState(false)
  const [month, setMonth] = useState(monthKey(new Date()))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const uid = session?.user.id ?? null

  const reloadProfile = useCallback(async () => {
    if (!uid) { setProfile(null); setProfileReady(true); return }
    const { data } = await supabase.from('profiles').select('id,full_name,onboarded').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
    setProfileReady(true)
  }, [uid])
  useEffect(() => { setProfileReady(false); reloadProfile() }, [reloadProfile])

  const reloadAccess = useCallback(async () => {
    if (!uid) { setIsAdmin(false); setExpiresAt(null); setAccessReady(true); return }
    const { data } = await supabase.rpc('my_access_v3')
    const row = (Array.isArray(data) ? data[0] : data) as { is_admin: boolean; expires_at: string | null } | undefined
    setIsAdmin(!!row?.is_admin); setExpiresAt(row?.expires_at ?? null); setAccessReady(true)
  }, [uid])
  useEffect(() => { setAccessReady(false); reloadAccess() }, [reloadAccess])

  const reload = useCallback(async () => {
    if (!uid) { setStore(EMPTY); setDataReady(true); return }
    const [methods, categories, contacts, projects, expenses, withdrawals, transfers, debts, debtRepayments, loans, loanRepayments,
      products, purchases, purchaseItems, bizExpenses, sales, saleItems, installments, salePayments] = await Promise.all([
      all<PaymentMethod>('payment_methods', 'created_at'),
      all<Category>('categories', 'created_at'),
      all<Contact>('contacts', 'name'),
      all<Project>('projects', 'created_at', false),
      all<Expense>('expenses', 'spent_on', false),
      all<Withdrawal>('cash_withdrawals', 'withdrawn_on', false),
      all<Transfer>('transfers', 'transfer_on', false),
      all<DebtOwed>('debts_owed', 'borrowed_on', false),
      all<DebtOwedRepayment>('debts_owed_repayments', 'paid_on', false),
      all<LoanGiven>('loans_given', 'lent_on', false),
      all<LoanRepayment>('loans_given_repayments', 'received_on', false),
      all<Product>('biz_products', 'name'),
      all<Purchase>('biz_purchases', 'purchased_on', false),
      all<PurchaseItem>('biz_purchase_items', 'id'),
      all<BizExpense>('biz_expenses', 'spent_on', false),
      all<Sale>('biz_sales', 'sold_on', false),
      all<SaleItem>('biz_sale_items', 'id'),
      all<Installment>('biz_installments', 'due_date'),
      all<SalePayment>('biz_sale_payments', 'paid_on', false),
    ])
    const num = <T,>(rows: T[], keys: (keyof T)[]) => rows.map((r) => { const o = { ...r }; for (const k of keys) (o as Record<string, unknown>)[k as string] = Number(o[k] ?? 0); return o })
    setStore({
      methods: num(methods, ['initial_balance']), categories, contacts, projects,
      expenses: num(expenses, ['amount']), withdrawals: num(withdrawals, ['amount', 'fees']), transfers: num(transfers, ['amount']),
      debts: num(debts, ['amount']), debtRepayments: num(debtRepayments, ['amount']), loans: num(loans, ['amount']), loanRepayments: num(loanRepayments, ['amount']),
      products: num(products, ['cost_price', 'sale_price', 'initial_stock']), purchases: num(purchases, ['total_amount']),
      purchaseItems: num(purchaseItems, ['quantity', 'unit_cost']), bizExpenses: num(bizExpenses, ['amount']),
      sales: num(sales, ['total_amount']), saleItems: num(saleItems, ['quantity', 'unit_price', 'unit_cost']),
      installments: num(installments, ['amount']), salePayments: num(salePayments, ['amount']),
    })
    setDataReady(true)
  }, [uid])

  // Premier chargement : crée les moyens de paiement et catégories par défaut si le compte est neuf
  useEffect(() => {
    if (!uid || !profile?.onboarded) { if (!uid) { setStore(EMPTY); setDataReady(false) } return }
    let alive = true
    ;(async () => { await supabase.rpc('seed_my_defaults'); if (alive) await reload() })()
    return () => { alive = false }
  }, [uid, profile?.onboarded, reload])
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && uid) reload() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [reload, uid])

  const value = useMemo<DataCtx>(() => ({
    session, authReady, profile, profileReady, reloadProfile, isAdmin, expiresAt, accessReady, reloadAccess,
    dataReady, reload, month, setMonth, cur: 'Ar',
    ...store, ...derive(store),
    methodById: new Map(store.methods.map((x) => [x.id, x])),
    catById: new Map(store.categories.map((x) => [x.id, x])),
    contactById: new Map(store.contacts.map((x) => [x.id, x])),
    productById: new Map(store.products.map((x) => [x.id, x])),
    saleById: new Map(store.sales.map((x) => [x.id, x])),
  }), [session, authReady, profile, profileReady, reloadProfile, isAdmin, expiresAt, accessReady, reloadAccess, dataReady, reload, month, store])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
