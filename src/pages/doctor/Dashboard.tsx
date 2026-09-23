import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { claimToken, releaseToken } from '../../lib/tokens'
import {
  Button, Card, SectionTitle, BandPill, TokenPill, EmptyState, Spinner, Notice, SegmentedControl,
} from '../../components/ui'
import { IconClipboard, IconClock, IconAlertTri, IconVideo } from '../../components/icons'
import { fmtTime, fmtDuration, todayIST, dayStartIST, type Token, type Triage, type Appointment, type Band } from '../../lib/types'

type Filter = 'all' | 'EMR' | 'mine'

const bandRank: Record<Band, number> = { EMR: 0, MOD: 1, NOR: 2 }

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [tokens, setTokens] = useState<(Token & { id: string })[]>([])
  const [triages, setTriages] = useState<Map<string, Triage & { id: string }>>(new Map())
  const [apptCount, setApptCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const un1 = store().col<Token>('tokens').subscribe(
      docs => { setTokens(docs); setLoaded(true) },
      tk => tk.status === 'reserved' || tk.status === 'active',
      [{ field: 'createdAt', op: '>=', value: dayStartIST() }],
    )
    const un2 = store().col<Triage>('triages').subscribe(docs => {
      setTriages(new Map(docs.map(d => [d.id, d])))
    }, undefined, [{ field: 'createdAt', op: '>=', value: dayStartIST() }])
    const un3 = user ? store().col<Appointment>('appointments').subscribe(
      docs => setApptCount(docs.length),
      a => a.doctorId === user.id && a.status === 'upcoming' && a.date === todayIST(),
      [
        { field: 'doctorId', op: '==', value: user.id },
        { field: 'date', op: '==', value: todayIST() },
      ],
    ) : () => {}
    return () => { un1(); un2(); un3() }
  }, [user?.id])

  const verified = user?.verification === 'approved'

  const rows = useMemo(() => {
    let r = [...tokens]
    if (filter === 'EMR') r = r.filter(x => x.band === 'EMR')
    if (filter === 'mine') r = r.filter(x => x.doctorId === user?.id)
    return r.sort((a, b) => bandRank[a.band] - bandRank[b.band] || a.createdAt - b.createdAt)
  }, [tokens, filter, user?.id])

  const stats = useMemo(() => {
    const day = todayIST()
    const isToday = (ts: number) =>
      new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === day
    const claimedToday = tokens.filter(x => x.doctorId === user?.id && x.claimedAt && isToday(x.claimedAt)).length
    const done = tokens.filter(x => x.doctorId === user?.id && x.status === 'completed' && x.callDurationSec)
    const avg = done.length > 0 ? Math.round(done.reduce((s, x) => s + (x.callDurationSec || 0), 0) / done.length) : 0
    const emrOpen = tokens.filter(x => x.band === 'EMR').length
    return { claimedToday, avg, emrOpen }
  }, [tokens, user?.id])

  const doClaim = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!user || !verified || busyId) return
    setBusyId(id)
    try { await claimToken(id, user) } finally { setBusyId(null) }
  }

  const doRelease = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!user || busyId) return
    setBusyId(id)
    try { await releaseToken(id, user) } finally { setBusyId(null) }
  }

  if (!user) return <Spinner />

  return (
    <div>
      {!verified && (
        <div className="mb-4">
          <Notice kind="warn">
            <p className="font-medium">{t.doctor.pending}</p>
            <p className="mt-0.5">{t.auth.doctorPending}</p>
            <Link to="/doctor/verify" className="inline-block mt-2 text-brand-700 font-semibold underline">
              {t.doctor.verification}
            </Link>
          </Notice>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-ink-900">{stats.claimedToday}</p>
          <p className="text-[11px] text-ink-500 mt-0.5">{t.doctor.tokensHandled}</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-ink-900">{stats.avg > 0 ? fmtDuration(stats.avg) : '—'}</p>
          <p className="text-[11px] text-ink-500 mt-0.5">{t.doctor.avgTime}</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.emrOpen}</p>
          <p className="text-[11px] text-ink-500 mt-0.5">{t.triage.bandEMR}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <SectionTitle>{t.doctor.inbox}</SectionTitle>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t.doctor.all },
            { value: 'EMR', label: t.triage.bandEMR },
            { value: 'mine', label: t.doctor.claimed },
          ]}
        />
      </div>

      {!loaded ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<IconClipboard size={22} />} title={t.doctor.empty} /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map(tk => {
            const tr = triages.get(tk.triageId)
            const mine = tk.doctorId === user.id
            return (
              <Card key={tk.id} className="p-4 cursor-pointer active:scale-[0.99] transition"
                onClick={() => navigate(`/doctor/triage/${tk.id}`)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <TokenPill code={tk.code} band={tk.band} />
                  <BandPill band={tk.band} size="sm" />
                  {tk.band === 'EMR' && <IconAlertTri size={16} className="text-red-600" />}
                  <span className="ml-auto text-xs text-ink-400 inline-flex items-center gap-1">
                    <IconClock size={13} />{fmtTime(tk.createdAt)}
                  </span>
                </div>
                <p className="font-semibold text-ink-900 mt-2">{tk.patientName}</p>
                <p className="text-[13px] text-ink-500 line-clamp-1">
                  {tr ? tr.complaint : '…'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {mine ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700">
                        <IconVideo size={16} />{t.doctor.claimed2}
                      </span>
                      <button onClick={e => doRelease(e, tk.id)}
                        className="ml-auto text-[13px] text-ink-400 hover:text-ink-700 underline">
                        {t.doctor.unclaim}
                      </button>
                    </>
                  ) : tk.doctorId ? (
                    <span className="text-[13px] text-ink-400">{tk.doctorName}</span>
                  ) : (
                    <Button size="sm" disabled={!verified || busyId === tk.id}
                      onClick={e => doClaim(e, tk.id)}>
                      {busyId === tk.id ? t.common.loading : t.doctor.claim}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {apptCount > 0 && (
        <p className="text-center text-[13px] text-ink-400 mt-4">
          {apptCount} {t.appointments.upcoming.toLowerCase()} · {t.nav.appointments.toLowerCase()}
        </p>
      )}
    </div>
  )
}
