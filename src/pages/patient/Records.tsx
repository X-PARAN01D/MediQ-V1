import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { downloadReceipt, downloadPrescription } from '../../lib/pdf'
import { Button, Card, SegmentedControl, EmptyState, TokenPill, BandPill } from '../../components/ui'
import { IconFile, IconDownload, IconPill } from '../../components/icons'
import { fmtDate, fmtTime, type Token, type Triage, type User, type Prescription } from '../../lib/types'

type Tab = 'visits' | 'rx' | 'receipts'

export default function Records() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [tokens, setTokens] = useState<(Token & { id: string })[]>([])
  const [rxs, setRxs] = useState<(Prescription & { id: string })[]>([])
  const [tab, setTab] = useState<Tab>('visits')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const u1 = store().col<Token>('tokens').subscribe(docs => {
      setTokens(docs.filter(d => d.patientId === user.id && d.status === 'completed').sort((a, b) => b.createdAt - a.createdAt))
    }, d => d.patientId === user.id, [{ field: 'patientId', op: '==', value: user.id }])
    const u2 = store().col<Prescription>('prescriptions').subscribe(docs => {
      setRxs(docs.filter(d => d.patientId === user.id))
    }, d => d.patientId === user.id, [{ field: 'patientId', op: '==', value: user.id }])
    return () => { u1(); u2() }
  }, [user?.id])

  const doctorOf = (id?: string) => id ? store().col<User>('users').get(id) : Promise.resolve(null)

  const dlReceipt = async (tk: Token & { id: string }) => {
    if (!user) return
    setBusy(tk.id)
    try {
      const s = store()
      const triage = await s.col<Triage>('triages').get(tk.triageId)
      const doctor = await doctorOf(tk.doctorId)
      const list = await s.col<Prescription>('prescriptions').list(
        p => p.tokenId === tk.id,
        [{ field: 'patientId', op: '==', value: user.id }],
      )
      downloadReceipt(tk, triage, user, doctor, list[0] || null)
    } finally { setBusy(null) }
  }

  const dlRx = async (rx: Prescription & { id: string }) => {
    if (!user) return
    setBusy(rx.id)
    try {
      const doctor = await doctorOf(rx.doctorId)
      if (doctor) downloadPrescription(rx, user, doctor)
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.records.title}</h1>
      <SegmentedControl<Tab>
        options={[
          { value: 'visits', label: t.records.visits },
          { value: 'rx', label: t.records.prescriptions },
          { value: 'receipts', label: t.records.receipts },
        ]}
        value={tab} onChange={setTab} />

      {tab === 'visits' && (
        tokens.length === 0
          ? <Card><EmptyState icon={<IconFile size={22} />} title={t.records.noRecords} hint={t.records.noRecordsHint} /></Card>
          : <div className="space-y-3">{tokens.map(tk => (
            <Card key={tk.id} className="p-4">
              <div className="flex items-center gap-3">
                <TokenPill code={tk.code} band={tk.band} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate">{tk.doctorName || '—'}</p>
                  <p className="text-[13px] text-ink-500">{fmtDate(tk.completedAt || tk.createdAt, lang)} · {fmtTime(tk.completedAt || tk.createdAt)}</p>
                </div>
                <BandPill band={tk.band} size="sm" />
              </div>
              {tk.notes && (
                <p className="text-sm text-ink-700 mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-ink-400">{t.records.diagnosis}: </span>{tk.notes}
                </p>
              )}
            </Card>
          ))}</div>
      )}

      {tab === 'rx' && (
        rxs.length === 0
          ? <Card><EmptyState icon={<IconPill size={22} />} title={t.records.noRecords} hint={t.records.noRecordsHint} /></Card>
          : <div className="space-y-3">{rxs.map(rx => (
            <Card key={rx.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <IconPill size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate">{rx.doctorName}</p>
                  <p className="text-[13px] text-ink-500">
                    {fmtDate(rx.createdAt, lang)} · {rx.items.length} {lang === 'hi' ? 'दवाइयाँ' : 'medicines'}
                  </p>
                </div>
              </div>
              <ul className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                {rx.items.map((m, i) => (
                  <li key={i} className="text-[13px] text-ink-700">
                    <strong>{m.name}</strong> — {m.dosage}, {m.frequency}, {m.durationDays}d
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="secondary" className="w-full mt-3" disabled={busy === rx.id} onClick={() => dlRx(rx)}>
                <IconDownload size={16} /> {busy === rx.id ? t.common.loading : t.tokens.prescription + ' PDF'}
              </Button>
            </Card>
          ))}</div>
      )}

      {tab === 'receipts' && (
        tokens.length === 0
          ? <Card><EmptyState icon={<IconFile size={22} />} title={t.records.noRecords} hint={t.records.noRecordsHint} /></Card>
          : <div className="space-y-3">{tokens.map(tk => (
            <Card key={tk.id} className="p-4 flex items-center gap-3">
              <TokenPill code={tk.code} band={tk.band} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 truncate">{tk.doctorName || '—'}</p>
                <p className="text-[13px] text-ink-500">{fmtDate(tk.completedAt || tk.createdAt, lang)}</p>
              </div>
              <Button size="sm" variant="secondary" disabled={busy === tk.id} onClick={() => dlReceipt(tk)}>
                <IconDownload size={16} /> {busy === tk.id ? '…' : 'PDF'}
              </Button>
            </Card>
          ))}</div>
      )}
    </div>
  )
}
