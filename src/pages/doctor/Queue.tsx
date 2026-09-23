import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { Card, SectionTitle, TokenPill, EmptyState, Spinner } from '../../components/ui'
import { IconClock, IconUser } from '../../components/icons'
import { fmtTime, dayStartIST, type Token, type Band } from '../../lib/types'

const PER_PATIENT_MIN: Record<Band, number> = { EMR: 5, MOD: 10, NOR: 12 }

const BAND_ORDER: Band[] = ['EMR', 'MOD', 'NOR']

export default function Queue() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [tokens, setTokens] = useState<(Token & { id: string })[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const day = (ts: number) =>
      new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    return store().col<Token>('tokens').subscribe(
      docs => { setTokens(docs); setLoaded(true) },
      tk => (tk.status === 'reserved' || tk.status === 'active') && day(tk.createdAt) === today,
      [{ field: 'createdAt', op: '>=', value: dayStartIST() }],
    )
  }, [])

  const groups = useMemo(() => {
    const g: Record<Band, (Token & { id: string })[]> = { EMR: [], MOD: [], NOR: [] }
    tokens.forEach(tk => g[tk.band].push(tk))
    BAND_ORDER.forEach(b => g[b].sort((a, b2) => a.createdAt - b2.createdAt))
    return g
  }, [tokens])

  const bandTitle: Record<Band, string> = { EMR: t.triage.bandEMR, MOD: t.triage.bandMOD, NOR: t.triage.bandNOR }
  const bandHead: Record<Band, string> = {
    EMR: 'bg-red-600 text-white',
    MOD: 'bg-amber-500 text-white',
    NOR: 'bg-green-600 text-white',
  }

  return (
    <div>
      <SectionTitle>{t.doctor.queueTitle}</SectionTitle>

      {/* counts */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {BAND_ORDER.map(b => (
          <Card key={b} className="p-3.5 text-center">
            <p className="text-2xl font-bold text-ink-900">{groups[b].length}</p>
            <p className="text-[11px] text-ink-500 mt-0.5">{bandTitle[b]}</p>
          </Card>
        ))}
      </div>

      {!loaded ? (
        <Spinner />
      ) : tokens.length === 0 ? (
        <Card><EmptyState icon={<IconClock size={22} />} title={t.doctor.empty} /></Card>
      ) : (
        <div className="space-y-5">
          {BAND_ORDER.map(b => groups[b].length > 0 && (
            <section key={b}>
              <div className={`rounded-xl px-3.5 py-2 mb-2 flex items-center justify-between ${bandHead[b]}`}>
                <span className="text-[13px] font-bold tracking-wide">{bandTitle[b]}</span>
                <span className="text-[12px] font-semibold opacity-90">{groups[b].length}</span>
              </div>
              <div className="space-y-2">
                {groups[b].map((tk, i) => (
                  <Card key={tk.id} className="px-4 py-3 cursor-pointer active:scale-[0.99] transition"
                    onClick={() => navigate(`/doctor/triage/${tk.id}`)}>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-slate-100 text-ink-700 text-[13px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <TokenPill code={tk.code} band={tk.band} />
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900 text-[14px] truncate">{tk.patientName}</p>
                        <p className="text-[12px] text-ink-400 inline-flex items-center gap-1">
                          <IconClock size={12} />{fmtTime(tk.createdAt)} · ~{i * PER_PATIENT_MIN[b]} {t.tokens.mins}
                        </p>
                      </div>
                      <span className="ml-auto text-[12px] text-ink-500 inline-flex items-center gap-1 shrink-0">
                        <IconUser size={13} />
                        {tk.doctorName ? tk.doctorName.replace(/^Dr\.\s*/, '') : '—'}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
