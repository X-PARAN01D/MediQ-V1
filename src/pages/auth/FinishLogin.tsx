import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { store } from '../../lib/store'
import { isDemo } from '../../lib/config'
import { Spinner, Notice } from '../../components/ui'
import { useLang } from '../../i18n'
import type { Role } from '../../lib/types'

/** Handles the return trip from a Firebase passwordless email link. */
export default function FinishLogin() {
  const { auth } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) return
    let raw: string | null = null
    try { raw = localStorage.getItem('mediq-pending-profile') } catch { /* noop */ }
    const pending = raw ? JSON.parse(raw) : null
    const { isRegister, _docs, ...profile } = pending || {}
    auth.handleEmailLinkOnLoad(Object.keys(profile).length > 0 ? profile : undefined, !!isRegister)
      .then(async u => {
        try { localStorage.removeItem('mediq-pending-profile') } catch { /* noop */ }
        if (u && _docs) {
          try {
            if (isDemo) {
              await store().col('users').update(u.id, _docs)
            } else {
              // Firebase mode: the email-link round trip carries the doctor
              // docs as data URLs — upload them to Storage, store the URLs.
              const { uploadDataUrlFile } = await import('../../lib/uploads')
              const patch: Record<string, string> = {}
              if (_docs.licenseDocUrl) patch.licenseDocUrl = await uploadDataUrlFile(_docs.licenseDocUrl, u.id, 'license')
              if (_docs.selfieUrl) patch.selfieUrl = await uploadDataUrlFile(_docs.selfieUrl, u.id, 'selfie')
              if (Object.keys(patch).length > 0) await store().col('users').update(u.id, patch as any)
            }
          } catch { /* noop */ }
        }
        if (u) {
          const r = u.role as Role
          navigate(r === 'doctor' ? '/doctor' : r === 'admin' ? '/admin' : '/home', { replace: true })
        } else {
          navigate('/auth', { replace: true })
        }
      })
      .catch(() => setError(t.common.tryAgain))
  }, [auth])

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16">
      {error ? <Notice kind="warn">{error}</Notice> : <Spinner label={t.auth.linkSent} />}
    </div>
  )
}
