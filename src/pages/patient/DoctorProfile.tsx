import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { isDemo } from '../../lib/config'
import { getBookedSlots } from '../../lib/tokens'
import { Button, Card, SectionTitle, Avatar, Notice, Modal, EmptyState, Spinner } from '../../components/ui'
import { IconShieldCheck, IconCheckCircle, IconInfo, IconCalendar, IconClock } from '../../components/icons'
import { fmtDate, type User, type Appointment } from '../../lib/types'

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00']

function istDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export default function DoctorProfile() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState<(User & { id: string }) | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [day, setDay] = useState(0)
  const [slot, setSlot] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => [0, 1, 2].map(istDate), [])
  const dateStr = days[day]

  useEffect(() => {
    if (!id) return
    store().col<User>('users').get(id).then(d => {
      setDoctor(d && d.role === 'doctor' ? d : null)
      setLoaded(true)
    })
    let cancelled = false
    if (isDemo) {
      const unsub = store().col<Appointment>('appointments').subscribe(docs => {
        if (cancelled) return
        setBooked(new Set(docs.filter(a => a.doctorId === id && a.status === 'upcoming').map(a => `${a.date}|${a.slot}`)))
      })
      return () => { cancelled = true; unsub() }
    }
    // Firebase mode: patients cannot read other patients' appointment documents
    // under the security rules, so booked slots come from the `bookedSlots`
    // callable (returns date|slot keys, no patient PII).
    getBookedSlots(id!).then(slots => { if (!cancelled) setBooked(new Set(slots)) })
    return () => { cancelled = true }
  }, [id])

  const book = async () => {
    if (!user || !doctor || !slot) return
    setBusy(true)
    try {
      await store().col<Appointment>('appointments').create({
        patientId: user.id,
        patientName: user.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        date: dateStr,
        slot,
        status: 'upcoming',
        createdAt: Date.now(),
      } as Appointment)
      setConfirmOpen(false)
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <Spinner />
  if (!doctor) return <EmptyState icon={<IconInfo size={22} />} title={t.common.notAvailable} />

  const verified = doctor.verification === 'approved' && doctor.verified

  if (done) {
    return (
      <Card className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
          <IconCheckCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-ink-900">{t.doctors.bookingDone}</h2>
        <p className="text-sm text-ink-500 mt-1">{t.doctors.bookingDoneHint}</p>
        <p className="text-sm font-medium text-ink-900 mt-3">{doctor.name} · {fmtDate(new Date(dateStr + 'T00:00:00').getTime(), lang)} · {slot}</p>
        <Button className="mt-5 w-full" onClick={() => navigate('/appointments')}>{t.nav.appointments}</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={doctor.name} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold text-ink-900">{doctor.name}</h1>
              {verified && (
                <span className="inline-flex items-center gap-0.5 text-green-700 text-xs font-semibold">
                  <IconShieldCheck size={15} /> {t.doctors.verified}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-500">{doctor.specialization} · {doctor.experience} {t.doctors.experience}</p>
            <p className="text-sm text-ink-500">{doctor.clinic}</p>
            {doctor.fee != null && <p className="text-sm font-semibold text-ink-900 mt-1">₹{doctor.fee} / visit</p>}
          </div>
        </div>
        {!verified && (
          <div className="mt-4"><Notice kind="warn">{t.auth.doctorPending}</Notice></div>
        )}
      </Card>

      <div>
        <SectionTitle>{t.doctors.about}</SectionTitle>
        <Card className="p-4 space-y-2.5 text-sm">
          {doctor.bio && <p className="text-ink-700">{doctor.bio}</p>}
          {doctor.qualifications && (
            <p><span className="text-ink-400">{t.doctors.qualifications}: </span><span className="text-ink-900 font-medium">{doctor.qualifications}</span></p>
          )}
          {doctor.languages && doctor.languages.length > 0 && (
            <p><span className="text-ink-400">{t.doctors.languages}: </span><span className="text-ink-900 font-medium">{doctor.languages.join(', ')}</span></p>
          )}
          {doctor.availability && (
            <p className="flex items-center gap-1.5"><IconClock size={15} className="text-ink-400" /><span className="text-ink-700">{doctor.availability}</span></p>
          )}
        </Card>
      </div>

      {verified && (
        <div>
          <SectionTitle>{t.doctors.slots}</SectionTitle>
          <Card className="p-4">
            <div className="flex gap-2 mb-4">
              {days.map((d, i) => {
                const dt = new Date(d + 'T00:00:00')
                const label = i === 0 ? t.common.today : dt.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <button key={d} onClick={() => { setDay(i); setSlot(null) }}
                    className={`flex-1 px-2 py-2.5 rounded-xl border text-[13px] font-medium ${day === i ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-700'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SLOTS.map(s => {
                const taken = booked.has(`${dateStr}|${s}`)
                const sel = slot === s
                return (
                  <button key={s} disabled={taken} onClick={() => setSlot(s)}
                    className={`px-2 py-2.5 rounded-xl border text-[13px] font-semibold transition ${
                      taken ? 'border-slate-100 bg-slate-50 text-ink-400 line-through cursor-not-allowed'
                        : sel ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 text-ink-700 hover:border-brand-400'
                    }`}>
                    {s}
                  </button>
                )
              })}
            </div>
            <Button className="w-full mt-4" size="lg" disabled={!slot} onClick={() => setConfirmOpen(true)}>
              <IconCalendar size={18} /> {t.doctors.book}
            </Button>
          </Card>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t.doctors.confirmBooking}>
        <div className="text-sm text-ink-700 space-y-1.5">
          <p><span className="text-ink-400">{t.tokens.doctor}: </span><strong>{doctor.name}</strong></p>
          <p><span className="text-ink-400">{t.tokens.date}: </span><strong>{fmtDate(new Date(dateStr + 'T00:00:00').getTime(), lang)} · {slot}</strong></p>
          {doctor.fee != null && <p><span className="text-ink-400">Fee: </span><strong>₹{doctor.fee}</strong></p>}
        </div>
        <Button className="w-full mt-5" disabled={busy} onClick={book}>
          {busy ? t.common.loading : t.doctors.confirmBooking}
        </Button>
      </Modal>
    </div>
  )
}
