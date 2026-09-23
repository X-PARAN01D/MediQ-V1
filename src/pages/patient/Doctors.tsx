import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { Card, Input, EmptyState, Avatar } from '../../components/ui'
import { IconSearch, IconShieldCheck, IconChevronR, IconSteth } from '../../components/icons'
import type { User } from '../../lib/types'

export default function Doctors() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [doctors, setDoctors] = useState<(User & { id: string })[]>([])
  const [q, setQ] = useState(params.get('q') || '')

  const activeSpec = params.get('spec') || ''

  useEffect(() => {
    // Public directory: verified doctors only (security rules allow this query).
    return store().col<User>('users').subscribe(docs => {
      setDoctors(docs.filter(d => d.role === 'doctor' && d.verification === 'approved' && d.verified))
    }, undefined, [
      { field: 'role', op: '==', value: 'doctor' },
      { field: 'verified', op: '==', value: true },
    ])
  }, [])

  const specs = useMemo(() => [...new Set(doctors.map(d => d.specialization || '').filter(Boolean))], [doctors])

  const filtered = doctors.filter(d => {
    if (activeSpec && d.specialization !== activeSpec) return false
    if (q.trim()) {
      const hay = `${d.name} ${d.specialization} ${d.clinic}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  const setSpec = (s: string) => {
    const next = new URLSearchParams(params)
    if (s) next.set('spec', s); else next.delete('spec')
    setParams(next)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.doctors.title}</h1>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"><IconSearch size={18} /></span>
        <Input className="pl-10" placeholder={t.doctors.searchPh} value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {specs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto nice-scroll pb-1">
          <button onClick={() => setSpec('')}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border ${!activeSpec ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-ink-700'}`}>
            {lang === 'hi' ? 'सभी' : 'All'}
          </button>
          {specs.map(s => (
            <button key={s} onClick={() => setSpec(s)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border ${activeSpec === s ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-ink-700'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<IconSteth size={22} />} title={t.doctors.title} hint={t.doctors.noSlots} /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <Card key={d.id} className="p-4" onClick={() => navigate(`/doctors/${d.id}`)}>
              <div className="flex items-start gap-3">
                <Avatar name={d.name} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-ink-900 truncate">{d.name}</p>
                    <span className="inline-flex items-center gap-0.5 text-green-700 text-[11px] font-semibold shrink-0">
                      <IconShieldCheck size={14} /> {t.doctors.verified}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-500">{d.specialization} · {d.experience} {t.doctors.experience}</p>
                  <p className="text-[13px] text-ink-500 truncate">{d.clinic}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px]">
                    {d.fee != null && <span className="font-semibold text-ink-900">₹{d.fee}</span>}
                    {d.availability && <span className="text-ink-400 truncate">{d.availability}</span>}
                  </div>
                </div>
                <IconChevronR size={18} className="text-ink-400 shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
