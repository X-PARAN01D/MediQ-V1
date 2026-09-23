import type { Band } from './types'

/* ------------------------------------------------------------------ */
/* Deterministic triage engine. Red flags always run first and cannot  */
/* be overridden by AI or by user input. Scores: 0–29 Normal,          */
/* 30–69 Moderate, 70–100 Emergency.                                   */
/* ------------------------------------------------------------------ */

export interface SymptomDef {
  id: string
  en: string
  hi: string
  weight: number
  redFlag?: boolean
}

export const SYMPTOMS: SymptomDef[] = [
  { id: 'fever', en: 'Fever', hi: 'बुखार', weight: 12 },
  { id: 'cough', en: 'Cough', hi: 'खांसी', weight: 8 },
  { id: 'cold', en: 'Cold / runny nose', hi: 'सर्दी-जुकाम', weight: 5 },
  { id: 'headache', en: 'Headache', hi: 'सिरदर्द', weight: 8 },
  { id: 'bodyache', en: 'Body ache', hi: 'बदन दर्द', weight: 8 },
  { id: 'soreThroat', en: 'Sore throat', hi: 'गले में खराश', weight: 6 },
  { id: 'stomachPain', en: 'Stomach pain', hi: 'पेट दर्द', weight: 10 },
  { id: 'vomiting', en: 'Vomiting', hi: 'उल्टी', weight: 12 },
  { id: 'diarrhea', en: 'Diarrhea', hi: 'दस्त', weight: 12 },
  { id: 'dizziness', en: 'Dizziness', hi: 'चक्कर आना', weight: 14 },
  { id: 'injury', en: 'Injury / fracture', hi: 'चोट / फ्रैक्चर', weight: 18 },
  { id: 'rash', en: 'Skin rash', hi: 'त्वचा पर दाने', weight: 7 },
  { id: 'weakness', en: 'Weakness', hi: 'कमज़ोरी', weight: 9 },
  { id: 'burningUrine', en: 'Burning urination', hi: 'पेशाब में जलन', weight: 8 },
  { id: 'breathless', en: 'Difficulty breathing', hi: 'सांस लेने में तकलीफ', weight: 32, redFlag: true },
  { id: 'chestPain', en: 'Chest pain', hi: 'छाती में दर्द', weight: 38, redFlag: true },
  { id: 'faint', en: 'Fainted / unconscious', hi: 'बेहोश होना', weight: 48, redFlag: true },
  { id: 'bleeding', en: 'Heavy bleeding', hi: 'तेज़ खून बहना', weight: 45, redFlag: true },
  { id: 'seizure', en: 'Seizure / fits', hi: 'दौरा पड़ना', weight: 46, redFlag: true },
  { id: 'strokeSigns', en: 'Face droop / slurred speech', hi: 'मुंह टेढ़ा / लड़खड़ाती ज़ुबान', weight: 46, redFlag: true },
]

export const symptomById = (id: string): SymptomDef | undefined => SYMPTOMS.find(s => s.id === id)

/* Free-text keyword extraction (English + transliterated Hindi + Devanagari). */
const KEYWORDS: Record<string, string[]> = {
  fever: ['fever', 'bukhar', 'बुखार', 'taap', 'ताप'],
  cough: ['cough', 'khansi', 'khasi', 'खांसी'],
  cold: ['cold', 'sardi', 'jukam', 'zukam', 'सर्दी', 'जुकाम', 'runny nose'],
  headache: ['headache', 'sir dard', 'sirdard', 'सिरदर्द', 'sir me dard'],
  bodyache: ['body ache', 'badan dard', 'बदन दर्द', 'ang dard'],
  soreThroat: ['sore throat', 'gale me', 'गले'],
  stomachPain: ['stomach', 'pet dard', 'पेट दर्द', 'pet me dard', 'abdominal'],
  vomiting: ['vomit', 'ulti', 'उल्टी'],
  diarrhea: ['diarrhea', 'dast', 'दस्त', 'loose motion'],
  dizziness: ['dizz', 'chakkar', 'चक्कर'],
  injury: ['injur', 'chot', 'चोट', 'fracture', 'fell', 'gir'],
  rash: ['rash', 'daane', 'दाने', 'itching', 'khujli'],
  weakness: ['weak', 'kamzori', 'कमज़ोरी'],
  burningUrine: ['burning', 'peshab', 'पेशाब'],
  breathless: ['breath', 'saans', 'सांस', 'dum ghut'],
  chestPain: ['chest pain', 'chhati', 'छाती'],
  faint: ['faint', 'behosh', 'बेहोश', 'unconscious'],
  bleeding: ['bleed', 'khoon', 'खून'],
  seizure: ['seizure', 'daura', 'दौरा', 'fits', 'mirgi'],
  strokeSigns: ['face droop', 'slurr', 'muh tedha', 'लकवा', 'paralysis'],
}

export function extractSymptoms(text: string): string[] {
  const t = ` ${text.toLowerCase()} `
  const found = new Set<string>()
  for (const [id, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => t.includes(w))) found.add(id)
  }
  return [...found]
}

export interface TriageInput {
  complaint: string
  symptoms: string[]
  duration: 'lt1' | '1-3' | '4-7' | 'gt7'
  severitySelf: 'mild' | 'moderate' | 'severe'
  vitals?: { temp?: string; spo2?: string; bp?: string }
  transcript?: string
  notes?: string
}

export interface TriageResult {
  score: number
  band: Band
  redFlags: string[]
  reasons: string[]
  extractedSymptoms: string[]
}

const DUR_LABEL: Record<string, string> = {
  'lt1': 'less than a day', '1-3': '1–3 days', '4-7': '4–7 days', 'gt7': 'more than a week',
}

export function runTriage(input: TriageInput): TriageResult {
  const reasons: string[] = []
  const redFlags: string[] = []
  const extracted = extractSymptoms(`${input.complaint} ${input.transcript || ''}`)
  const all = new Set([...input.symptoms, ...extracted])
  const matched = [...all].map(symptomById).filter(Boolean) as SymptomDef[]

  let score = 0
  for (const s of matched) {
    score += s.weight
    if (s.redFlag && !redFlags.includes(s.en)) redFlags.push(s.en)
  }
  if (matched.length > 0) reasons.push(`${matched.length} symptom${matched.length > 1 ? 's' : ''} reported: ${matched.map(s => s.en).join(', ')}`)

  const durBonus = { 'lt1': 0, '1-3': 5, '4-7': 10, 'gt7': 8 }[input.duration]
  score += durBonus
  if (durBonus) reasons.push(`Symptoms present for ${DUR_LABEL[input.duration]} (+${durBonus})`)

  const sevBonus = { mild: 0, moderate: 10, severe: 20 }[input.severitySelf]
  score += sevBonus
  if (sevBonus) reasons.push(`You rated it "${input.severitySelf}" (+${sevBonus})`)

  const v = input.vitals || {}
  const temp = parseFloat(v.temp || '')
  if (!Number.isNaN(temp) && temp >= 102) { score += 8; reasons.push(`Fever of ${temp}°F recorded (+8)`) }
  const spo2 = parseFloat(v.spo2 || '')
  if (!Number.isNaN(spo2) && spo2 < 94 && spo2 > 0) {
    score += 25
    reasons.push(`Low oxygen saturation (${spo2}%) (+25)`)
    if (!redFlags.includes('Low blood oxygen')) redFlags.push('Low blood oxygen')
  }

  if (redFlags.length > 0) {
    score = Math.max(score, 85)
    reasons.unshift(`Red-flag symptom${redFlags.length > 1 ? 's' : ''} detected: ${redFlags.join(', ')} — treated as emergency`)
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const band: Band = score >= 70 ? 'EMR' : score >= 30 ? 'MOD' : 'NOR'
  return { score, band, redFlags, reasons, extractedSymptoms: extracted }
}

export function bandColor(band: Band): string {
  return { NOR: '#15803d', MOD: '#b45309', EMR: '#b91c1c' }[band]
}
