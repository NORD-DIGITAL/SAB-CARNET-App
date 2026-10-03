import { useState } from 'react'
import { ChevronRight, HandCoins, HandHeart, Search } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { useHidden } from '../lib/prefs'
import { Empty, Header, Segmented } from '../components/ui'
import { useForms } from '../components/FormHost'

type Tab = 'on_me_doit' | 'je_dois' | 'personnes'

export default function DettesScreen() {
  const { receivables, receivableTotal, payables, payableTotal, contacts, contactById, cur } = useData()
  const forms = useForms()
  const [hidden] = useHidden()
  const [tab, setTab] = useState<Tab>('on_me_doit')
  const [q, setQ] = useState('')
  const mask = (n: number) => (hidden ? '••••••' : fmt(n, cur))
  const match = (id: string) => !q.trim() || `${contactById.get(id)?.name ?? ''} ${contactById.get(id)?.phone ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())

  const Person = ({ id, total, late, sub }: { id: string; total?: number; late?: boolean; sub?: string }) => {
    const c = contactById.get(id)
    return (
      <button onClick={() => forms.open({ f: 'contact', id })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-white ${late ? 'bg-red-500' : 'bg-ink'}`}>{(c?.name ?? '?').charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{c?.name ?? 'Personne supprimée'}</span>
          <span className={`block truncate text-xs ${late ? 'text-red-600' : 'text-ink-muted'}`}>{late ? 'En retard · ' : ''}{sub ?? c?.phone ?? ''}</span>
        </span>
        {total !== undefined && <span className="tabular shrink-0 font-semibold">{mask(total)}</span>}
        <ChevronRight size={18} className="shrink-0 text-neutral-400" />
      </button>
    )
  }

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <Header title="Dettes" />
      <div className="space-y-4 px-5 pb-10">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTab('on_me_doit')} className={`rounded-2xl p-3 text-left ${tab === 'on_me_doit' ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-emerald-50'}`}>
            <p className="text-xs text-emerald-800">On me doit</p><p className="tabular text-lg font-semibold">{mask(receivableTotal)}</p>
          </button>
          <button onClick={() => setTab('je_dois')} className={`rounded-2xl p-3 text-left ${tab === 'je_dois' ? 'bg-red-100 ring-2 ring-red-400' : 'bg-red-50'}`}>
            <p className="text-xs text-red-800">Je dois</p><p className="tabular text-lg font-semibold">{mask(payableTotal)}</p>
          </button>
        </div>
        <Segmented value={tab} onChange={setTab} options={[['on_me_doit', 'On me doit'], ['je_dois', 'Je dois'], ['personnes', 'Personnes']]} />
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
          <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Nom ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une personne" />
        </div>

        {tab === 'on_me_doit' && (
          <>
            <button onClick={() => forms.open({ f: 'debt', kind: 'on_me_doit' })} className="btn-ghost w-full"><HandHeart size={20} /> Je prête de l'argent</button>
            {receivables.length === 0 && <Empty icon="🤝" text="Personne ne te doit d'argent. Les ventes à crédit et les prêts apparaissent ici." />}
            <div>{receivables.filter((r) => match(r.contact_id)).map((r) => (
              <Person key={r.contact_id} id={r.contact_id} total={r.total} late={r.late}
                sub={[r.sales ? `ventes ${fmt(r.sales, cur)}` : null, r.loans ? `prêts ${fmt(r.loans, cur)}` : null].filter(Boolean).join(' · ')} />
            ))}</div>
          </>
        )}
        {tab === 'je_dois' && (
          <>
            <button onClick={() => forms.open({ f: 'debt', kind: 'je_dois' })} className="btn-ghost w-full"><HandCoins size={20} /> J'emprunte de l'argent</button>
            {payables.length === 0 && <Empty icon="✅" text="Tu ne dois d'argent à personne." />}
            <div>{payables.filter((r) => match(r.contact_id)).map((r) => <Person key={r.contact_id} id={r.contact_id} total={r.total} late={r.late} />)}</div>
          </>
        )}
        {tab === 'personnes' && (
          <>
            {contacts.length === 0 && <Empty icon="👥" text="Les personnes s'ajoutent toutes seules quand tu notes une vente, un prêt ou un emprunt." />}
            <div>{contacts.filter((c) => match(c.id)).map((c) => <Person key={c.id} id={c.id} />)}</div>
          </>
        )}
      </div>
    </div>
  )
}
