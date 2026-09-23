// Logic smoke test — bundled with esbuild, run in node. Not part of the app bundle.
;(globalThis as any).localStorage = (() => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => m.clear(),
  }
})()

import { runTriage } from '../src/lib/triage'
import { issueToken, claimToken, completeToken, queuePosition, bandLabel } from '../src/lib/tokens'
import { saathiReply } from '../src/lib/saathi'
import { store, getStore } from '../src/lib/store'
import type { Triage, User } from '../src/lib/types'

let fails = 0
const check = (name: string, cond: boolean, extra?: any) => {
  if (cond) console.log(`  ok  ${name}`)
  else { fails++; console.log(`  FAIL ${name}`, extra ?? '') }
}

const doctor: User = { id: 'd1', name: 'Dr. Test', role: 'doctor', phone: '9000000001', email: 'd@t.in', lang: 'en', createdAt: Date.now() }

async function makeTriage(patientId: string, patientName: string, complaint: string, symptoms: string[] = []) {
  const r = runTriage({ complaint, symptoms, duration: '1-3', severitySelf: 'moderate' })
  return store().col<Triage>('triages').create({
    patientId, patientName, complaint, symptoms,
    duration: '1-3', severitySelf: 'moderate',
    score: r.score, band: r.band, redFlags: r.redFlags, reasons: r.reasons,
    createdAt: Date.now(),
  })
}

async function main() {
  await getStore()
  console.log('triage engine')
  const r1 = runTriage({ complaint: 'severe chest pain and sweating', symptoms: ['chestPain'], duration: 'lt1', severitySelf: 'severe' })
  check('chest pain -> EMR', r1.band === 'EMR', r1)
  check('red flag recorded', r1.redFlags.length > 0, r1.redFlags)
  check('score >= 70 for emergency', r1.score >= 70, r1.score)

  const r2 = runTriage({ complaint: 'mild cold and runny nose', symptoms: ['cold'], duration: '1-3', severitySelf: 'mild' })
  check('mild cold -> NOR', r2.band === 'NOR', r2)

  const r3 = runTriage({ complaint: 'mujhe bukhar hai aur khansi', symptoms: [], duration: '1-3', severitySelf: 'moderate' })
  check('transliterated hindi fever extracted', r3.extractedSymptoms.includes('fever'), r3.extractedSymptoms)

  const r4 = runTriage({ complaint: 'headache', symptoms: ['headache'], duration: '1-3', severitySelf: 'mild', vitals: { spo2: '88' } })
  check('spo2 88 escalates to EMR', r4.band === 'EMR', r4)

  const r5 = runTriage({ complaint: 'stomach ache for 5 days, vomiting twice', symptoms: ['stomachPain'], duration: '4-7', severitySelf: 'moderate' })
  check('moderate case -> MOD', r5.band === 'MOD', r5)
  check('bandLabel EMR', bandLabel('EMR') === 'Emergency')

  console.log('token engine')
  const tr1 = await makeTriage('p1', 'Ramesh', 'severe chest pain', ['chestPain'])
  const t1 = await issueToken(tr1)
  check('first EMR token code EMR001', t1.code === 'EMR001', t1.code)
  check('triage stored on token', t1.triageId === tr1.id)
  const t1b = await issueToken(tr1)
  check('idempotent re-issue returns same token', t1b.id === t1.id && t1b.code === 'EMR001')

  const tr2 = await makeTriage('p2', 'Sita', 'mild cold', ['cold'])
  const t2 = await issueToken(tr2)
  check('first NOR token code NOR001', t2.code === 'NOR001', t2.code)
  const qp = await queuePosition(t2)
  check('queue position ahead=0 for first NOR token', qp.ahead === 0, qp)

  const claimed = await claimToken(t2.id, doctor)
  check('claim returns true', claimed === true)
  const claimed2 = await claimToken(t2.id, doctor)
  check('double claim returns false (lock)', claimed2 === false)
  await completeToken(t2.id, doctor, 'Recovered', undefined, 300)
  const done = await store().col('tokens').get(t2.id)
  check('complete sets completed + duration', done?.status === 'completed' && done?.callDurationSec === 300, done)

  console.log('saathi brain')
  const s1 = await saathiReply('I have severe chest pain', 'en', [])
  check('emergency text escalates to 108', s1.action?.href === 'tel:108', s1)
  const s2 = await saathiReply('hello', 'en', [])
  check('greeting is short', s2.text.length < 160, s2.text)
  const s3 = await saathiReply('I want to book an appointment', 'en', [])
  check('booking intent gets navigation action', !!s3.action?.href, s3)

  console.log('notifications')
  const notifs = await store().col('notifications').list(n => (n as any).userId === 'p2')
  check('sms notification recorded for patient', notifs.length > 0, notifs.length)

  console.log(fails === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${fails} FAILURES`)
  if (fails > 0) throw new Error('smoke failed')
}

main().catch(e => { console.error(e); throw e })
