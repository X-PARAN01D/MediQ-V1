import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { isDemo } from '../lib/config'
import { store } from '../lib/store'
import { Button, Card, Field, Input, Select, SegmentedControl, Notice, Spinner } from '../components/ui'
import { IconPhone, IconShieldCheck } from '../components/icons'
import type { Role } from '../lib/types'
import type { RegisterProfile } from '../lib/auth'
import { downscaleImage } from '../lib/uploads'

const SPECIALIZATIONS = [
  'General Physician', 'Pediatrician', 'Gynecologist', 'Orthopedic', 'Dermatologist',
  'Cardiologist', 'Neurologist', 'ENT Specialist', 'Ophthalmologist', 'Psychiatrist',
]

export default function Auth() {
  const { t } = useLang()
  const { auth } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [role, setRole] = useState<Role>(params.get('role') === 'doctor' ? 'doctor' : 'patient')
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const [method, setMethod] = useState<'phone' | 'email'>('phone')

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [village, setVillage] = useState('')
  const [regId, setRegId] = useState('')
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0])
  const [clinic, setClinic] = useState('')
  const [contact, setContact] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  const [selfieUrl, setSelfieUrl] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const licenseRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)
  // Original picked files — needed for the Storage upload in Firebase mode
  // (the preview URLs are only downscaled data URLs).
  const licenseFile = useRef<File | null>(null)
  const selfieFile = useRef<File | null>(null)

  const cleanPhone = useMemo(() => phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''), [phone])
  const phoneOk = /^\d{10}$/.test(cleanPhone)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const goHome = (r: Role) => navigate(r === 'doctor' ? '/doctor' : r === 'admin' ? '/admin' : '/home', { replace: true })

  const saveDoctorDocs = async (userId: string) => {
    if (role !== 'doctor' || (!licenseUrl && !selfieUrl)) return
    try {
      if (isDemo) {
        await store().col('users').update(userId, {
          licenseDocUrl: licenseUrl || undefined,
          selfieUrl: selfieUrl || undefined,
        } as any)
        return
      }
      // Firebase mode: licence/selfie go to Storage; only the download URL
      // is stored on the user document (data URLs would bloat Firestore).
      const { uploadVerificationFile } = await import('../lib/uploads')
      const patch: Record<string, string> = {}
      if (licenseFile.current) patch.licenseDocUrl = await uploadVerificationFile(licenseFile.current, userId, 'license')
      if (selfieFile.current) patch.selfieUrl = await uploadVerificationFile(selfieFile.current, userId, 'selfie')
      if (Object.keys(patch).length > 0) await store().col('users').update(userId, patch as any)
    } catch { /* non-fatal */ }
  }

  const buildProfile = (): RegisterProfile => {
    const base: RegisterProfile = {
      name: name.trim(), role,
      phone: method === 'phone' ? cleanPhone : (role === 'doctor' ? contact.replace(/\D/g, '') : undefined),
      email: method === 'email' ? email.trim().toLowerCase() : undefined,
    }
    if (role === 'patient') {
      base.age = age ? parseInt(age, 10) : undefined
      base.gender = gender || undefined
      base.village = village.trim() || undefined
    } else {
      base.regId = regId.trim()
      base.specialization = specialization
      base.clinic = clinic.trim()
    }
    return base
  }

  const validateRegister = (): string => {
    if (!name.trim()) return t.validation.required
    if (role === 'patient') {
      if (age && (isNaN(parseInt(age, 10)) || parseInt(age, 10) < 0 || parseInt(age, 10) > 120)) return t.validation.ageInvalid
    } else {
      if (!regId.trim()) return t.validation.required
      if (!clinic.trim()) return t.validation.required
      if (method === 'email' && !/^\d{10}$/.test(contact.replace(/\D/g, ''))) return t.validation.phoneInvalid
    }
    return ''
  }

  /* ------------------------------ phone ------------------------------ */
  const sendOtp = async () => {
    if (!auth || !phoneOk) { setError(t.validation.phoneInvalid); return }
    if (mode === 'register') {
      const v = validateRegister()
      if (v) { setError(v); return }
    }
    setBusy(true); setError('')
    try {
      const r = await auth.sendOtp(cleanPhone)
      setOtpSent(true)
      if (r.demoCode) setOtp(r.demoCode) // demo convenience — user can still retype
    } catch {
      setError(t.common.tryAgain)
    } finally { setBusy(false) }
  }

  const verifyOtp = async () => {
    if (!auth || otp.trim().length !== 6) { setError(t.validation.otpInvalid); return }
    setBusy(true); setError('')
    try {
      const profile = mode === 'register' ? buildProfile() : undefined
      const u = await auth.verifyOtp(cleanPhone, otp.trim(), profile, mode === 'register')
      await saveDoctorDocs(u.id)
      goHome(u.role)
    } catch (e: any) {
      setError(e?.message === 'invalid-otp' ? t.validation.otpInvalid
        : e?.message === 'not-found' ? t.auth.haveAccount + ' — ' + t.auth.register
        : e?.message === 'exists' ? t.auth.haveAccount : t.common.tryAgain)
    } finally { setBusy(false) }
  }

  /* ------------------------------ email ------------------------------ */
  const sendLink = async () => {
    if (!auth || !emailOk) { setError(t.validation.emailInvalid); return }
    if (mode === 'register') {
      const v = validateRegister()
      if (v) { setError(v); return }
    }
    setBusy(true); setError('')
    try {
      if (mode === 'register') {
        try {
          localStorage.setItem('mediq-pending-profile', JSON.stringify({
            ...buildProfile(), isRegister: true,
            _docs: role === 'doctor' ? { licenseDocUrl: licenseUrl || undefined, selfieUrl: selfieUrl || undefined } : undefined,
          }))
        } catch { /* noop */ }
      }
      await auth.sendEmailLink(email.trim().toLowerCase())
      setLinkSent(true)
    } catch {
      setError(t.common.tryAgain)
    } finally { setBusy(false) }
  }

  const openDemoLink = async () => {
    if (!auth) return
    setBusy(true); setError('')
    try {
      const profile = mode === 'register' ? buildProfile() : undefined
      const u = await auth.completeEmailLink(email.trim().toLowerCase(), profile, mode === 'register')
      await saveDoctorDocs(u.id)
      goHome(u.role)
    } catch (e: any) {
      setError(e?.message === 'not-found' ? t.auth.needAccount : t.common.tryAgain)
    } finally { setBusy(false) }
  }

  const onFile = async (f: File | undefined, set: (s: string) => void, keep: React.MutableRefObject<File | null>) => {
    if (!f) return
    try { keep.current = f; set(await downscaleImage(f)) } catch { setError(t.common.tryAgain) }
  }

  return (
    <div className="fade-up pb-10">
      {/* 108 emergency banner */}
      <a href="tel:108" className="flex items-center gap-3 bg-red-600 text-white rounded-2xl px-4 py-3 mt-2 shadow-card">
        <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0"><IconPhone size={18} /></span>
        <span>
          <span className="block font-bold text-[15px] leading-tight">{t.auth.emergencyBanner}</span>
          <span className="block text-[12px] text-red-100">{t.auth.emergencyBannerHi}</span>
        </span>
      </a>

      <h1 className="text-[22px] font-bold tracking-tight text-ink-900 mt-6">
        {mode === 'login' ? t.auth.loginTitle : t.auth.registerTitle}
      </h1>

      {/* role tabs */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {(['patient', 'doctor'] as Role[]).map(r => (
          <button key={r} onClick={() => { setRole(r); setError('') }}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition ${role === r ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'}`}>
            <span className={`block font-semibold text-[15px] ${role === r ? 'text-brand-800' : 'text-ink-900'}`}>
              {r === 'patient' ? t.auth.rolePatient : t.auth.roleDoctor}
            </span>
            <span className="block text-xs text-ink-400 mt-0.5">{r === 'patient' ? t.auth.rolePatientHi : t.auth.roleDoctorHi}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5">
        <SegmentedControl
          options={[{ value: 'login', label: t.auth.login }, { value: 'register', label: t.auth.register }]}
          value={mode} onChange={v => { setMode(v); setError(''); setOtpSent(false); setLinkSent(false) }} />
        <SegmentedControl
          options={[{ value: 'phone', label: t.auth.methodPhone }, { value: 'email', label: t.auth.methodEmail }]}
          value={method} onChange={v => { setMethod(v); setError(''); setOtpSent(false); setLinkSent(false) }} />
      </div>

      <Card className="p-5 mt-4 space-y-4">
        {error && <Notice kind="warn">{error}</Notice>}

        {mode === 'register' && (
          <>
            <Field label={t.auth.name} required><Input value={name} onChange={e => setName(e.target.value)} placeholder={t.auth.name} /></Field>
            {role === 'patient' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.auth.age}><Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="35" /></Field>
                <Field label={t.auth.gender}>
                  <Select value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">—</option>
                    <option value="male">{t.common.male}</option>
                    <option value="female">{t.common.female}</option>
                    <option value="other">{t.common.other}</option>
                  </Select>
                </Field>
              </div>
            ) : (
              <>
                <Field label={t.auth.regId} required><Input value={regId} onChange={e => setRegId(e.target.value)} placeholder="MCI-12345" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.auth.specialization}>
                    <Select value={specialization} onChange={e => setSpecialization(e.target.value)}>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </Field>
                  <Field label={t.auth.clinic} required><Input value={clinic} onChange={e => setClinic(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[13px] font-medium text-ink-700 mb-1.5">{t.auth.licenseDoc}</span>
                    <input ref={licenseRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0], setLicenseUrl, licenseFile)} />
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => licenseRef.current?.click()}>
                      {licenseUrl ? t.common.yes : t.auth.licenseDoc}
                    </Button>
                    <p className="text-[11px] text-ink-400 mt-1">{t.auth.licenseHint}</p>
                  </div>
                  <div>
                    <span className="block text-[13px] font-medium text-ink-700 mb-1.5">{t.auth.selfie}</span>
                    <input ref={selfieRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0], setSelfieUrl, selfieFile)} />
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => selfieRef.current?.click()}>
                      {selfieUrl ? t.common.yes : t.auth.selfie}
                    </Button>
                    <p className="text-[11px] text-ink-400 mt-1">{t.auth.selfieHint}</p>
                  </div>
                </div>
              </>
            )}
            {role === 'patient' && (
              <Field label={t.auth.village}><Input value={village} onChange={e => setVillage(e.target.value)} /></Field>
            )}
          </>
        )}

        {method === 'phone' ? (
          <>
            <Field label={t.auth.phone} hint={t.auth.phoneHint} required>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-xl border border-slate-200 bg-slate-50 text-ink-700 font-medium">+91</span>
                <Input value={phone} onChange={e => setPhone(e.target.value)} inputMode="numeric" placeholder="98765 43210" disabled={otpSent} />
              </div>
            </Field>
            {!otpSent ? (
              <Button className="w-full" disabled={busy || !phoneOk} onClick={sendOtp}>
                {busy ? <Spinner /> : t.auth.sendOtp}
              </Button>
            ) : (
              <>
                <Notice>{t.auth.otpSent}. {t.auth.otpHint}.</Notice>
                {isDemo && <Notice kind="warn">{t.auth.demoOtpIs}: <b>123456</b></Notice>}
                <Field label="OTP" required>
                  <Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="••••••" />
                </Field>
                <Button className="w-full" disabled={busy} onClick={verifyOtp}>
                  {busy ? <Spinner /> : t.auth.verifyOtp}
                </Button>
                <button className="text-brand-700 text-sm font-medium mx-auto block" onClick={() => { setOtpSent(false); setOtp('') }}>
                  {t.common.retry}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <Field label={t.auth.email} required>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={linkSent && !isDemo} />
            </Field>
            {role === 'doctor' && mode === 'register' && (
              <Field label={t.auth.contact} required hint={t.auth.phoneHint}>
                <Input value={contact} onChange={e => setContact(e.target.value)} inputMode="numeric" placeholder="98765 43210" />
              </Field>
            )}
            {!linkSent ? (
              <>
                <Button className="w-full" disabled={busy || !emailOk} onClick={sendLink}>
                  {busy ? <Spinner /> : t.auth.sendLink}
                </Button>
                <p className="text-xs text-ink-400 text-center">{t.auth.emailLinkNote}</p>
              </>
            ) : (
              <>
                <Notice>{t.auth.linkSent}. {t.auth.linkHint}.</Notice>
                {isDemo ? (
                  <Card className="p-4 border-dashed">
                    <p className="text-[13px] font-medium text-ink-700 mb-2">Demo inbox — {email}</p>
                    <button onClick={openDemoLink} disabled={busy}
                      className="w-full text-left rounded-xl border border-brand-200 bg-brand-50 p-3 hover:bg-brand-100 transition">
                      <span className="flex items-center gap-2 font-medium text-brand-800 text-sm">
                        <IconShieldCheck size={16} /> Sign in to MediQ
                      </span>
                      <span className="text-xs text-ink-500">Tap to open your sign-in link</span>
                    </button>
                  </Card>
                ) : (
                  <p className="text-sm text-ink-500 text-center">{t.auth.linkHint}</p>
                )}
              </>
            )}
          </>
        )}

        {mode === 'register' && role === 'patient' && (
          <p className="text-xs text-ink-400 text-center">{t.auth.abhaNote}</p>
        )}
        {mode === 'register' && role === 'doctor' && (
          <p className="text-xs text-ink-400 text-center">{t.auth.verifyLater}</p>
        )}
      </Card>

      <p className="text-center text-sm text-ink-500 mt-5">
        {mode === 'login' ? t.auth.needAccount : t.auth.haveAccount}{' '}
        <button className="text-brand-700 font-semibold" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? t.auth.register : t.auth.login}
        </button>
      </p>
    </div>
  )
}
