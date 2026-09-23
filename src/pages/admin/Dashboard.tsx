import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { Card, SectionTitle, TokenPill, StatusBadge, EmptyState, Spinner } from '../../components/ui'
import { BarChart, DonutChart, Sparkline } from '../../components/charts'
import { IconActivity } from '../../components/icons'
import { fmtTime, type Token, type User, type Band } from '../../lib/types'

const PER_PATIENT_MIN: Record<Band, number> = { EMR: 5, MOD: 10, NOR: 12 }
const BAND_COLORS: Record<Band, string> = { NOR: '#15803d', MOD: '#d97706', EMR: '#dc2626' }

const dayKey = (ts: number) =>
  new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function Dashboard() {
  const { t } = useLang()
  const [tokens, setTokens] = useState<(Token & { id: string })[]>([])
  const [users, setUsers] = useState<(User & { id: string })[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const un1 = store().col<Token>('tokens').subscribe(docs => { setTokens(docs); setLoaded(true) })
    const un2 = store().col<User>('users').subscribe(setUsers)
    return () => { un1(); un2() }
  }, [])

  const m = useMemo(() => {
    const today = dayKey(Date.now())
    const todayT = tokens.filter(x => dayKey(x.createdAt) === today)
    const active = tokens.filter(x => x.status === 'reserved' || x.status === 'active')

    // avg estimated wait across the current queue
    const byBand: Record<Band, (Token & { id: string })[]> = { EMR: [], MOD: [], NOR: [] }
    active.forEach(x => byBand[x.band].push(x))
    const waits: number[] = []
    ;(['EMR', 'MOD', 'NOR'] as Band[]).forEach(b => {
      byBand[b].sort((a, b2) => a.createdAt - b2.createdAt).forEach((x, i) => waits.push(i * PER_PATIENT_MIN[b]))
    })
    const avgWait = waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : 0

    const bandCounts = (['NOR', 'MOD', 'EMR'] as Band[]).map(b => ({
      label: b, value: todayT.filter(x => x.band === b).length, color: BAND_COLORS[b],
    }))

    const dayKeys: string[] = []
    const last7: { label: string; value: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = dayKey(d.getTime())
      dayKeys.push(key)
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
      last7.push({ label, value: tokens.filter(x => dayKey(x.createdAt) === key).length })
    }

    const doctors = users.filter(u => u.role === 'doctor' && u.verification === 'approved')
    const docLoad = doctors.map(d => {
      const claimedToday = todayT.filter(x => x.doctorId === d.id).length
      const spark = dayKeys.map(k =>
        tokens.filter(x => x.doctorId === d.id && dayKey(x.claimedAt || x.createdAt) === k).length)
      return { d, claimedToday, spark }
    }).sort((a, b) => b.claimedToday - a.claimedToday)

    const verifiedCount = users.filter(u => u.role === 'doctor' && u.verification === 'approved').length
    const pendingCount = users.filter(u => u.role === 'doctor' && u.verification === 'pending').length
    const monitor = [...tokens].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)

    return { todayT, active, avgWait, bandCounts, last7, docLoad, verifiedCount, pendingCount, monitor }
  }, [tokens, users])

  if (!loaded) return <Spinner />

  const stat = (value: string | number, label: string) => (
    <Card className="p-3.5 text-center">
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-500 mt-0.5">{label}</p>
    </Card>
  )

  return (
    <div className="space-y-5">
      <SectionTitle>{t.admin.overview}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 -mt-2">
        {stat(m.todayT.length, t.admin.tokensToday)}
        {stat(m.active.length, t.tokens.active)}
        {stat(`${m.avgWait} ${t.tokens.mins}`, t.admin.avgWait)}
        {stat(`${m.verifiedCount}${m.pendingCount ? ` (+${m.pendingCount})` : ''}`, t.doctor.verification)}
      </div>

      <Card className="p-4">
        <SectionTitle>{t.admin.byBand}</SectionTitle>
        <DonutChart data={m.bandCounts} />
      </Card>

      <Card className="p-4">
        <SectionTitle>{t.admin.tokensToday} · {t.admin.last7d}</SectionTitle>
        <BarChart data={m.last7} />
      </Card>

      <div>
        <SectionTitle>{t.admin.doctorLoad}</SectionTitle>
        {m.docLoad.length === 0 ? (
          <Card><EmptyState title={t.common.none} /></Card>
        ) : (
          <div className="space-y-2">
            {m.docLoad.map(({ d, claimedToday, spark }) => (
              <Card key={d.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900 text-[14px] truncate">{d.name}</p>
                  <p className="text-[12px] text-ink-400">{d.specialization} · {claimedToday} today</p>
                </div>
                <div className="ml-auto shrink-0"><Sparkline data={spark} width={110} height={36} /></div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>{t.admin.tokenMonitor}</SectionTitle>
        <Card className="divide-y divide-slate-50">
          {m.monitor.map(tk => (
            <div key={tk.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <TokenPill code={tk.code} band={tk.band} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{tk.patientName}</p>
                <p className="text-[11px] text-ink-400 inline-flex items-center gap-1">
                  <IconActivity size={11} />{fmtTime(tk.createdAt)}
                </p>
              </div>
              <span className="ml-auto"><StatusBadge status={tk.status} /></span>
            </div>
          ))}
          {m.monitor.length === 0 && <EmptyState title={t.doctor.empty} />}
        </Card>
      </div>
    </div>
  )
}
