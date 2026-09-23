import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { isDemo } from '../../lib/config'
import { notify } from '../../lib/notify'
import {
  Button, Card, SectionTitle, Field, TextArea, Modal,
  EmptyState, Spinner, Avatar, SegmentedControl, ConfirmDialog,
} from '../../components/ui'
import { IconShieldCheck, IconX } from '../../components/icons'
import { fmtDate, type User } from '../../lib/types'

type DocUser = User & { id: string; licenseDocUrl?: string; selfieUrl?: string }

type Tab = 'pending' | 'approved' | 'rejected'

export default function VerifyQueue() {
  const { user } = useAuth()
  const { t } = useLang()
  const [doctors, setDoctors] = useState<DocUser[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null)

  useEffect(() => {
    return store().col<User>('users').subscribe(
      docs => { setDoctors(docs); setLoaded(true) },
      u => u.role === 'doctor',
      [{ field: 'role', op: '==', value: 'doctor' }],
    )
  }, [])

  const rows = useMemo(
    () => doctors.filter(d => (d.verification || 'pending') === tab)
      .sort((a, b) => b.createdAt - a.createdAt),
    [doctors, tab],
  )

  const audit = async (action: string, detail: string) => {
    if (!user) return
    await store().col('audit').create({
      actorId: user.id, actorName: user.name || 'Admin',
      action, detail, createdAt: Date.now(),
    })
  }

  /**
   * Firebase mode: verification decisions go through the
   * `setDoctorVerification` callable — clients cannot write
   * role/verified/verification directly (security rules deny it).
   */
  const setVerification = async (d: DocUser, decision: 'approved' | 'rejected', reason?: string) => {
    if (isDemo) {
      await store().col<User>('users').update(d.id, {
        verification: decision, verified: decision === 'approved',
        verificationReason: reason?.trim() || undefined, verifiedAt: Date.now(),
      })
      await notify(d.id, {
        kind: decision === 'approved' ? 'verification_approved' : 'verification_rejected',
        channel: 'sms',
        title: decision === 'approved' ? 'Verification approved' : 'Verification needs attention',
        body: decision === 'approved'
          ? `MediQ: Your doctor verification is approved, ${d.name}. You can now claim tokens.`
          : `MediQ: Your verification was not approved. Reason: ${(reason || '').trim()}. Please resubmit documents.`,
      })
      return
    }
    const { callFn } = await import('../../lib/storeFirebase')
    await callFn('setDoctorVerification', { userId: d.id, decision, reason: reason?.trim() })
  }

  const approve = async (d: DocUser) => {
    setBusy(true)
    try {
      await setVerification(d, 'approved')
      await audit('doctor_approved', `Approved ${d.name} (${d.regId || 'no reg id'})`)
    } finally { setBusy(false); setConfirmApprove(null) }
  }

  const reject = async () => {
    const d = doctors.find(x => x.id === rejectId)
    if (!d || !reason.trim()) return
    setBusy(true)
    try {
      await setVerification(d, 'rejected', reason)
      await audit('doctor_rejected', `Rejected ${d.name}: ${reason.trim()}`)
    } finally { setBusy(false); setRejectId(null); setReason('') }
  }

  const docImg = (src: string | undefined, label: string) =>
    src ? (
      <img src={src} alt={label} className="w-full max-h-44 object-contain rounded-xl border border-slate-100 bg-slate-50" />
    ) : null

  const tabLabel: Record<Tab, string> = {
    pending: t.doctor.pending, approved: t.doctor.approved, rejected: t.doctor.rejected,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>{t.admin.verifyQueue}</SectionTitle>
        <SegmentedControl<Tab>
          value={tab} onChange={setTab}
          options={(['pending', 'approved', 'rejected'] as Tab[]).map(v => ({ value: v, label: `${tabLabel[v]} (${doctors.filter(d => (d.verification || 'pending') === v).length})` }))}
        />
      </div>

      {!loaded ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<IconShieldCheck size={22} />} title={t.doctor.empty} /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map(d => (
            <Card key={d.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={d.name} size={44} />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{d.name}</p>
                  <p className="text-[12px] text-ink-500">
                    {d.regId || '—'} · {d.specialization || '—'} · {d.clinic || '—'}
                  </p>
                  <p className="text-[11px] text-ink-400">{fmtDate(d.createdAt)}</p>
                </div>
              </div>

              {(d.licenseDocUrl || d.selfieUrl) && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {docImg(d.licenseDocUrl, t.auth.licenseDoc)}
                  {docImg(d.selfieUrl, t.auth.selfie)}
                </div>
              )}
              {!d.licenseDocUrl && !d.selfieUrl && (
                <p className="text-[12px] text-ink-400 mt-2">No documents uploaded.</p>
              )}

              {d.verification === 'rejected' && d.verificationReason && (
                <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-3">
                  <b>{t.doctor.rejectionReason}:</b> {d.verificationReason}
                </p>
              )}

              {tab === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1" disabled={busy}
                    onClick={() => setConfirmApprove(d.id)}>
                    {t.admin.approve}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 text-red-700 border-red-200"
                    disabled={busy} onClick={() => { setRejectId(d.id); setReason('') }}>
                    <IconX size={15} />{t.admin.reject}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!confirmApprove} title={t.admin.approve}
        body={`Approve ${doctors.find(d => d.id === confirmApprove)?.name || ''} as a verified doctor?`}
        confirmLabel={t.admin.approve}
        onClose={() => setConfirmApprove(null)}
        onConfirm={async () => {
          const d = doctors.find(x => x.id === confirmApprove)
          if (d) await approve(d)
        }} />

      <Modal open={!!rejectId} onClose={() => setRejectId(null)} title={t.admin.reject}>
        <Field label={t.doctor.rejectionReason} required>
          <TextArea value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t.admin.reasonPh} rows={3} />
        </Field>
        <Button variant="danger" className="w-full mt-3" disabled={busy || !reason.trim()} onClick={reject}>
          {busy ? t.common.loading : t.admin.reject}
        </Button>
      </Modal>
    </div>
  )
}
