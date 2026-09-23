import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { bandColor } from '../../lib/triage'
import { issueToken } from '../../lib/tokens'
import { Button, Card, SectionTitle, BandPill, Notice, Spinner, EmptyState } from '../../components/ui'
import { IconAlertTri, IconCheckCircle, IconPhone, IconInfo } from '../../components/icons'
import type { Triage } from '../../lib/types'

function ScoreRing({ score, band }: { score: number; band: Triage['band'] }) {
  const r = 52, c = 2 * Math.PI * r
  const color = bandColor(band)
  return (
    <div className="relative w-[136px] h-[136px] mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e8eef5" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-ink-900">{score}</span>
        <span className="text-xs text-ink-400">/ 100</span>
      </div>
    </div>
  )
}

export default function TriageResult() {
  const { t } = useLang()
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<(Triage & { id: string }) | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (!id || !user) return
    store().col<Triage>('triages').get(id).then(d => {
      if (!d) { setLoaded(true); return }
      if (d.patientId !== user.id) { setForbidden(true); setLoaded(true); return }
      setDoc(d)
      setLoaded(true)
    })
  }, [id, user?.id])

  const getToken = async () => {
    if (!doc) return
    setBusy(true)
    try {
      await issueToken(doc)
      navigate('/tokens')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <Spinner label={t.triage.assessing} />
  if (forbidden || !doc) {
    return <EmptyState icon={<IconInfo size={22} />} title={t.common.notAvailable} />
  }

  const bandDesc = doc.band === 'NOR' ? t.triage.bandNORd : doc.band === 'MOD' ? t.triage.bandMODd : t.triage.bandEMRd

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.triage.title}</h1>
        <p className="text-sm text-ink-500 mt-0.5">“{doc.complaint}”</p>
      </div>

      <Card className="p-5 text-center">
        <ScoreRing score={doc.score} band={doc.band} />
        <div className="mt-3 flex items-center justify-center gap-2">
          <BandPill band={doc.band} />
          <span className="text-sm font-medium text-ink-700">{t.triage.yourScore}</span>
        </div>
        <p className="text-sm text-ink-500 mt-2 max-w-[320px] mx-auto">{bandDesc}</p>
      </Card>

      {doc.redFlags.length > 0 && (
        <Notice kind="warn">
          <p className="font-semibold flex items-center gap-1.5"><IconAlertTri size={16} /> {t.triage.redFlag}</p>
          <ul className="list-disc pl-5 mt-1">
            {doc.redFlags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </Notice>
      )}

      <div>
        <SectionTitle>{t.triage.whyTitle}</SectionTitle>
        <Card className="p-4">
          <ul className="space-y-2.5">
            {doc.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                <IconCheckCircle size={17} className="shrink-0 mt-0.5 text-brand-600" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-2.5">
        <Button size="lg" className="w-full" disabled={busy} onClick={getToken}>
          {busy ? t.common.loading : t.triage.getToken}
        </Button>
        {doc.band === 'EMR' && (
          <>
            <Notice kind="warn">{t.triage.bandEMRd}</Notice>
            <a href="tel:108" className="block">
              <Button size="lg" variant="emergency" className="w-full">
                <IconPhone size={19} /> {t.triage.call108}
              </Button>
            </a>
          </>
        )}
      </div>
    </div>
  )
}
