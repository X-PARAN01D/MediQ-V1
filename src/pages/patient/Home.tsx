import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { queuePosition } from '../../lib/tokens'
import { Button, Card, SectionTitle, TokenPill, BandPill, StatusBadge, Input, EmptyState } from '../../components/ui'
import { IconSteth, IconSearch, IconPhone, IconChevronR, IconCalendar, IconShieldCheck } from '../../components/icons'
import { fmtDate, type Token, type Appointment } from '../../lib/types'

const SPECIALTIES = ['General Physician', 'Pediatrician', 'Gynecologist', 'Orthopedic', 'Dermatologist']

function istHour(): number {
  return Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
}

export default function Home() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeToken, setActiveToken] = useState<(Token & { id: string }) | null>(null)
  const [queue, setQueue] = useState<{ ahead: number; estWaitMin: number } | null>(null)
  const [upcoming, setUpcoming] = useState<(Appointment & { id: string })[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!user) return
    const unsub = store().col<Token>('tokens').subscribe(async docs => {
      const mine = docs
        .filter(d => d.patientId === user.id && (d.status === 'reserved' || d.status === 'active'))
        .sort((a, b) => b.createdAt - a.createdAt)
      const top = mine[0] || null
      setActiveToken(top)
      if (top) setQueue(await queuePosition(top))
      else setQueue(null)
    }, d => d.patientId === user.id && (d.status === 'reserved' || d.status === 'active'),
      [{ field: 'patientId', op: '==', value: user.id }])
    const unsub2 = store().col<Appointment>('appointments').subscribe(docs => {
      setUpcoming(
        docs.filter(d => d.patientId === user.id && d.status === 'upcoming')
          .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot))
          .slice(0, 2)
      )
    }, d => d.patientId === user.id, [{ field: 'patientId', op: '==', value: user.id }])
    return () => { unsub(); unsub2() }
  }, [user?.id])

  const h = istHour()
  const greet = h < 12 ? t.home.greetingMorning : h < 17 ? t.home.greetingAfternoon : t.home.greetingEvening

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">{greet}, {user?.name.split(' ')[0]}</h1>
        <p className="text-sm text-ink-500 mt-0.5">{t.home.howFeeling}</p>
      </div>

      {/* primary CTA */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
            <IconSteth size={24} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink-900">{t.home.startCheckup}</p>
            <p className="text-[13px] text-ink-500">{t.landing.step1d}</p>
          </div>
        </div>
        <Button className="w-full mt-4" size="lg" onClick={() => navigate('/intake')}>
          {t.home.startCheckup} <IconChevronR size={18} />
        </Button>
      </Card>

      {/* my tokens */}
      <div>
        <SectionTitle action={
          <button onClick={() => navigate('/tokens')} className="text-[13px] font-medium text-brand-700">{t.common.viewAll}</button>
        }>{t.home.myTokens}</SectionTitle>
        {activeToken ? (
          <Card className="p-4" onClick={() => navigate('/tokens')}>
            <div className="flex items-center gap-3">
              <TokenPill code={activeToken.code} band={activeToken.band} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <BandPill band={activeToken.band} size="sm" />
                  <StatusBadge status={activeToken.status === 'reserved' ? t.tokens.st_reserved : t.tokens.st_active} />
                </div>
                {queue && (
                  <p className="text-[13px] text-ink-500 mt-1">
                    {queue.ahead} {t.tokens.queuePos} · {queue.estWaitMin} {t.tokens.mins} {t.tokens.estWait}
                  </p>
                )}
              </div>
              <IconChevronR size={18} className="text-ink-400" />
            </div>
          </Card>
        ) : (
          <Card><EmptyState title={t.home.noActiveToken} hint={t.home.noActiveTokenHint} /></Card>
        )}
      </div>

      {/* find doctor */}
      <div>
        <SectionTitle>{t.home.findDoctor}</SectionTitle>
        <div className="relative mb-3">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"><IconSearch size={18} /></span>
          <Input className="pl-10" placeholder={t.doctors.searchPh} value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && q.trim()) navigate(`/doctors?q=${encodeURIComponent(q.trim())}`) }} />
        </div>
        <div className="flex gap-2 overflow-x-auto nice-scroll pb-1">
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => navigate(`/doctors?spec=${encodeURIComponent(s)}`)}
              className="shrink-0 px-3.5 py-2 rounded-full bg-white border border-slate-200 text-[13px] font-medium text-ink-700 hover:border-brand-400 hover:text-brand-700">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* upcoming */}
      <div>
        <SectionTitle action={
          <button onClick={() => navigate('/appointments')} className="text-[13px] font-medium text-brand-700">{t.common.viewAll}</button>
        }>{t.home.upcoming}</SectionTitle>
        {upcoming.length === 0 ? (
          <Card><EmptyState icon={<IconCalendar size={22} />} title={t.home.noUpcoming} /></Card>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map(a => (
              <Card key={a.id} className="p-4 flex items-center gap-3" onClick={() => navigate('/appointments')}>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <IconCalendar size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate">{a.doctorName}</p>
                  <p className="text-[13px] text-ink-500">{fmtDate(new Date(a.date + 'T00:00:00').getTime(), lang)} · {a.slot}</p>
                </div>
                <IconChevronR size={18} className="text-ink-400" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* emergency */}
      <Card className="p-4 border-red-200 bg-red-50/60" onClick={() => navigate('/emergency')}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
            <IconPhone size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-800">{t.home.emergency}</p>
            <p className="text-[13px] text-red-700/80">{t.home.emergencyHint}</p>
          </div>
          <IconChevronR size={18} className="text-red-400" />
        </div>
      </Card>

      <div className="flex items-center justify-center gap-1.5 text-xs text-ink-400 pb-2">
        <IconShieldCheck size={14} />
        <span>{t.saathi.disclaimer}</span>
      </div>
    </div>
  )
}
