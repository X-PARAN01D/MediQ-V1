import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { cancelToken, queuePosition } from '../../lib/tokens'
import { downloadReceipt } from '../../lib/pdf'
import { Button, Card, SegmentedControl, TokenPill, BandPill, StatusBadge, EmptyState, ConfirmDialog } from '../../components/ui'
import { IconDownload, IconVideo } from '../../components/icons'
import { fmtDate, fmtTime, type Token, type Triage, type User, type Prescription } from '../../lib/types'

type Tab = 'active' | 'history'

export default function Tokens() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tokens, setTokens] = useState<(Token & { id: string })[]>([])
  const [tab, setTab] = useState<Tab>('active')
  const [queues, setQueues] = useState<Record<string, { ahead: number; estWaitMin: number }>>({})
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [dlBusy, setDlBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return store().col<Token>('tokens').subscribe(async docs => {
      const mine = docs.filter(d => d.patientId === user.id).sort((a, b) => b.createdAt - a.createdAt)
      setTokens(mine)
      const q: Record<string, { ahead: number; estWaitMin: number }> = {}
      for (const tk of mine.filter(x => x.status === 'reserved' || x.status === 'active')) {
        q[tk.id] = await queuePosition(tk)
      }
      setQueues(q)
    }, d => d.patientId === user.id, [{ field: 'patientId', op: '==', value: user.id }])
  }, [user?.id])

  const active = tokens.filter(x => x.status === 'reserved' || x.status === 'active')
  const history = tokens.filter(x => x.status === 'completed' || x.status === 'revoked')
  const list = tab === 'active' ? active : history

  const statusLabel = (s: Token['status']) =>
    s === 'reserved' ? t.tokens.st_reserved : s === 'active' ? t.tokens.st_active
      : s === 'completed' ? t.tokens.st_completed : t.tokens.st_revoked

  const download = async (tk: Token & { id: string }) => {
    if (!user) return
    setDlBusy(tk.id)
    try {
      const s = store()
      const triage = await s.col<Triage>('triages').get(tk.triageId)
      const doctor = tk.doctorId ? await s.col<User>('users').get(tk.doctorId) : null
      const rxs = await s.col<Prescription>('prescriptions').list(
        p => p.tokenId === tk.id,
        [{ field: 'patientId', op: '==', value: user.id }],
      )
      downloadReceipt(tk, triage, user, doctor, rxs[0] || null)
    } finally {
      setDlBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.tokens.title}</h1>
      <SegmentedControl<Tab>
        options={[{ value: 'active', label: `${t.tokens.active} (${active.length})` }, { value: 'history', label: t.tokens.history }]}
        value={tab} onChange={setTab} />

      {list.length === 0 ? (
        <Card><EmptyState title={t.tokens.noTokens} hint={t.tokens.noTokensHint}
          action={<Button onClick={() => navigate('/intake')}>{t.home.startCheckup}</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map(tk => {
            const q = queues[tk.id]
            return (
              <Card key={tk.id} className="p-4">
                <div className="flex items-center gap-3">
                  <TokenPill code={tk.code} band={tk.band} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <BandPill band={tk.band} size="sm" />
                      <StatusBadge status={statusLabel(tk.status)} />
                    </div>
                    <p className="text-[13px] text-ink-500 mt-1">
                      {fmtDate(tk.createdAt, lang)} · {fmtTime(tk.createdAt)}
                      {tk.doctorName ? ` · ${tk.doctorName}` : ''}
                    </p>
                    {q && (tk.status === 'reserved' || tk.status === 'active') && (
                      <p className="text-[13px] font-medium text-brand-700 mt-0.5">
                        {q.ahead} {t.tokens.queuePos} · ~{q.estWaitMin} {t.tokens.mins}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => navigate(`/triage/${tk.triageId}`)}>
                    {lang === 'hi' ? 'विवरण देखें' : 'View details'}
                  </Button>
                  {(tk.status === 'reserved' || tk.status === 'active') && (
                    <>
                      {tk.status === 'active' && tk.doctorId && (
                        <Button size="sm" className="flex-1" onClick={() => navigate(`/consult/${tk.id}`)}>
                          <IconVideo size={16} /> {t.appointments.joinCall}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" className="flex-1 !text-red-700" onClick={() => setCancelId(tk.id)}>
                        {t.tokens.cancelToken}
                      </Button>
                    </>
                  )}
                  {tk.status === 'completed' && (
                    <Button size="sm" variant="secondary" className="flex-1" disabled={dlBusy === tk.id}
                      onClick={() => download(tk)}>
                      <IconDownload size={16} /> {dlBusy === tk.id ? t.common.loading : t.tokens.receipt}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog open={!!cancelId} title={t.tokens.cancelToken} body={t.tokens.cancelConfirm}
        confirmLabel={t.tokens.cancelToken} danger
        onClose={() => setCancelId(null)}
        onConfirm={async () => { if (cancelId && user) await cancelToken(cancelId, user.id) }} />
    </div>
  )
}
