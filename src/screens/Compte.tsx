import { useEffect, useState } from 'react'
import { ChevronRight, CreditCard, Fingerprint, FolderTree, Inbox, Lightbulb, LogOut, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import { useBadge } from '../lib/inbox'
import { APP_LABEL } from '../lib/version'
import { THEMES, SIZES, applySize, getSize, setUserTheme, useUserTheme } from '../lib/theme'
import { biometricAvailable, biometricEnabled, disableBiometric, enableBiometric } from '../lib/lock'
import type { Category, CatModule } from '../lib/types'
import { BareIcon, ByNord, Header, Row, Sheet } from '../components/ui'
import { ErrorBox, FormActions, chip } from '../components/forms'
import { SubscriptionCard } from './GoCode'
import { Brand } from './Auth'

export type SubPage = 'profil' | 'moyens' | 'categories' | 'remarques' | 'inbox' | 'users' | 'confidentialite'
export const SUB_TITLES: Record<SubPage, string> = {
  profil: 'Mon profil', moyens: 'Cartes et caisses', categories: 'Catégories de dépenses', remarques: 'Remarques & suggestions',
  inbox: 'Boîte de réception', users: 'Utilisateurs', confidentialite: 'Politique de confidentialité',
}

/** Onglet « Compte » : abonnement, réglages, gestion. */
export default function CompteScreen({ open }: { open: (p: SubPage) => void }) {
  const { session, profile, isAdmin } = useData()
  const inboxN = useBadge()
  const me = userInfo(session, profile)
  const [confirmOut, setConfirmOut] = useState(false)
  const ico = (I: LucideIcon) => <I size={26} strokeWidth={1.6} />

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <Header title="Mon compte" />
      <div className="flex items-center gap-4 border-b border-neutral-100 px-5 pb-6 pt-2">
        <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-semibold text-white">{me.initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{me.name}</p>
          {me.phone && <p className="tabular text-ink-soft">{me.phone}</p>}
          <p className="truncate text-sm text-ink-muted">{me.email}</p>
          <button onClick={() => open('profil')} className="pill mt-2 bg-sun-300">Modifier le profil</button>
        </div>
      </div>
      <SubscriptionCard onAdmin={() => open('users')} />
      <ThemeRow />
      <SizeRow />
      <div>
        <Row icon={ico(CreditCard)} label="Cartes et caisses" sub="Cartes bancaires, espèces perso, caisse business, Mobile Money" onClick={() => open('moyens')} />
        <Row icon={ico(FolderTree)} label="Catégories de dépenses" onClick={() => open('categories')} />
        <BiometricRow />
        <Row icon={ico(Lightbulb)} label="Remarque / suggestion" sub="Proposer une amélioration" onClick={() => open('remarques')} />
        {isAdmin && <Row icon={ico(Users)} label="Utilisateurs" sub="Comptes, jours restants, Go Codes (admin)" onClick={() => open('users')} />}
        <Row icon={ico(Inbox)} label="Boîte de réception" sub={isAdmin ? 'Remarques reçues · messages aux utilisateurs' : inboxN ? `${inboxN} message${inboxN > 1 ? 's' : ''} non lu${inboxN > 1 ? 's' : ''}` : "Messages de l'équipe NORD DIGITAL"} onClick={() => open('inbox')}
          right={<span className="flex items-center gap-2">{inboxN > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{inboxN}</span>}<ChevronRight size={22} className="text-neutral-400" /></span>} />
        <Row icon={ico(ShieldCheck)} label="Politique de confidentialité" sub="Tes données et tes droits" onClick={() => open('confidentialite')} />
        <Row icon={<LogOut size={26} strokeWidth={1.6} />} label={confirmOut ? 'Toucher encore pour confirmer' : 'Se déconnecter'} danger
          onClick={() => (confirmOut ? supabase.auth.signOut() : setConfirmOut(true))} />
      </div>
      <ByNord className="pt-6" />
      <p className="pb-8 pt-1 text-center text-xs text-ink-muted">SAB-CARNET · version {APP_LABEL}</p>
    </div>
  )
}

function BiometricRow() {
  const { session } = useData()
  const uid = session!.user.id
  const [avail, setAvail] = useState<boolean | null>(null)
  const [on, setOn] = useState(biometricEnabled(uid))
  const [msg, setMsg] = useState('')
  useEffect(() => { biometricAvailable().then(setAvail) }, [])
  const toggle = async () => {
    setMsg('')
    if (on) { disableBiometric(uid); setOn(false); return }
    const e = await enableBiometric(uid, session!.user.email ?? '')
    if (e) setMsg(e); else setOn(true)
  }
  return (
    <Row icon={<Fingerprint size={26} strokeWidth={1.6} />} label="Connexion par empreinte / visage / code"
      sub={msg || (avail === false ? 'Non disponible sur cet appareil ou ce navigateur' : on ? 'Activée · demandée à chaque ouverture' : 'Désactivée')}
      onClick={avail ? toggle : undefined}
      right={<span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-sun-500' : 'bg-neutral-300'} ${avail === false ? 'opacity-40' : ''}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>} />
  )
}

function ThemeRow() {
  const { session } = useData()
  const uid = session!.user.id
  const t = useUserTheme(uid)
  return (
    <div className="border-b border-neutral-100 px-5 py-4">
      <p className="mb-2 text-sm text-ink-muted">Thème de couleur</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((x) => (
          <button key={x.id} onClick={() => setUserTheme(uid, x.id)}
            className={`flex items-center justify-center gap-2 rounded-full border py-2 text-sm transition ${t === x.id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: x.id === 'tropique' ? 'linear-gradient(135deg,#FB923C,#F43F5E,#C026D3)' : x.id === 'ocean' ? 'linear-gradient(135deg,#4F46E5,#0EA5E9,#22D3EE)' : x.color }} />{x.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SizeRow() {
  const [v, setV] = useState(getSize())
  return (
    <div className="border-b border-neutral-100 px-5 py-4 lg:hidden">
      <p className="mb-2 text-sm text-ink-muted">Taille d'affichage</p>
      <div className="grid grid-cols-3 gap-2">
        {SIZES.map((x) => (
          <button key={x.id} onClick={() => { applySize(x.id); setV(x.id) }}
            className={`rounded-2xl border px-2 py-2 text-center transition ${v === x.id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
            <span className={`block font-semibold leading-none ${x.id === 'normal' ? 'text-xl' : x.id === 'compact' ? 'text-lg' : 'text-base'}`}>Aa</span>
            <span className="mt-1 block text-sm">{x.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* =====================================================================
   Profil
   ===================================================================== */
const PREFIXES = ['032', '033', '034', '036', '037', '038']
function useProfileForm() {
  const { session, profile } = useData()
  const md = (session?.user.user_metadata ?? {}) as { full_name?: string; phone_local?: string }
  const digits = (md.phone_local ?? '').replace(/\D/g, '')
  const [name, setName] = useState(profile?.full_name ?? md.full_name ?? '')
  const [prefix, setPrefix] = useState(digits.slice(0, 3) || '034')
  const [phone, setPhone] = useState(digits.slice(3))
  const save = async () => {
    const { error } = await supabase.from('profiles').upsert({ id: session!.user.id, full_name: name.trim(), onboarded: true, updated_at: new Date().toISOString() })
    if (error) return error.message
    const d = phone.replace(/\D/g, '')
    await supabase.auth.updateUser({ data: { full_name: name.trim(), ...(d.length === 7 ? { phone: `+261${prefix.slice(1)}${d}`, phone_local: `${prefix} ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` } : {}) } })
    return null
  }
  const fields = (
    <div className="space-y-4">
      <div><label className="label" htmlFor="pf-name">Nom et prénom</label><input id="pf-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div>
        <label className="label" htmlFor="pf-phone">Téléphone</label>
        <div className="flex gap-2">
          <select aria-label="Préfixe" className="input w-[6.5rem]" value={prefix} onChange={(e) => setPrefix(e.target.value)}>{PREFIXES.map((p) => <option key={p}>{p}</option>)}</select>
          <input id="pf-phone" className="input tabular flex-1 tracking-wider" inputMode="numeric" placeholder="12 345 67" value={phone}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 7); setPhone([d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join(' ')) }} />
        </div>
      </div>
    </div>
  )
  return { name, save, fields }
}

/** Écran affiché une seule fois après l'inscription. */
export function ProfileSetup() {
  const { reloadProfile } = useData()
  const f = useProfileForm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    if (!f.name.trim()) return setErr('Ton nom est obligatoire.')
    setBusy(true); const e = await f.save(); setBusy(false)
    if (e) setErr(e); else await reloadProfile()
  }
  return (
    <div className="pt-safe pb-safe mx-auto min-h-full max-w-md bg-white px-6 py-8">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">Bienvenue 👋</h1>
      <p className="mb-6 mt-1 text-ink-muted">Vérifie ton nom et ton numéro. Tes caisses (espèces perso, caisse business, Mobile Money) et tes catégories seront créées automatiquement.</p>
      {f.fields}
      <div className="mt-4"><ErrorBox msg={err} /></div>
      <button disabled={busy} onClick={go} className="btn-primary mt-8 w-full text-lg">Commencer</button>
      <ByNord className="mt-6" />
    </div>
  )
}

export function ProfilePage() {
  const { session, reloadProfile } = useData()
  const f = useProfileForm()
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!f.name.trim()) return setMsg({ t: 'err', s: 'Ton nom est obligatoire.' })
    setBusy(true); const e = await f.save(); setBusy(false)
    setMsg(e ? { t: 'err', s: e } : { t: 'ok', s: 'Profil enregistré.' })
    if (!e) await reloadProfile()
  }
  return (
    <div className="space-y-5 px-5 pb-10 pt-2">
      {f.fields}
      <div><p className="label">Email</p><p className="truncate rounded-2xl bg-neutral-50 px-4 py-3.5 text-ink-soft">{session?.user.email}</p></div>
      {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
      <button disabled={busy} onClick={save} className="btn-primary w-full">Enregistrer</button>
      <p className="flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck size={16} className="shrink-0" /> Tes données ne sont visibles que par toi.</p>
    </div>
  )
}

/* =====================================================================
   Catégories de dépenses
   ===================================================================== */
const MODULES: [CatModule, string][] = [['general', 'Général'], ['sport', 'Sport'], ['beaute', 'Beauté'], ['frais_bancaires', 'Frais bancaires']]

export function CategoriesPage() {
  const { categories, expenses } = useData()
  const [edit, setEdit] = useState<{ item: Category | null } | null>(null)
  return (
    <div className="px-5 pb-10 pt-2">
      {categories.map((c) => {
        const n = expenses.filter((e) => e.category_id === c.id).length
        return (
          <Row key={c.id} icon={<BareIcon name={c.name} emoji={c.icon ?? undefined} size={26} />} label={c.name}
            sub={`${MODULES.find(([k]) => k === c.module)?.[1]} · ${n} dépense${n > 1 ? 's' : ''}`} onClick={() => setEdit({ item: c })} />
        )
      })}
      <button onClick={() => setEdit({ item: null })} className="btn-primary mt-4 w-full"><Plus size={20} /> Nouvelle catégorie</button>
      <CategoryForm open={!!edit} item={edit?.item ?? null} onClose={() => setEdit(null)} />
    </div>
  )
}

function CategoryForm({ open, item, onClose }: { open: boolean; item: Category | null; onClose: () => void }) {
  const { reload, expenses } = useData()
  const [name, setName] = useState('')
  const [mod, setMod] = useState<CatModule>('general')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setName(item?.name ?? ''); setMod(item?.module ?? 'general') } }, [open, item])
  const save = async () => {
    if (!name.trim()) return setErr('Indique un nom.')
    setBusy(true)
    const row = { name: name.trim(), module: mod }
    const { error } = item ? await supabase.from('categories').update(row).eq('id', item.id) : await supabase.from('categories').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  const remove = async () => { setBusy(true); await supabase.from('categories').delete().eq('id', item!.id); setBusy(false); await reload(); onClose() }
  const used = item ? expenses.filter((e) => e.category_id === item.id).length : 0
  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
      <div className="space-y-4">
        <div className="flex items-center gap-3"><BareIcon name={name || 'autre'} size={30} /><input className="input" aria-label="Nom" placeholder="Ex : Ecolage, Église, Cadeaux" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">{MODULES.map(([k, l]) => <button key={k} type="button" onClick={() => setMod(k)} className={chip(mod === k)}>{l}</button>)}</div>
        {item && used > 0 && <p className="flex items-center gap-2 text-xs text-ink-muted"><Trash2 size={14} /> Si tu la supprimes, ses {used} dépense{used > 1 ? 's' : ''} resteront, sans catégorie.</p>}
        <ErrorBox msg={err} />
        <FormActions busy={busy} onSave={save} onDelete={item ? remove : undefined} />
      </div>
    </Sheet>
  )
}
