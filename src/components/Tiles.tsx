import type { LucideIcon } from 'lucide-react'

export type TileItem<T extends string> = { k: T; label: string; Icon: LucideIcon; value?: string; badge?: string; alert?: boolean }

/** Sections en petites cases (au lieu d'onglets) : un coup d'œil sur chaque partie avant d'y entrer. */
export function SectionTiles<T extends string>({ items, value, onChange, cols = 'grid-cols-3 sm:grid-cols-5' }: { items: TileItem<T>[]; value: T; onChange: (k: T) => void; cols?: string }) {
  return (
    <div className={`grid gap-2 ${cols}`}>
      {items.map(({ k, label, Icon, value: v, badge, alert }) => {
        const on = k === value
        return (
          <button key={k} onClick={() => onChange(k)} aria-pressed={on}
            className={`relative flex h-[5.75rem] flex-col justify-between rounded-2xl border p-2.5 text-left transition active:scale-[.97] 3xl:h-[6.5rem] ${on ? 'border-ink bg-ink text-white shadow-lg' : 'border-cream-line bg-cream-tile hover:border-sun-300'}`}>
            <Icon size={22} strokeWidth={1.7} className={on ? 'text-sun-400' : ''} />
            {badge && <span className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none ${alert ? 'bg-red-500 text-white' : on ? 'bg-sun-500 text-ink' : 'bg-white text-ink'}`}>{badge}</span>}
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium leading-tight">{label}</span>
              {v && <span className={`tabular block truncate text-[0.6875rem] ${on ? 'text-white/70' : 'text-ink-muted'}`}>{v}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Mini barre horizontale (répartition, progression). */
export function Bar({ pct, color = 'bg-sun-500' }: { pct: number; color?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
}
