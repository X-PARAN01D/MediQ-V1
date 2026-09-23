import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { store } from '../lib/store'
import { isDemo } from '../lib/config'
import { DemoBadge, Avatar } from './ui'
import {
  IconHome, IconCalendar, IconFile, IconChat, IconUser, IconChart,
  IconClipboard, IconShieldCheck, IconBell, IconMic, IconPhone,
} from './icons'
import type { AppNotification, Role } from '../lib/types'

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-[12px] font-semibold">
      {(['en', 'hi'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={`px-2 py-0.5 rounded-md ${lang === l ? 'bg-white shadow-card text-ink-900' : 'text-ink-400'}`}>
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  )
}

function navFor(role: Role | undefined) {
  if (role === 'doctor') return [
    { to: '/doctor', label: 'nav.dashboard', icon: <IconChart size={21} /> },
    { to: '/doctor/queue', label: 'nav.queue', icon: <IconClipboard size={21} /> },
    { to: '/messages', label: 'nav.messages', icon: <IconChat size={21} /> },
    { to: '/profile', label: 'nav.profile', icon: <IconUser size={21} /> },
  ]
  if (role === 'admin') return [
    { to: '/admin', label: 'nav.dashboard', icon: <IconChart size={21} /> },
    { to: '/admin/verify', label: 'nav.verify', icon: <IconShieldCheck size={21} /> },
    { to: '/admin/analytics', label: 'nav.analytics', icon: <IconFile size={21} /> },
    { to: '/profile', label: 'nav.profile', icon: <IconUser size={21} /> },
  ]
  return [
    { to: '/home', label: 'nav.home', icon: <IconHome size={21} /> },
    { to: '/appointments', label: 'nav.appointments', icon: <IconCalendar size={21} /> },
    { to: '/records', label: 'nav.records', icon: <IconFile size={21} /> },
    { to: '/messages', label: 'nav.messages', icon: <IconChat size={21} /> },
    { to: '/profile', label: 'nav.profile', icon: <IconUser size={21} /> },
  ]
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const items = navFor(user?.role)

  useEffect(() => {
    if (!user) return
    return store().col<AppNotification>('notifications').subscribe(docs => {
      setUnread(docs.filter(n => n.userId === user.id && !n.read).length)
    }, n => n.userId === user.id, [{ field: 'userId', op: '==', value: user.id }])
  }, [user?.id])

  const label = (key: string) => key.split('.').reduce((o: any, k) => o?.[k], t) as string

  return (
    <div className="min-h-dvh flex flex-col max-w-[520px] mx-auto bg-[#f5f8fb] sm:border-x sm:border-slate-100">
      {/* header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <img src="/logo.png" alt="MediQ" className="w-9 h-9 rounded-full object-cover" />
          <div className="leading-tight">
            <p className="font-bold text-[17px] tracking-tight text-ink-900">MediQ</p>
          </div>
          {isDemo && <DemoBadge />}
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            {user && (
              <button onClick={() => navigate('/messages')} className="relative p-2 text-ink-500 hover:text-ink-800" aria-label="Messages">
                <IconBell size={20} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
            {user && <Avatar name={user.name} size={32} />}
          </div>
        </div>
      </header>

      {/* content */}
      <main className="flex-1 px-4 pt-4 pb-32">{children}</main>

      {/* floating actions */}
      {user?.role === 'patient' && (
        <div className="fixed bottom-[76px] right-4 z-40 flex flex-col items-end gap-2.5 max-w-[520px]">
          <button onClick={() => navigate('/emergency')}
            className="emergency-pulse w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-pop"
            aria-label="Emergency">
            <IconPhone size={20} />
          </button>
          <button onClick={() => navigate('/saathi')}
            className="saathi-fab w-16 h-16 rounded-full overflow-hidden shadow-pop ring-2 ring-white"
            aria-label="SAATHI">
            <img src="/saathi-icon.png" alt="" className="w-full h-full object-cover" />
          </button>
        </div>
      )}

      {/* bottom nav */}
      {user && (
        <nav className="fixed bottom-0 z-40 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-white border-t border-slate-100"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex">
            {items.map(it => (
              <NavLink key={it.to} to={it.to}
                className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-ink-400'}`}>
                {it.icon}{label(it.label)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

/** Centered narrow page for auth / landing (no app chrome). */
export function PlainShell({ children }: { children: ReactNode }) {
  const { lang, setLang } = useLang()
  return (
    <div className="min-h-dvh bg-white">
      <div className="max-w-[520px] mx-auto px-5 py-4 min-h-dvh flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MediQ" className="w-10 h-10 rounded-full object-cover" />
            <p className="font-bold text-lg tracking-tight">MediQ</p>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && <DemoBadge />}
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-[12px] font-semibold">
              {(['en', 'hi'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-md ${lang === l ? 'bg-white shadow-card text-ink-900' : 'text-ink-400'}`}>
                  {l === 'en' ? 'English' : 'हिंदी'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  )
}
