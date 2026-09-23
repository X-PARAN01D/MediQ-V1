import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { claimToken, releaseToken, completeToken, bandLabel } from '../../lib/tokens'
import { notify } from '../../lib/notify'
import { downloadReceipt, downloadPrescription } from '../../lib/pdf'
import { symptomById } from '../../lib/triage'
import {
  Button, Card, SectionTitle, Field, Input, TextArea, Select,
  BandPill, TokenPill, Modal, Spinner, Notice, Avatar, ConfirmDialog,
} from '../../components/ui'
import {
  IconAlertTri, IconVideo, IconDownload, IconPlus, IconX, IconClock, IconCheckCircle,
} from '../../components/icons'
import {
  fmtDate, fmtTime, fmtDuration,
  type Token, type Triage, type User, type Prescription,
} from '../../lib/types'

interface MedRow { name: string; dosage: string; frequency: string; durationDays: string }

const ESC_SPECIALTIES = ['Cardiologist', 'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'Dermatologist', 'General Physician']

export default function TriageDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [token, setToken] = useState<(Token & { id: string }) | null>(null)
  const [triage, setTriage] = useState<(Triage & { id: string }) | null>(null)
  const [patient, setPatient] = useState<(User & { id: string }) | null>(null)
  const [doctor, setDoctor] = useState<(User & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [notes, setNotes] = useState('')
  const [rxItems, setRxItems] = useState<MedRow[]>([{ name: '', dosage: '', frequency: 'Once daily', durationDays: '5' }])
  const [advice, setAdvice] = useState('')
  const [rxSaved, setRxSaved] = useState<(Prescription & { id: string }) | null>(null)
  const [rxBusy, setRxBusy] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const [escOpen, setEscOpen] = useState(false)
  const [escSpec, setEscSpec] = useState(ESC_SPECIALTIES[0])
  const [escNote, setEscNote] = useState('')

  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      try {
        const s = store()
        const tk = await s.col<Token>('tokens').get(id)
        if (!tk || !alive) { setLoading(false); return }
        setToken(tk)
        const [tr, pt] = await Promise.all([
          s.col<Triage>('triages').get(tk.triageId),
          s.col<User>('users').get(tk.patientId),
        ])
        if (!alive) return
        setTriage(tr)
        setPatient(pt)
        setNotes(tk.notes || '')
        if (tk.doctorId) setDoctor(await s.col<User>('users').get(tk.doctorId))
        if (tk.prescriptionId) setRxSaved(await s.col<Prescription>('prescriptions').get(tk.prescriptionId))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  if (!user) return <Spinner />
  if (loading) return <Spinner />
  if (!token) return <Card><Notice kind="warn">Token not found.</Notice></Card>

  const verified = user.verification === 'approved'
  const mine = token.doctorId === user.id
  const claimedByOther = !!token.doctorId && !mine
  const done = token.status === 'completed'
  const canAct = verified && !claimedByOther && !done && token.status !== 'revoked'
  const freqOptions: string[] = t.doctor.freqOptions as unknown as string[]

  const reloadToken = async () => {
    const tk = await store().col<Token>('tokens').get(token.id)
    if (tk) {
      setToken(tk)
      if (tk.doctorId) setDoctor(await store().col<User>('users').get(tk.doctorId))
      if (tk.prescriptionId) setRxSaved(await store().col<Prescription>('prescriptions').get(tk.prescriptionId))
    }
  }

  const doClaim = async () => {
    setBusy(true); setErr('')
    try {
      const ok = await claimToken(token.id, user)
      if (!ok) setErr('Already claimed by another doctor.')
      await reloadToken()
    } finally { setBusy(false) }
  }

  const saveRx = async (): Promise<(Prescription & { id: string }) | null> => {
    const valid = rxItems.filter(r => r.name.trim())
    if (valid.length === 0) { setErr('Add at least one medicine with a name.'); return null }
    setRxBusy(true); setErr('')
    try {
      const rx = await store().col<Prescription>('prescriptions').create({
        tokenId: token.id, triageId: token.triageId,
        patientId: token.patientId, patientName: token.patientName,
        doctorId: user.id, doctorName: user.name,
        items: valid.map(r => ({ ...r, name: r.name.trim() })),
        advice: advice.trim() || undefined,
        createdAt: Date.now(),
      } as Prescription)
      await store().col<Token>('tokens').update(token.id, { prescriptionId: rx.id })
      setRxSaved(rx)
      await notify(token.patientId, {
        kind: 'prescription_ready', refId: rx.id, channel: 'sms',
        title: 'Prescription ready',
        body: `MediQ: Your prescription for token ${token.code} is ready in the app.`,
      })
      return rx
    } finally { setRxBusy(false) }
  }

  const doComplete = async () => {
    if (!notes.trim() && !rxSaved && !token.prescriptionId) {
      setErr('Write consultation notes or save a prescription before completing.')
      return
    }
    setBusy(true); setErr('')
    try {
      await completeToken(token.id, user, notes.trim(), rxSaved?.id || token.prescriptionId)
      navigate('/doctor')
    } finally { setBusy(false) }
  }

  const doEscalate = async () => {
    setBusy(true)
    try {
      const detail = `Escalated to ${escSpec}${escNote.trim() ? ` — ${escNote.trim()}` : ''}`
      await store().col<Token>('tokens').update(token.id, {
        notes: [token.notes, detail].filter(Boolean).join('\n'),
      })
      await notify(token.patientId, {
        kind: 'escalated', refId: token.id, channel: 'sms',
        title: 'Referred to specialist',
        body: `MediQ: Your case (${token.code}) has been referred to a ${escSpec}. We will contact you with next steps.`,
      })
      await store().col('audit').create({
        actorId: user.id, actorName: user.name, action: 'token_escalated',
        detail: `${token.code} → ${escSpec}`, createdAt: Date.now(),
      })
      setEscOpen(false)
      await reloadToken()
    } finally { setBusy(false) }
  }

  const chip = (label: string) => (
    <span key={label} className="inline-block rounded-full bg-brand-50 text-brand-800 px-2.5 py-1 text-[12px] font-medium">
      {label}
    </span>
  )

  return (
    <div className="space-y-4">
      {/* header */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={token.patientName} size={48} />
          <div className="min-w-0">
            <p className="font-bold text-ink-900 text-[16px]">{token.patientName}</p>
            <p className="text-[13px] text-ink-500">
              {patient?.age ? `${patient.age} yrs` : ''}{patient?.age && patient?.gender ? ' · ' : ''}
              {patient?.gender || ''}{patient?.village ? ` · ${patient.village}` : ''}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1.5">
            <TokenPill code={token.code} band={token.band} />
            <BandPill band={token.band} size="sm" />
          </div>
        </div>
        {(patient?.bloodGroup || patient?.allergies || patient?.conditions) && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-[13px] text-red-900">
            {patient?.bloodGroup && <p><b>{t.emergency.bloodGroup}:</b> {patient.bloodGroup}</p>}
            {patient?.allergies && <p><b>{t.emergency.allergies}:</b> {patient.allergies}</p>}
            {patient?.conditions && <p><b>{t.emergency.conditions}:</b> {patient.conditions}</p>}
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-[12px] text-ink-400">
          <span className="inline-flex items-center gap-1"><IconClock size={13} />{fmtDate(token.createdAt)} · {fmtTime(token.createdAt)}</span>
          {token.callDurationSec ? <span>{t.consult.duration}: {fmtDuration(token.callDurationSec)}</span> : null}
          {token.status === 'completed' && <span className="inline-flex items-center gap-1 text-green-700 font-medium"><IconCheckCircle size={14} />{t.tokens.st_completed}</span>}
        </div>
      </Card>

      {err && <Notice kind="warn">{err}</Notice>}
      {claimedByOther && <Notice>Claimed by {token.doctorName}. Read-only view.</Notice>}

      {/* triage summary */}
      {triage && (
        <Card className="p-4">
          <SectionTitle>{t.doctor.reasoning}</SectionTitle>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[13px] text-ink-500">{t.triage.yourScore}:</span>
            <span className="text-lg font-bold text-ink-900">{triage.score}<span className="text-sm font-medium text-ink-400">/100</span></span>
            <span className="text-[13px] text-ink-500">· {bandLabel(triage.band)}</span>
          </div>
          {triage.redFlags.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 mb-2.5">
              <p className="text-[13px] font-semibold text-red-800 inline-flex items-center gap-1.5">
                <IconAlertTri size={15} />{t.triage.redFlag}
              </p>
              <p className="text-[13px] text-red-700 mt-0.5">{triage.redFlags.join(', ')}</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {triage.reasons.map((r, i) => (
              <li key={i} className="text-[13px] text-ink-700 flex gap-2">
                <span className="text-ink-300 mt-0.5">•</span><span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {triage && (
        <Card className="p-4">
          <SectionTitle>{t.doctor.transcript}</SectionTitle>
          <p className="text-[14px] text-ink-900 leading-relaxed">{triage.complaint}</p>
          {(triage.symptoms.length > 0 || triage.extractedSymptoms.length > 0) && (
            <>
              <p className="text-[13px] font-medium text-ink-700 mt-3 mb-1.5">{t.doctor.extracted}</p>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([...triage.symptoms, ...triage.extractedSymptoms])]
                  .map(sid => chip(symptomById(sid)?.en || sid))}
              </div>
            </>
          )}
          {triage.vitals && (triage.vitals.temp || triage.vitals.spo2 || triage.vitals.bp) && (
            <>
              <p className="text-[13px] font-medium text-ink-700 mt-3 mb-1.5">{t.doctor.vitalsReported}</p>
              <p className="text-[13px] text-ink-700">
                {[triage.vitals.temp && `Temp ${triage.vitals.temp}°F`,
                  triage.vitals.spo2 && `SpO2 ${triage.vitals.spo2}%`,
                  triage.vitals.bp && `BP ${triage.vitals.bp}`].filter(Boolean).join(' · ')}
              </p>
            </>
          )}
          {triage.notes && (
            <>
              <p className="text-[13px] font-medium text-ink-700 mt-3 mb-1">{t.intake.notes}</p>
              <p className="text-[13px] text-ink-700">{triage.notes}</p>
            </>
          )}
        </Card>
      )}

      {/* actions */}
      {canAct && !done && (
        <Card className="p-4 space-y-3">
          <SectionTitle>{t.doctor.stats}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {!token.doctorId ? (
              <Button size="sm" onClick={doClaim} disabled={busy}>{t.doctor.claim}</Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/consult/${token.id}`)}>
                  <IconVideo size={16} />{t.doctor.startCall}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmRelease(true)}>
                  {t.doctor.unclaim}
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={() => setEscOpen(true)}>
              {t.doctor.escalate}
            </Button>
          </div>

          <Field label={t.doctor.addNotes}>
            <TextArea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t.doctor.notesPh} rows={3} />
          </Field>

          {/* prescription builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-ink-700">{t.doctor.prescribe}</p>
              <button onClick={() => setRxItems([...rxItems, { name: '', dosage: '', frequency: freqOptions[0] || 'Once daily', durationDays: '5' }])}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">
                <IconPlus size={15} />{t.doctor.addMedicine}
              </button>
            </div>
            <div className="space-y-2.5">
              {rxItems.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-ink-400">#{i + 1}</span>
                    {rxItems.length > 1 && (
                      <button onClick={() => setRxItems(rxItems.filter((_, j) => j !== i))}
                        className="ml-auto text-ink-300 hover:text-red-600" aria-label="Remove">
                        <IconX size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t.doctor.medName} value={r.name}
                      onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input placeholder={t.doctor.dosage} value={r.dosage}
                      onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))} />
                    <Select value={r.frequency}
                      onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))}>
                      {freqOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </Select>
                    <Input placeholder={t.doctor.duration} inputMode="numeric" value={r.durationDays}
                      onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, durationDays: e.target.value } : x))} />
                  </div>
                </div>
              ))}
            </div>
            <Field label={t.doctor.bio} >
              <TextArea value={advice} onChange={e => setAdvice(e.target.value)}
                placeholder="Rest, fluids, follow-up…" rows={2} />
            </Field>
            <Button variant="secondary" size="sm" className="mt-2" onClick={saveRx} disabled={rxBusy}>
              {rxBusy ? t.common.loading : t.doctor.saveRx}
            </Button>
            {rxSaved && (
              <p className="text-[13px] text-green-700 font-medium mt-2 inline-flex items-center gap-1.5">
                <IconCheckCircle size={15} />{t.tokens.prescription} saved
              </p>
            )}
          </div>

          <Button className="w-full" onClick={doComplete} disabled={busy}>
            {busy ? t.common.loading : t.doctor.complete}
          </Button>
        </Card>
      )}

      {/* downloads when completed */}
      {done && (
        <Card className="p-4">
          <SectionTitle>{t.tokens.receipt}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm"
              onClick={() => patient && downloadReceipt(token, triage, patient, doctor, rxSaved)}>
              <IconDownload size={16} />{t.tokens.receipt} PDF
            </Button>
            {rxSaved && patient && doctor && (
              <Button variant="secondary" size="sm"
                onClick={() => downloadPrescription(rxSaved, patient, doctor)}>
                <IconDownload size={16} />{t.tokens.prescription} PDF
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* escalate modal */}
      <Modal open={escOpen} onClose={() => setEscOpen(false)} title={t.doctor.escalateTo}>
        <div className="space-y-3">
          <Field label={t.doctor.escalateTo}>
            <Select value={escSpec} onChange={e => setEscSpec(e.target.value)}>
              {ESC_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label={t.doctor.addNotes}>
            <TextArea value={escNote} onChange={e => setEscNote(e.target.value)}
              placeholder={t.doctor.notesPh} rows={3} />
          </Field>
          <Button className="w-full" onClick={doEscalate} disabled={busy}>
            {busy ? t.common.loading : t.doctor.escalate}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog open={confirmRelease} title={t.doctor.unclaim}
        body="Release this token back to the open queue?" confirmLabel={t.doctor.unclaim}
        onClose={() => setConfirmRelease(false)}
        onConfirm={async () => { await releaseToken(token.id, user); await reloadToken() }} />
    </div>
  )
}
