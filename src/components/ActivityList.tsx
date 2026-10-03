import { useMemo } from 'react'
import type { Activity } from '../lib/activity'
import { dayLabel, fmt } from '../lib/format'
import { useHidden } from '../lib/prefs'
import { IconTile } from './ui'
import { useForms } from './FormHost'

/** Liste d'opérations groupées par jour. */
export function ActivityList({ items }: { items: Activity[] }) {
  const { open } = useForms()
  const [hidden] = useHidden()
  const groups = useMemo(() => {
    const g = new Map<string, Activity[]>()
    for (const a of items) { if (!g.has(a.date)) g.set(a.date, []); g.get(a.date)!.push(a) }
    return [...g.entries()]
  }, [items])
  return (
    <div className="space-y-5">
      {groups.map(([day, list]) => (
        <div key={day}>
          <p className="mb-1 text-xs text-ink-muted">{dayLabel(day)}</p>
          {list.map((a) => (
            <button key={a.key} onClick={() => open(a.open)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
              <IconTile name={a.icon} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                {a.sub && <p className="truncate text-xs text-ink-muted">{a.sub}</p>}
              </div>
              <span className={`tabular shrink-0 font-semibold ${a.tone === 'in' ? 'text-emerald-600' : a.tone === 'neutral' ? 'text-ink-muted' : ''}`}>
                {hidden ? '••••' : `${a.tone === 'in' ? '+' : a.tone === 'out' ? '−' : ''}${fmt(a.amount, 'Ar')}`}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
