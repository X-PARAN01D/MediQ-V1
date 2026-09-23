import { geminiApiKey } from './config'
import { extractSymptoms, symptomById } from './triage'
import type { Lang } from '../i18n'

export interface SaathiAction { label: string; href: string }
export interface SaathiReply { text: string; action?: SaathiAction }

const RED_WORDS = ['chest pain', 'छाती', 'breath', 'सांस', 'behosh', 'बेहोश', 'bleed', 'खून', 'seizure', 'दौरा', 'unconscious', 'suicide', 'खुदकुशी']

/** Deterministic, guarded replies. Short, no diagnosis, always safe. */
export function saathiRules(text: string, lang: Lang): SaathiReply {
  const t = text.toLowerCase()
  const en = lang === 'en'

  if (RED_WORDS.some(w => t.includes(w))) {
    return {
      text: en
        ? 'This sounds urgent. Please call 108 right away or go to the nearest hospital. Do not wait for an app consultation.'
        : 'यह गंभीर लग रहा है। कृपया तुरंत 108 पर कॉल करें या नज़दीकी अस्पताल जाएँ। ऐप परामर्श का इंतज़ार न करें।',
      action: { label: en ? 'Call 108' : '108 पर कॉल करें', href: 'tel:108' },
    }
  }
  if (/^(hi|hello|namaste|नमस्ते|hey|ram ram)/.test(t.trim())) {
    return { text: en ? 'Namaste! Tell me what is troubling you — for example "fever and headache since 2 days".' : 'नमस्ते! बताइए क्या तकलीफ़ है — जैसे "2 दिन से बुखार और सिरदर्द"।' }
  }
  const found = extractSymptoms(text)
  if (found.length > 0) {
    const names = found.map(id => {
      const s = symptomById(id)!
      return lang === 'hi' ? s.hi : s.en
    }).join(', ')
    return {
      text: en
        ? `I noted: ${names}. Let me run a quick structured check to assess urgency — it takes under a minute.`
        : `मैंने नोट किया: ${names}। गंभीरता आँकने के लिए एक छोटी जाँच करते हैं — एक मिनट से भी कम लगेगा।`,
      action: { label: en ? 'Start symptom check' : 'लक्षण जाँच शुरू करें', href: '/intake' },
    }
  }
  if (t.includes('token')) {
    return {
      text: en
        ? 'After the symptom check I issue a colour-coded token — green (Normal), yellow (Moderate) or red (Emergency). You can track it under My Tokens.'
        : 'लक्षण जाँच के बाद मैं रंग-कोडित टोकन देता हूँ — हरा (सामान्य), पीला (मध्यम) या लाल (आपातकालीन)। मेरे टोकन में इसे देख सकते हैं।',
      action: { label: en ? 'My tokens' : 'मेरे टोकन', href: '/tokens' },
    }
  }
  if (t.includes('doctor') || t.includes('डॉक्टर')) {
    return {
      text: en
        ? 'You can browse verified doctors, see their timings, and book a slot. All doctors on MediQ are license-verified.'
        : 'आप सत्यापित डॉक्टरों को देख सकते हैं, उनका समय जान सकते हैं और स्लॉट बुक कर सकते हैं। MediQ के सभी डॉक्टर लाइसेंस-सत्यापित हैं।',
      action: { label: en ? 'Find a doctor' : 'डॉक्टर खोजें', href: '/doctors' },
    }
  }
  if (t.includes('appointment') || t.includes('अपॉइंटमेंट')) {
    return {
      text: en ? 'Your upcoming and past appointments live under the Appointments tab.' : 'आपके आगामी और पिछले अपॉइंटमेंट अपॉइंटमेंट टैब में हैं।',
      action: { label: en ? 'Appointments' : 'अपॉइंटमेंट', href: '/appointments' },
    }
  }
  if (t.includes('prescription') || t.includes('पर्ची') || t.includes('dawai') || t.includes('दवा')) {
    return {
      text: en ? 'Prescriptions from completed visits are saved under Records, as downloadable PDFs.' : 'पूर्ण विज़िट की पर्चियाँ रिकॉर्ड में PDF के रूप में सहेजी जाती हैं।',
      action: { label: en ? 'Records' : 'रिकॉर्ड', href: '/records' },
    }
  }
  if (t.includes('thank') || t.includes('धन्यवाद') || t.includes('shukriya')) {
    return { text: en ? 'You are welcome. Take care of your health — I am here if you need me.' : 'आपका स्वागत है। अपना ख्याल रखिए — ज़रूरत हो तो मैं यहीं हूँ।' }
  }
  return {
    text: en
      ? 'I want to help accurately. Could you describe your main symptom in a few words — for example "stomach pain since morning"?'
      : 'मैं सही मदद करना चाहता हूँ। कृपया मुख्य लक्षण कुछ शब्दों में बताएँ — जैसे "सुबह से पेट दर्द"?',
  }
}

/**
 * Optional Gemini enhancement. Used only when VITE_GEMINI_API_KEY is set;
 * any failure falls back to the deterministic rules above. The system prompt
 * keeps replies short, non-diagnostic, and in the user's language.
 */
/** Gemini flash enhancement with deterministic fallback. Demo/dev only —
 *  the browser key must never ship to production; Firebase mode uses the
 *  server-side `saathiChat` callable instead (see saathiReply below). */
export async function saathiSmart(text: string, lang: Lang, history: { from: string; text: string }[]): Promise<SaathiReply | null> {
  if (!geminiApiKey) return null
  try {
    const sys = lang === 'hi'
      ? 'तुम MediQ के स्वास्थ्य सहायक "साथी" हो। 2-3 वाक्यों में जवाब दो। कोई निश्चित निदान मत दो। लक्षणों पर गंभीरता का अंदाज़ा दे सकते हो पर डॉक्टर से मिलने की सलाह ज़रूर दो। आपात लक्षण (छाती दर्द, सांस तकलीफ़, बेहोशी, तेज़ खून) पर तुरंत 108 पर कॉल करने को कहो।'
      : 'You are SAATHI, MediQ\'s health assistant. Reply in 2-3 sentences. Never give a definite diagnosis. You may suggest urgency but always advise seeing a doctor. For red-flag symptoms (chest pain, breathing difficulty, unconsciousness, heavy bleeding) tell the user to call 108 immediately.'
    const contents = [
      { role: 'user', parts: [{ text: sys }] },
      ...history.slice(-6).map(h => ({
        role: h.from === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      })),
      { role: 'user', parts: [{ text }] },
    ]
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 220, temperature: 0.4 } }) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const out = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')?.trim()
    if (!out) return null
    // Safety net: red-flag words always escalate, even from the model.
    const low = `${text} ${out}`.toLowerCase()
    if (RED_WORDS.some(w => low.includes(w))) return saathiRules(text, lang)
    return { text: out }
  } catch {
    return null
  }
}

/**
 * Server-side SAATHI path for Firebase mode: the `saathiChat` callable holds
 * the Gemini key on the server. Red-flag rules run first locally (non-
 * overridable); the model only ever enhances non-urgent replies, and its
 * output passes the same red-flag safety net.
 */
export async function saathiReplyViaServer(text: string, lang: Lang, history: { from: string; text: string }[]): Promise<SaathiReply> {
  const urgent = saathiRules(text, lang)
  if (urgent.action?.href === 'tel:108') return urgent
  try {
    const { callFn } = await import('./storeFirebase')
    const res = await callFn<{ text: string; action?: SaathiReply['action'] }>('saathiChat', { text, lang, history })
    if (res?.text) {
      const low = `${text} ${res.text}`.toLowerCase()
      if (RED_WORDS.some(w => low.includes(w))) return saathiRules(text, lang)
      return { text: res.text, action: res.action }
    }
  } catch {
    /* fall through to deterministic rules */
  }
  return urgent
}

export async function saathiReply(text: string, lang: Lang, history: { from: string; text: string }[]): Promise<SaathiReply> {
  // Red flags are non-overridable: rules run first, always.
  const urgent = saathiRules(text, lang)
  if (urgent.action?.href === 'tel:108') return urgent
  const smart = await saathiSmart(text, lang, history)
  return smart || urgent
}
