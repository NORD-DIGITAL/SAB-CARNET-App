import { useMemo, useState } from 'react'
import { FileDown, Search } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { useHidden } from '../lib/prefs'
import { buildActivity } from '../lib/activity'
import type { Scope } from '../lib/activity'
import { saveTextFile, stamp, toCsv } from '../lib/files'
import { Empty, Header } from '../components/ui'
import { MonthBar } from '../components/DatePicker'
import { ActivityList } from '../components/ActivityList'
import { chip, methodLabel } from '../components/forms'

export default function HistoriqueScreen() {
  const d = useData()
  const { month, methods, cur } = d
  const [hidden] = useHidden()
  const [scope, setScope] = useState<'tout' | Scope>('tout')
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const all = useMemo(() => buildActivity(d), [d])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter((a) => (s ? `${a.title} ${a.sub}`.toLowerCase().includes(s) : a.date.startsWith(month))
      && (scope === 'tout' || a.scope === scope) && (!method || a.methods.includes(method)))
  }, [all, q, month, scope, method])
  const tin = list.filter((a) => a.tone === 'in').reduce((x, a) => x + a.amount, 0)
  const tout = list.filter((a) => a.tone === 'out').reduce((x, a) => x + a.amount, 0)
  const mask = (n: number) => (hidden ? '••••' : fmt(n, cur))

  const exportCsv = async () => {
    const rows: unknown[][] = [['Date', 'Section', 'Opération', 'Détail', 'Entrée', 'Sortie', 'Mouvement interne']]
    for (const a of all) rows.push([a.date, a.scope, a.title, a.sub, a.tone === 'in' ? a.amount : '', a.tone === 'out' ? a.amount : '', a.tone === 'neutral' ? a.amount : ''])
    const e = await saveTextFile(`sab-carnet_historique_${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
    setMsg(e ?? `${all.length} opérations exportées.`)
  }

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <Header title="Historique" right={<button onClick={exportCsv} aria-label="Exporter vers Excel" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream-tile"><FileDown size={22} strokeWidth={1.8} /></button>} />
      <div className="space-y-3 px-5 pb-10">
        {msg && <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{msg}</p>}
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
          <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Chercher (toutes dates)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une opération" />
        </div>
        {!q && <MonthBar />}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {([['tout', 'Tout'], ['perso', 'Perso'], ['business', 'Business'], ['dettes', 'Dettes']] as const).map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={chip(scope === k)}>{l}</button>)}
        </div>
        <select aria-label="Moyen de paiement" className="input py-2.5 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Toutes les caisses et cartes</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{methodLabel(m)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-ink p-4 text-white">
          <div><p className="text-xs text-white/60">Entrées</p><p className="tabular font-semibold text-emerald-300">{mask(tin)}</p></div>
          <div><p className="text-xs text-white/60">Sorties</p><p className="tabular font-semibold text-red-300">{mask(tout)}</p></div>
          <p className="col-span-2 text-xs text-white/50">{list.length} opération{list.length > 1 ? 's' : ''} · retraits, virements et ventes à crédit sont des mouvements internes (en gris).</p>
        </div>
        {list.length === 0 ? <Empty icon="🗂️" text={q ? 'Aucun résultat.' : 'Aucune opération pour ce choix.'} /> : <ActivityList items={list} />}
      </div>
    </div>
  )
}
