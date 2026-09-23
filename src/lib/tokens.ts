import { store } from './store'
import { isDemo } from './config'
import { todayIST, type Token, type Triage, type Band, type User } from './types'
import { notify } from './notify'

/**
 * Issues a colour-coded daily token: NOR001 / MOD001 / EMR001.
 * Idempotent on triageId — re-issuing for the same triage returns the existing token.
 *
 * Demo mode: local deterministic issuance (same algorithm as the server).
 * Firebase mode: the `issueToken` callable Cloud Function performs the
 * issuance inside a Firestore transaction — the client is denied direct
 * /tokens creation by security rules.
 */
export async function issueToken(triage: DocTriage): Promise<Token & { id: string }> {
  if (!isDemo) {
    const { callFn } = await import('./storeFirebase')
    const res = await callFn<Token & { id: string }>('issueToken', { triageId: triage.id })
    return res
  }
  const s = store()
  const existing = await s.col<Token>('tokens').list(t => t.triageId === triage.id)
  if (existing.length > 0) return existing[0]

  const day = todayIST()
  const sameBand = await s.col<Token>('tokens').list(
    t => t.band === triage.band && new Date(t.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === day
  )
  const n = sameBand.length + 1
  const code = `${triage.band}${String(n).padStart(3, '0')}`

  const token = await s.col<Token>('tokens').create({
    code, band: triage.band, triageId: triage.id,
    patientId: triage.patientId, patientName: triage.patientName,
    status: 'reserved', createdAt: Date.now(),
  } as Token)

  await notify(triage.patientId, {
    kind: 'token_issued', refId: token.id, channel: 'sms',
    title: `Token ${code} issued`,
    body: `MediQ: Your ${bandLabel(triage.band)} token ${code} is reserved for today. Show this at the clinic.`,
  })
  return token
}

type DocTriage = Triage & { id: string }

export function bandLabel(band: Band): string {
  return { NOR: 'Normal', MOD: 'Moderate', EMR: 'Emergency' }[band]
}

/**
 * Doctor claims a token: reserved -> active. Returns false if already claimed.
 * Firebase mode: atomic transaction in the `claimToken` callable (prevents two
 * doctors claiming the same token concurrently).
 */
export async function claimToken(tokenId: string, doctor: User): Promise<boolean> {
  if (!isDemo) {
    const { callFn } = await import('./storeFirebase')
    const res = await callFn<{ ok: boolean; alreadyClaimed: boolean }>('claimToken', { tokenId })
    return res.ok && !res.alreadyClaimed
  }
  const s = store()
  const t = await s.col<Token>('tokens').get(tokenId)
  if (!t || t.status !== 'reserved') return false
  await s.col<Token>('tokens').update(tokenId, {
    status: 'active', doctorId: doctor.id, doctorName: doctor.name, claimedAt: Date.now(),
  })
  await s.col('audit').create({
    actorId: doctor.id, actorName: doctor.name, action: 'token_claimed',
    detail: `Claimed ${t.code} for ${t.patientName}`, createdAt: Date.now(),
  })
  await notify(t.patientId, {
    kind: 'token_claimed', refId: tokenId, channel: 'sms',
    title: `Doctor assigned — ${t.code}`,
    body: `MediQ: Dr. ${doctor.name.replace(/^Dr\.\s*/, '')} will see you now (token ${t.code}).`,
  })
  return true
}

export async function releaseToken(tokenId: string, doctor: User): Promise<void> {
  if (!isDemo) {
    const { callFn } = await import('./storeFirebase')
    await callFn('releaseToken', { tokenId })
    return
  }
  const s = store()
  await s.col<Token>('tokens').update(tokenId, {
    status: 'reserved', doctorId: undefined, doctorName: undefined, claimedAt: undefined,
  })
  await s.col('audit').create({
    actorId: doctor.id, actorName: doctor.name, action: 'token_released',
    detail: `Released token ${tokenId}`, createdAt: Date.now(),
  })
}

/** Booked appointment slots for a doctor as "date|slot" strings (no patient PII). */
export async function getBookedSlots(doctorId: string): Promise<string[]> {
  if (!isDemo) {
    const { callFn } = await import('./storeFirebase')
    const res = await callFn<{ slots: string[] }>('bookedSlots', { doctorId })
    return res.slots || []
  }
  const s = store()
  const today = todayIST()
  const list = await s.col('appointments').list((a: any) =>
    a.doctorId === doctorId && a.status === 'upcoming' && a.date >= today)
  return list.map((a: any) => `${a.date}|${a.slot}`)
}

export async function completeToken(
  tokenId: string, doctor: User, notes: string, prescriptionId?: string, callDurationSec?: number
): Promise<void> {
  const s = store()
  const t = await s.col<Token>('tokens').get(tokenId)
  if (!t) return
  await s.col<Token>('tokens').update(tokenId, {
    status: 'completed', notes, prescriptionId, callDurationSec, completedAt: Date.now(),
  })
  await s.col('audit').create({
    actorId: doctor.id, actorName: doctor.name, action: 'token_completed',
    detail: `Completed ${t.code} for ${t.patientName}`, createdAt: Date.now(),
  })
  await notify(t.patientId, {
    kind: 'token_completed', refId: tokenId, channel: 'sms',
    title: `Visit complete — ${t.code}`,
    body: `MediQ: Your consultation (${t.code}) is complete. Your e-receipt${prescriptionId ? ' and prescription are' : ' is'} ready in the app.`,
  })
}

export async function cancelToken(tokenId: string, patientId: string): Promise<void> {
  const s = store()
  await s.col<Token>('tokens').update(tokenId, { status: 'revoked' })
  await s.col('audit').create({
    actorId: patientId, actorName: '', action: 'token_cancelled',
    detail: `Token ${tokenId} cancelled by patient`, createdAt: Date.now(),
  })
}

/** Queue position: active/reserved tokens of the same band created earlier today. */
export async function queuePosition(token: Token & { id: string }): Promise<{ ahead: number; estWaitMin: number }> {
  if (!isDemo) {
    // Patients cannot list other patients' tokens under the security rules,
    // so the count is computed by the `queuePosition` callable.
    const { callFn } = await import('./storeFirebase')
    return callFn('queuePosition', { tokenId: token.id })
  }
  const s = store()
  const day = todayIST()
  const same = await s.col<Token>('tokens').list(t =>
    t.band === token.band &&
    (t.status === 'reserved' || t.status === 'active') &&
    new Date(t.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === day &&
    t.createdAt < token.createdAt
  )
  const ahead = same.length
  const perPatientMin = token.band === 'EMR' ? 5 : token.band === 'MOD' ? 10 : 12
  return { ahead, estWaitMin: ahead * perPatientMin }
}
