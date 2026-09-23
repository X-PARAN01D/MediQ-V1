import { backendMode, isDemo } from './config'
import { store } from './store'
import { type User, type Role } from './types'

export interface RegisterProfile {
  name: string
  role: Role
  phone?: string
  email?: string
  age?: number
  gender?: string
  village?: string
  regId?: string
  specialization?: string
  clinic?: string
}

export type AuthListener = (u: (User & { id: string }) | null) => void

export interface AuthApi {
  sendOtp(phone: string): Promise<{ demoCode?: string }>
  verifyOtp(phone: string, code: string, profile?: RegisterProfile, isRegister?: boolean): Promise<User & { id: string }>
  sendEmailLink(email: string): Promise<void>
  /** Demo only: completes the emailed link. In Firebase mode the link is completed from the /auth/finish route. */
  completeEmailLink(email: string, profile?: RegisterProfile, isRegister?: boolean): Promise<User & { id: string }>
  handleEmailLinkOnLoad(profile?: RegisterProfile, isRegister?: boolean): Promise<(User & { id: string }) | null>
  signOut(): Promise<void>
  onAuth(cb: AuthListener): () => void
  currentUser(): Promise<(User & { id: string }) | null>
}

const SESSION_KEY = 'mediq-session'
const OTP_KEY = 'mediq-demo-otp'
const EMAIL_KEY = 'mediq-demo-email'

function lsGet(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* noop */ } }
function lsDel(k: string) { try { localStorage.removeItem(k) } catch { /* noop */ } }

/**
 * Profile document body. NOTE: no ABHA ID is ever generated here — ABHA is a
 * real identity issued by ABDM; fabricating one would be dishonest. Patients
 * get `abhaId` only through the (future) ABDM linking flow.
 */
function buildBase(profile: RegisterProfile): Omit<User, 'id'> {
  const base: Omit<User, 'id'> = {
    name: profile.name, role: profile.role, phone: profile.phone, email: profile.email,
    age: profile.age, gender: profile.gender, village: profile.village,
    lang: 'en', createdAt: Date.now(),
  }
  if (profile.role === 'doctor') {
    base.regId = profile.regId
    base.specialization = profile.specialization
    base.clinic = profile.clinic
    base.verification = 'pending'
    base.verified = false
  }
  return base
}

async function findByPhone(phone: string) {
  const users = await store().col<User>('users').list(u => u.phone === phone)
  return users[0] || null
}
async function findByEmail(email: string) {
  const users = await store().col<User>('users').list(u => u.email?.toLowerCase() === email.toLowerCase())
  return users[0] || null
}

/* ------------------------------ demo ------------------------------ */

const listeners = new Set<AuthListener>()
function emit(u: (User & { id: string }) | null) {
  listeners.forEach(cb => { try { cb(u) } catch { /* noop */ } })
}

const demoAuth: AuthApi = {
  async sendOtp(phone: string) {
    lsSet(OTP_KEY, JSON.stringify({ phone, code: '123456' }))
    return { demoCode: '123456' }
  },
  async verifyOtp(phone, code, profile, isRegister) {
    const raw = lsGet(OTP_KEY)
    const rec = raw ? JSON.parse(raw) : null
    if (!rec || rec.phone !== phone || rec.code !== code) throw new Error('invalid-otp')
    let user = await findByPhone(phone)
    if (isRegister) {
      if (user) throw new Error('exists')
      user = await store().col<User>('users').create(buildBase({ ...profile!, phone }))
    } else {
      if (!user) throw new Error('not-found')
    }
    lsSet(SESSION_KEY, user.id)
    lsDel(OTP_KEY)
    emit(user)
    return user
  },
  async sendEmailLink(email: string) {
    lsSet(EMAIL_KEY, email)
  },
  async completeEmailLink(email, profile, isRegister) {
    let user = await findByEmail(email)
    if (isRegister) {
      if (user) throw new Error('exists')
      user = await store().col<User>('users').create(buildBase({ ...profile!, email }))
    } else {
      if (!user) throw new Error('not-found')
    }
    lsSet(SESSION_KEY, user.id)
    lsDel(EMAIL_KEY)
    emit(user)
    return user
  },
  async handleEmailLinkOnLoad() { return null },
  async signOut() {
    lsDel(SESSION_KEY)
    emit(null)
  },
  onAuth(cb) {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  },
  async currentUser() {
    const id = lsGet(SESSION_KEY)
    if (!id) return null
    return store().col<User>('users').get(id)
  },
}

/* ---------------------------- firebase ---------------------------- */

let fbAuth: AuthApi | null = null

async function getFirebaseAuth(): Promise<AuthApi> {
  if (fbAuth) return fbAuth
  const [{ getAuth, RecaptchaVerifier, signInWithPhoneNumber, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink },
    { firebaseApp }] = await Promise.all([import('firebase/auth'), import('./storeFirebase')])
  const auth = getAuth(firebaseApp)
  let confirmation: any = null

  const ensureRecaptcha = () => {
    let el = document.getElementById('recaptcha-container')
    if (!el) {
      el = document.createElement('div')
      el.id = 'recaptcha-container'
      document.body.appendChild(el)
    }
    return new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
  }

  /**
   * The Firestore profile document lives at /users/{firebaseAuthUid}.
   * We never search users by phone/email (rules would deny it); the UID is
   * the canonical key, matching request.auth.uid in security rules.
   */
  const resolveUser = async (
    fbUser: { uid: string; phoneNumber?: string | null; email?: string | null },
    profile?: RegisterProfile, isRegister?: boolean,
  ) => {
    const phone = fbUser.phoneNumber || profile?.phone
    const email = profile?.email || fbUser.email || undefined
    const col = store().col<User>('users')
    let user = await col.get(fbUser.uid)
    if (isRegister) {
      if (user) throw new Error('exists')
      user = await col.set(fbUser.uid, buildBase({ ...(profile as RegisterProfile), phone, email }))
    } else {
      if (!user) throw new Error('not-found')
    }
    lsSet(SESSION_KEY, user.id)
    emit(user)
    return user
  }

  fbAuth = {
    async sendOtp(phone: string) {
      confirmation = await signInWithPhoneNumber(auth, phone.startsWith('+') ? phone : `+91${phone}`, ensureRecaptcha())
      return {}
    },
    async verifyOtp(_phone, code, profile, isRegister) {
      if (!confirmation) throw new Error('no-otp-request')
      const cred = await confirmation.confirm(code)
      return resolveUser(cred.user, profile, isRegister)
    },
    async sendEmailLink(email: string) {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/auth/finish`,
        handleCodeInApp: true,
      })
      lsSet(EMAIL_KEY, email)
    },
    async completeEmailLink() { throw new Error('use-link') },
    async handleEmailLinkOnLoad(profile, isRegister) {
      if (!isSignInWithEmailLink(auth, window.location.href)) return null
      const email = lsGet(EMAIL_KEY) || window.prompt('Please confirm your email address') || ''
      const cred = await signInWithEmailLink(auth, email, window.location.href)
      lsDel(EMAIL_KEY)
      return resolveUser(cred.user, profile ? { ...profile, email } : { name: email.split('@')[0], role: 'patient', email }, isRegister)
    },
    async signOut() {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
      lsDel(SESSION_KEY)
      emit(null)
    },
    onAuth(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    async currentUser() {
      const id = lsGet(SESSION_KEY)
      if (!id) return null
      return store().col<User>('users').get(id)
    },
  }
  return fbAuth
}

/** Resolved once at app bootstrap (after getStore). */
let api: AuthApi | null = null
export async function getAuth(): Promise<AuthApi> {
  if (api) return api
  api = isDemo ? demoAuth : await getFirebaseAuth()
  void backendMode
  return api
}
export function auth(): AuthApi {
  if (!api) throw new Error('auth not initialized — await getAuth() first')
  return api
}
