import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { isDemo } from '../../lib/config'
import { downscaleImage } from '../../lib/uploads'
import {
  Button, Card, SectionTitle, Field, Notice, Spinner, EmptyState,
} from '../../components/ui'
import { IconShieldCheck, IconAlertTri, IconCheckCircle } from '../../components/icons'
import type { User } from '../../lib/types'

export default function VerifyStatus() {
  const { user, refresh } = useAuth()
  const { t } = useLang()
  const [license, setLicense] = useState<string | null>(null)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const licRef = useRef<HTMLInputElement>(null)
  const selRef = useRef<HTMLInputElement>(null)
  // Original files for the Storage upload in Firebase mode.
  const licFile = useRef<File | null>(null)
  const selFile = useRef<File | null>(null)

  if (!user) return <Spinner />
  // NOTE: licenseDocUrl/selfieUrl are not yet on the shared User type — flagged to parent.
  type DocUser = User & { id: string; licenseDocUrl?: string; selfieUrl?: string }
  const du = user as DocUser
  const status = du.verification || 'pending'

  const pick = async (file: File | undefined, setter: (s: string) => void, keep: React.MutableRefObject<File | null>) => {
    if (!file) return
    setErr('')
    try {
      keep.current = file
      setter(await downscaleImage(file))
    } catch {
      setErr('Could not read that image. Please try another file.')
    }
  }

  const resubmit = async () => {
    if (!licFile.current && !selFile.current && !du.licenseDocUrl && !du.selfieUrl) {
      setErr('Upload at least one document to resubmit.')
      return
    }
    setBusy(true); setErr('')
    try {
      let licenseUrl = du.licenseDocUrl
      let selfieUrl = du.selfieUrl
      if (isDemo) {
        if (license) licenseUrl = license
        if (selfie) selfieUrl = selfie
      } else {
        // Firebase mode: documents go to Storage; only download URLs on the doc.
        const { uploadVerificationFile } = await import('../../lib/uploads')
        if (licFile.current) licenseUrl = await uploadVerificationFile(licFile.current, user.id, 'license')
        if (selFile.current) selfieUrl = await uploadVerificationFile(selFile.current, user.id, 'selfie')
      }
      await store().col<User>('users').update(user.id, {
        licenseDocUrl: licenseUrl,
        selfieUrl: selfieUrl,
        verification: 'pending',
        verificationReason: undefined,
      } as Partial<User>)
      await refresh()
    } finally { setBusy(false) }
  }

  const docImg = (src?: string, label?: string) => src && src.startsWith('data:') ? (
    <div>
      <p className="text-[12px] font-medium text-ink-500 mb-1">{label}</p>
      <img src={src} alt={label} className="w-full max-h-56 object-contain rounded-xl border border-slate-100 bg-slate-50" />
    </div>
  ) : null

  return (
    <div className="space-y-4">
      <SectionTitle>{t.doctor.verification}</SectionTitle>

      {status === 'approved' && (
        <Card className="p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-700 flex items-center justify-center mx-auto mb-3">
            <IconShieldCheck size={28} />
          </div>
          <p className="font-bold text-ink-900 text-[16px]">{t.doctor.approved}</p>
          <p className="text-[13px] text-ink-500 mt-1">
            Your license is verified. A verified badge now appears on your profile.
          </p>
        </Card>
      )}

      {status === 'pending' && (
        <Notice kind="warn">
          <p className="font-semibold inline-flex items-center gap-1.5"><IconAlertTri size={15} />{t.doctor.pending}</p>
          <p className="mt-1">{t.auth.doctorPending} You will be notified once reviewed. You cannot claim tokens until approved.</p>
        </Notice>
      )}

      {status === 'rejected' && (
        <Card className="p-4">
          <Notice kind="warn">
            <p className="font-semibold">{t.doctor.rejected}</p>
            {user.verificationReason && <p className="mt-1"><b>{t.doctor.rejectionReason}:</b> {user.verificationReason}</p>}
          </Notice>
        </Card>
      )}

      {(status === 'pending' || status === 'rejected') && (
        <Card className="p-4 space-y-4">
          <p className="font-semibold text-ink-900">{t.doctor.resubmit}</p>
          {docImg(du.licenseDocUrl, t.auth.licenseDoc)}
          {docImg(du.selfieUrl, t.auth.selfie)}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field label={t.auth.licenseDoc}>
                <input ref={licRef} type="file" accept="image/*" className="hidden"
                  onChange={e => pick(e.target.files?.[0], setLicense, licFile)} />
                <Button variant="secondary" size="sm" className="w-full" onClick={() => licRef.current?.click()}>
                  {license ? 'Selected' : 'Choose file'}
                </Button>
              </Field>
              {license && <img src={license} alt="" className="mt-2 w-full max-h-40 object-contain rounded-xl border border-slate-100" />}
            </div>
            <div>
              <Field label={t.auth.selfie}>
                <input ref={selRef} type="file" accept="image/*" className="hidden"
                  onChange={e => pick(e.target.files?.[0], setSelfie, selFile)} />
                <Button variant="secondary" size="sm" className="w-full" onClick={() => selRef.current?.click()}>
                  {selfie ? 'Selected' : 'Choose file'}
                </Button>
              </Field>
              {selfie && <img src={selfie} alt="" className="mt-2 w-full max-h-40 object-contain rounded-xl border border-slate-100" />}
            </div>
          </div>

          {err && <Notice kind="warn">{err}</Notice>}
          <Button className="w-full" onClick={resubmit} disabled={busy}>
            {busy ? t.common.loading : t.doctor.resubmit}
          </Button>
        </Card>
      )}

      {status !== 'approved' && status !== 'pending' && status !== 'rejected' && (
        <Card><EmptyState icon={<IconCheckCircle size={22} />} title={t.doctor.verification} /></Card>
      )}
    </div>
  )
}
