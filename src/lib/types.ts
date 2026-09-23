export type Role = 'patient' | 'doctor' | 'admin'
export type Band = 'NOR' | 'MOD' | 'EMR'
export type TokenStatus = 'reserved' | 'active' | 'completed' | 'revoked'
export type VerifyStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  role: Role
  name: string
  phone?: string
  email?: string
  age?: number
  gender?: string
  village?: string
  abhaId?: string
  bloodGroup?: string
  allergies?: string
  conditions?: string
  lang?: 'en' | 'hi'
  createdAt: number
  /* doctor fields */
  regId?: string
  specialization?: string
  clinic?: string
  experience?: number
  fee?: number
  languages?: string[]
  bio?: string
  qualifications?: string
  verification?: VerifyStatus
  verificationReason?: string
  verified?: boolean
  verifiedAt?: number
  licenseDocUrl?: string
  selfieUrl?: string
  availability?: string
  deleteRequestedAt?: number
}

export interface Triage {
  id: string
  patientId: string
  patientName: string
  village?: string
  complaint: string
  symptoms: string[]
  duration: string
  severitySelf: string
  vitals?: { temp?: string; spo2?: string; bp?: string }
  notes?: string
  voiceConsent?: boolean
  transcript?: string
  score: number
  band: Band
  redFlags: string[]
  reasons: string[]
  extractedSymptoms: string[]
  createdAt: number
}

export interface Token {
  id: string
  code: string
  band: Band
  triageId: string
  patientId: string
  patientName: string
  doctorId?: string
  doctorName?: string
  status: TokenStatus
  createdAt: number
  claimedAt?: number
  completedAt?: number
  notes?: string
  callDurationSec?: number
  prescriptionId?: string
}

export interface Prescription {
  id: string
  tokenId: string
  triageId: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  items: { name: string; dosage: string; frequency: string; durationDays: string }[]
  advice?: string
  createdAt: number
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  specialization?: string
  date: string
  slot: string
  status: 'upcoming' | 'completed' | 'cancelled'
  createdAt: number
}

export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  channel: 'sms' | 'inapp' | 'email'
  read: boolean
  readAt?: number
  kind?: string
  refId?: string
  createdAt: number
}

export interface AuditEntry {
  id: string
  actorId: string
  actorName: string
  action: string
  detail?: string
  createdAt: number
}

export interface EmergencyAlert {
  id: string
  patientId: string
  patientName: string
  phone?: string
  lat?: number
  lng?: number
  bloodGroup?: string
  allergies?: string
  conditions?: string
  status: 'sent' | 'acknowledged'
  createdAt: number
}

export interface ChatMessage {
  id: string
  from: 'user' | 'saathi'
  text: string
  createdAt: number
  action?: { label: string; href: string }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function todayIST(): string {
  // YYYY-MM-DD in Asia/Kolkata
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Epoch ms of today's 00:00 in Asia/Kolkata — for server-side day filters. */
export function dayStartIST(): number {
  const now = Date.now()
  // IST offset is +5:30 year-round (no DST).
  const ist = new Date(now + 5.5 * 3600 * 1000)
  ist.setUTCHours(0, 0, 0, 0)
  return ist.getTime() - 5.5 * 3600 * 1000
}

export function fmtDate(ts: number, lang: 'en' | 'hi' = 'en'): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(ts))
}

export function fmtTime(ts: number): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(ts))
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
