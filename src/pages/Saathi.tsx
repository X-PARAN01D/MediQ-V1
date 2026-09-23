import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { saathiReply, saathiReplyViaServer, type SaathiAction } from '../lib/saathi'
import { isDemo } from '../lib/config'
import { Button, Modal, Notice } from '../components/ui'
import { IconSend, IconMic, IconX, IconChevronL } from '../components/icons'

interface Msg {
  id: number
  from: 'user' | 'saathi'
  text: string
  audioUrl?: string
  action?: SaathiAction
  thinking?: boolean
}

let idc = 0
const nid = () => ++idc

export default function Saathi() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: nid(), from: 'saathi', text: t.saathi.greeting },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [voiceConsent, setVoiceConsent] = useState<boolean | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const push = (m: Omit<Msg, 'id'>) => setMsgs(prev => [...prev, { ...m, id: nid() }])

  const send = async (text: string, audioUrl?: string) => {
    const clean = text.trim()
    if (!clean && !audioUrl) return
    const history = msgs.filter(m => !m.thinking).map(m => ({ from: m.from, text: m.text }))
    push({ from: 'user', text: clean || t.saathi.listening, audioUrl })
    setInput('')
    setBusy(true)
    const thId = nid()
    setMsgs(prev => [...prev, { id: thId, from: 'saathi', text: '', thinking: true }])
    try {
      // Firebase mode: Gemini key stays on the server (saathiChat callable).
      const r = isDemo
        ? await saathiReply(clean || '(voice message)', lang, history)
        : await saathiReplyViaServer(clean || '(voice message)', lang, history)
      setMsgs(prev => prev.map(m => m.id === thId ? { ...m, text: r.text, action: r.action, thinking: false } : m))
    } catch {
      setMsgs(prev => prev.filter(m => m.id !== thId))
    } finally { setBusy(false) }
  }

  const startRecording = async () => {
    if (voiceConsent === null) { setConsentOpen(true); return }
    if (!voiceConsent) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        push({ from: 'user', text: '', audioUrl: url })
        setRecording(false)
      }
      mediaRef.current = mr
      mr.start()
      setRecording(true)
    } catch {
      /* mic unavailable */
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-132px)] -mx-4 -mt-4">
      {/* header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0">
        <Link to="/home" className="p-1 -ml-1 text-ink-500"><IconChevronL size={22} /></Link>
        <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold">S</div>
        <div>
          <p className="font-semibold text-ink-900 leading-tight">{t.saathi.name}</p>
          <p className="text-xs text-green-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> online
          </p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Notice>{t.saathi.disclaimer}</Notice>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-4 space-y-3">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
              m.from === 'user' ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white border border-slate-100 shadow-card text-ink-900 rounded-bl-md'
            }`}>
              {m.thinking ? (
                <span className="flex gap-1 py-1">
                  {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </span>
              ) : (
                <>
                  {m.text && <p>{m.text}</p>}
                  {m.audioUrl && <audio src={m.audioUrl} controls className="mt-1.5 max-w-full h-9" />}
                  {m.action && (
                    <Link to={m.action.href}>
                      <Button size="sm" variant={m.from === 'user' ? 'secondary' : 'primary'} className="mt-2">
                        {m.action.label}
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 sticky bottom-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (recording ? stopRecording() : startRecording())}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition ${
              recording ? 'bg-red-600 text-white' : 'bg-brand-50 text-brand-700'
            }`}
            aria-label={t.saathi.tapToSpeak}>
            {recording ? <IconX size={20} /> : <IconMic size={20} />}
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(input) }}
            placeholder={recording ? t.saathi.listening : t.saathi.placeholder}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-[15px] outline-none focus:border-brand-500"
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()}
            className="w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 disabled:bg-slate-300"
            aria-label={t.saathi.send}>
            <IconSend size={19} />
          </button>
        </div>
        {recording && <p className="text-center text-xs text-red-600 font-medium mt-1.5">{t.saathi.listening}</p>}
      </div>

      {/* voice consent */}
      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title={t.saathi.name}>
        <p className="text-sm text-ink-700 leading-relaxed">{t.saathi.consentVoice}</p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => { setVoiceConsent(false); setConsentOpen(false) }}>
            {t.saathi.deny}
          </Button>
          <Button className="flex-1" onClick={() => { setVoiceConsent(true); setConsentOpen(false); setTimeout(startRecording, 150) }}>
            {t.saathi.allow}
          </Button>
        </div>
        {user && <p className="text-[11px] text-ink-400 mt-3">Consent is recorded against your profile for audit.</p>}
      </Modal>
    </div>
  )
}
