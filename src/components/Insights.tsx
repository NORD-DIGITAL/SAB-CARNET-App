import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react'
import type { Insight } from '../lib/insights'
import { useForms } from './FormHost'

const TONE = {
  good: { cls: 'border-emerald-200 bg-emerald-50', Icon: CheckCircle2, ic: 'text-emerald-600' },
  warn: { cls: 'border-amber-200 bg-amber-50', Icon: Lightbulb, ic: 'text-amber-600' },
  bad: { cls: 'border-red-200 bg-red-50', Icon: AlertTriangle, ic: 'text-red-600' },
  info: { cls: 'border-sky-200 bg-sky-50', Icon: Info, ic: 'text-sky-600' },
}

/** Analyses automatiques : défilent sur mobile, en grille sur ordinateur. */
export function Insights({ items }: { items: Insight[] }) {
  const forms = useForms()
  if (!items.length) return null
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted"><Lightbulb size={14} /> L'essentiel</p>
      <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3">
        {items.map((it) => {
          const t = TONE[it.tone]
          const body = (
            <>
              <t.Icon size={20} className={`mt-0.5 shrink-0 ${t.ic}`} />
              <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{it.title}</span><span className="mt-0.5 block text-xs leading-snug text-ink-soft">{it.text}</span></span>
            </>
          )
          const cls = `flex w-[16.5rem] shrink-0 snap-start gap-2.5 rounded-2xl border p-3 text-left lg:w-auto ${t.cls}`
          return it.open
            ? <button key={it.key} onClick={() => forms.open(it.open!)} className={`${cls} transition hover:shadow-md`}>{body}</button>
            : <div key={it.key} className={cls}>{body}</div>
        })}
      </div>
    </section>
  )
}
