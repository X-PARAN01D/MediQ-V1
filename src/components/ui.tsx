import { useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { IconX, IconChevronD, IconAlertTri, IconInfo } from './icons'
import { useLang } from '../i18n'

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'emergency'
  size?: 'sm' | 'md' | 'lg'
}
export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white disabled:bg-slate-300',
    secondary: 'bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-ink-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-brand-700 hover:bg-brand-50',
    emergency: 'bg-red-600 hover:bg-red-700 text-white',
  }[variant]
  const s = {
    sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2.5 text-[15px]', lg: 'px-5 py-3 text-base',
  }[size]
  return <button className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`} {...rest} />
}

/* ---------- Fields ---------- */
export function Field({ label, hint, error, children, required }: {
  label: string; hint?: string; error?: string; children: ReactNode; required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-ink-700 mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-400 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition disabled:bg-slate-50 disabled:text-ink-400'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[88px] resize-y ${props.className || ''}`} />
}
export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${inputCls} appearance-none pr-9 ${props.className || ''}`}>{children}</select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"><IconChevronD size={18} /></span>
    </div>
  )
}

/* ---------- Card / sections ---------- */
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border border-slate-100 shadow-card ${onClick ? 'cursor-pointer active:scale-[0.99] transition' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[15px] font-semibold text-ink-900 tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Badges & pills ---------- */
export type Band = 'NOR' | 'MOD' | 'EMR'

export function BandPill({ band, size = 'md' }: { band: Band; size?: 'sm' | 'md' }) {
  const c = {
    NOR: 'bg-green-50 text-green-800 border-green-200',
    MOD: 'bg-amber-50 text-amber-800 border-amber-200',
    EMR: 'bg-red-50 text-red-800 border-red-200',
  }[band]
  const dot = { NOR: 'bg-green-600', MOD: 'bg-amber-500', EMR: 'bg-red-600' }[band]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${c} ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{band}
    </span>
  )
}

export function TokenPill({ code, band }: { code: string; band: Band }) {
  const c = {
    NOR: 'bg-green-600', MOD: 'bg-amber-500', EMR: 'bg-red-600',
  }[band]
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[13px] font-bold tracking-wide text-white ${c}`}>
      {code}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    reserved: 'bg-slate-100 text-slate-700',
    active: 'bg-brand-50 text-brand-700',
    completed: 'bg-green-50 text-green-800',
    revoked: 'bg-red-50 text-red-700',
    pending: 'bg-amber-50 text-amber-800',
    approved: 'bg-green-50 text-green-800',
    rejected: 'bg-red-50 text-red-700',
    verified: 'bg-green-50 text-green-800',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink-900/45" onClick={onClose} />
      <div className={`relative bg-white w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-3xl shadow-pop max-h-[92vh] overflow-y-auto nice-scroll fade-up`}>
        <div className="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-ink-400 hover:text-ink-700" aria-label="Close">
            <IconX size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Misc ---------- */
export function EmptyState({ icon, title, hint, action }: {
  icon?: ReactNode; title: string; hint?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      {icon && <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">{icon}</div>}
      <p className="font-medium text-ink-900">{title}</p>
      {hint && <p className="text-sm text-ink-500 mt-1 max-w-[260px]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-500 text-sm py-6 justify-center">
      <span className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
      {label}
    </div>
  )
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn'; children: ReactNode }) {
  const c = kind === 'warn'
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-brand-50 border-brand-100 text-ink-700'
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed ${c}`}>
      <span className="shrink-0 mt-0.5">{kind === 'warn' ? <IconAlertTri size={16} /> : <IconInfo size={16} />}</span>
      <div>{children}</div>
    </div>
  )
}

export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition ${value === o.value ? 'bg-white shadow-card text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 44, photo }: { name: string; size?: number; photo?: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover bg-brand-50" />
  return (
    <div className="rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5">
      <span className={`w-10 h-[22px] rounded-full p-[3px] transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`} />
      </span>
      {label && <span className="text-sm text-ink-700">{label}</span>}
    </button>
  )
}

export function DemoBadge() {
  const { t } = useLang()
  return (
    <span title={t.common.demoModeHint}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />{t.common.demoMode}
    </span>
  )
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose, danger }: {
  open: boolean; title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onClose: () => void; danger?: boolean
}) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-700 leading-relaxed">{body}</p>
      <div className="flex gap-3 mt-5">
        <Button variant="secondary" className="flex-1" onClick={onClose}>{t.common.cancel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} className="flex-1" disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false); onClose() } }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
