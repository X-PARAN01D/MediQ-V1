import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { runTriage, SYMPTOMS, type TriageInput } from '../../lib/triage'
import { Button, Card, SectionTitle, Field, TextArea, Input, Notice } from '../../components/ui'
import { IconAlertTri } from '../../components/icons'
import type { Triage } from '../../lib/types'

const DURATIONS: TriageInput['duration'][] = ['lt1', '1-3', '4-7', 'gt7']
const SEVERITIES: TriageInput['severitySelf'][] = ['mild', 'moderate', 'severe']

export default function Intake() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [duration, setDuration] = useState<TriageInput['duration']>('1-3')
  const [severity, setSeverity] = useState<TriageInput['severitySelf']>('moderate')
  const [temp, setTemp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [bp, setBp] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!user) return
    if (!complaint.trim()) { setError(t.validation.required); return }
    setError('')
    setBusy(true)
    try {
      const input: TriageInput = {
        complaint: complaint.trim(),
        symptoms: [...selected],
        duration,
        severitySelf: severity,
        vitals: { temp: temp.trim(), spo2: spo2.trim(), bp: bp.trim() },
      }
      const result = runTriage(input)
      const doc = await store().col<Triage>('triages').create({
        patientId: user.id,
        patientName: user.name,
        village: user.village,
        complaint: input.complaint,
        symptoms: input.symptoms,
        duration: input.duration,
        severitySelf: input.severitySelf,
        vitals: input.vitals,
        notes: notes.trim(),
        score: result.score,
        band: result.band,
        redFlags: result.redFlags,
        reasons: result.reasons,
        extractedSymptoms: result.extractedSymptoms,
        createdAt: Date.now(),
      } as Triage)
      navigate(`/triage/${doc.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.intake.title}</h1>
        <p className="text-sm text-ink-500 mt-0.5">{t.intake.subtitle}</p>
      </div>

      <Card className="p-5 space-y-5">
        <Field label={t.intake.chiefComplaint} required error={error}>
          <TextArea value={complaint} onChange={e => setComplaint(e.target.value)}
            placeholder={t.intake.chiefComplaintPh} rows={3} />
        </Field>

        <div>
          <p className="text-[13px] font-medium text-ink-700 mb-2">{t.intake.symptoms}</p>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map(s => {
              const on = selected.has(s.id)
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition ${
                    on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-ink-700'
                  } ${s.redFlag ? (on ? '' : 'border-red-200') : ''}`}>
                  {lang === 'hi' ? s.hi : s.en}
                </button>
              )
            })}
          </div>
          {[...selected].some(id => SYMPTOMS.find(s => s.id === id)?.redFlag) && (
            <div className="mt-2"><Notice kind="warn">{t.triage.redFlag} — {t.triage.bandEMRd}</Notice></div>
          )}
        </div>

        <div>
          <p className="text-[13px] font-medium text-ink-700 mb-2">{t.intake.duration}</p>
          <div className="grid grid-cols-2 gap-2">
            {DURATIONS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDuration(d)}
                className={`px-3 py-2.5 rounded-xl border text-[13px] font-medium text-left transition ${
                  duration === d ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-700'
                }`}>
                {t.intake.durationOptions[i]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium text-ink-700 mb-2">{t.intake.severity}</p>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((s, i) => (
              <button key={s} type="button" onClick={() => setSeverity(s)}
                className={`px-3 py-2.5 rounded-xl border text-[13px] font-medium transition ${
                  severity === s ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-700'
                }`}>
                {t.intake.severityOptions[i]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium text-ink-700 mb-2">{t.intake.vitals} <span className="text-ink-400 font-normal">({t.common.optional})</span></p>
          <div className="grid grid-cols-3 gap-2">
            <Input inputMode="decimal" placeholder={t.intake.temp} value={temp} onChange={e => setTemp(e.target.value)} />
            <Input inputMode="numeric" placeholder={t.intake.spo2} value={spo2} onChange={e => setSpo2(e.target.value)} />
            <Input placeholder={t.intake.bp} value={bp} onChange={e => setBp(e.target.value)} />
          </div>
        </div>

        <Field label={`${t.intake.notes} (${t.common.optional})`}>
          <TextArea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </Field>
      </Card>

      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>
        {busy ? t.common.loading : t.intake.submit}
      </Button>
      <p className="flex items-start gap-2 text-xs text-ink-400">
        <IconAlertTri size={14} className="shrink-0 mt-0.5" />
        {t.saathi.disclaimer}
      </p>
    </div>
  )
}
