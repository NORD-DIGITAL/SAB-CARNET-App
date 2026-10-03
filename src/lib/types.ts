/* ---------- Plateforme ---------- */
export interface Profile { id: string; full_name: string | null; onboarded: boolean }
export interface Feedback { id: string; user_id: string; sender_name: string | null; sender_email: string | null; kind: 'amelioration' | 'probleme' | 'autre'; message: string; status: 'nouveau' | 'lu' | 'traite'; created_at: string }

/* ---------- Moyens de paiement ---------- */
export type MethodType = 'especes' | 'caisse_business' | 'carte' | 'mvola' | 'orange_money' | 'airtel_money'
export interface PaymentMethod {
  id: string; type: MethodType; name: string; bank: string | null; last4: string | null; color: string | null
  track_balance: boolean; initial_balance: number; is_active: boolean; created_at: string
}
export interface MethodBalance { method_id: string; type: MethodType; name: string; last4: string | null; balance: number }
export interface Transfer { id: string; from_method_id: string; to_method_id: string; amount: number; transfer_on: string; note: string | null; created_at: string }
export interface Withdrawal {
  id: string; card_id: string; dest_method_id: string; amount: number; fees: number; fee_expense_id: string | null
  withdrawn_on: string; place: string | null; note: string | null; created_at: string
}

/* ---------- Dépenses perso ---------- */
export type CatModule = 'general' | 'sport' | 'beaute' | 'frais_bancaires'
export interface Category { id: string; name: string; icon: string | null; module: CatModule }
export interface Project { id: string; name: string; description: string | null; start_date: string | null; end_date: string | null; status: 'en_cours' | 'termine' | 'en_pause'; include_in_personal: boolean }
export interface Expense {
  id: string; amount: number; spent_on: string; category_id: string | null; payment_method_id: string | null
  card_operation: 'tpe' | 'en_ligne' | null; project_id: string | null; source: 'general' | 'sport' | 'beaute' | 'frais_retrait'
  label: string | null; note: string | null; created_at: string
}

/* ---------- Contacts, dettes ---------- */
export interface Contact { id: string; name: string; phone: string | null; address: string | null; note: string | null }
export interface DebtOwed { id: string; contact_id: string; amount: number; borrowed_on: string; due_date: string | null; received_via_id: string | null; reason: string | null }
export interface DebtOwedRepayment { id: string; debt_id: string; amount: number; paid_on: string; payment_method_id: string | null; note: string | null }
export interface LoanGiven { id: string; contact_id: string; amount: number; lent_on: string; due_date: string | null; paid_via_id: string | null; reason: string | null }
export interface LoanRepayment { id: string; loan_id: string; amount: number; received_on: string; payment_method_id: string | null; note: string | null }
export type DebtStatus = 'solde' | 'en_cours' | 'en_retard'

/* ---------- Business perso ---------- */
export interface Product { id: string; name: string; category: string | null; unit: string | null; cost_price: number; sale_price: number; initial_stock: number; is_active: boolean }
export interface StockRow { product_id: string; stock_qty: number }
export interface Purchase { id: string; supplier: string | null; purchased_on: string; total_amount: number; payment_method_id: string | null; note: string | null; created_at: string }
export interface PurchaseItem { id: string; purchase_id: string; product_id: string; quantity: number; unit_cost: number }
export interface BizExpense { id: string; amount: number; spent_on: string; category: string | null; payment_method_id: string | null; note: string | null; created_at: string }
export type Frequency = 'hebdomadaire' | 'quinzaine' | 'mensuel' | 'libre'
export interface Sale {
  id: string; contact_id: string | null; sold_on: string; payment_mode: 'comptant' | 'echelonne'; total_amount: number
  installments_nb: number | null; frequency: Frequency | null; note: string | null; created_at: string
}
export interface SaleItem { id: string; sale_id: string; product_id: string; quantity: number; unit_price: number; unit_cost: number }
export interface Installment { id: string; sale_id: string; due_date: string; amount: number }
export interface SalePayment { id: string; sale_id: string; amount: number; paid_on: string; payment_method_id: string | null; is_down_payment: boolean; note: string | null; created_at: string }
