import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { Button, Card, SegmentedControl, EmptyState, ConfirmDialog, Avatar, StatusBadge } from '../../components/ui'
import { IconCalendar, IconVideo } from '../../components/icons'
import { fmtDate, type Appointment } from '../../lib/types'

type Tab = 'upcoming' | 'past'

export default function Appointments() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<(Appointment & { id: string })[]>([])
  const [tab, setTab] = useState<Tab>('upcoming')
  const [cancelId, setCancelId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return store().col<Appointment>('appointments').subscribe(docs => {
      setList(docs.filter(d => d.patientId === user.id).sort((a, b) => (b.date + b.slot).localeCompare(a.date + a.slot)))
    }, d => d.patientId === user.id, [{ field: 'patientId', op: '==', value: user.id }])
  }, [user?.id])

  const upcoming = list.filter(a => a.status === 'upcoming').sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot))
  const past = list.filter(a => a.status !== 'upcoming')
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.appointments.title}</h1>
      <SegmentedControl<Tab>
        options={[
          { value: 'upcoming', label: `${t.appointments.upcoming} (${upcoming.length})` },
          { value: 'past', label: t.appointments.past },
        ]}
        value={tab} onChange={setTab} />

      {shown.length === 0 ? (
        <Card><EmptyState icon={<IconCalendar size={22} />}
          title={tab === 'upcoming' ? t.appointments.noUpcoming : t.appointments.noPast}
          action={tab === 'upcoming' ? <Button onClick={() => navigate('/doctors')}>{t.home.findDoctor}</Button> : undefined} /></Card>
      ) : (
        <div className="space-y-3">
          {shown.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={a.doctorName} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 truncate">{a.doctorName}</p>
                  <p className="text-[13px] text-ink-500">
                    {a.specialization ? `${a.specialization} · ` : ''}{fmtDate(new Date(a.date + 'T00:00:00').getTime(), lang)} {t.appointments.at} {a.slot}
                  </p>
                </div>
                {a.status !== 'upcoming' && <StatusBadge status={a.status} />}
              </div>
              {a.status === 'upcoming' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1" onClick={() => navigate(`/consult/${a.id}`)}>
                    <IconVideo size={16} /> {t.appointments.joinCall}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 !text-red-700" onClick={() => setCancelId(a.id)}>
                    {t.appointments.cancelAppt}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!cancelId} title={t.appointments.cancelAppt}
        body={t.tokens.cancelConfirm} confirmLabel={t.appointments.cancelAppt} danger
        onClose={() => setCancelId(null)}
        onConfirm={async () => { if (cancelId) await store().col<Appointment>('appointments').update(cancelId, { status: 'cancelled' }) }} />
    </div>
  )
}
