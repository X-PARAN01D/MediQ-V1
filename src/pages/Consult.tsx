import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { store } from '../lib/store'
import { isDemo } from '../lib/config'
import { fmtDuration, type Token, type Appointment } from '../lib/types'
import { Notice, Spinner, TokenPill } from '../components/ui'
import { IconVideo, IconVideoOff, IconMic, IconX, IconPhone, IconWifi } from '../components/icons'

type Quality = 'good' | 'fair' | 'poor'

export default function Consult() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tokenId } = useParams()

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startRef = useRef<number>(0)
  const cleanupRef = useRef<() => void>(() => {})

  const [token, setToken] = useState<(Token & { id: string }) | null>(null)
  const [otherName, setOtherName] = useState('')
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)
  const [quality, setQuality] = useState<Quality>('good')
  const [seconds, setSeconds] = useState(0)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')

  /* resolve token or appointment */
  useEffect(() => {
    if (!tokenId || !user) return
    ;(async () => {
      const tk = await store().col<Token>('tokens').get(tokenId)
      if (tk) {
        setToken(tk)
        setOtherName(user.role === 'doctor' ? tk.patientName : (tk.doctorName || 'Doctor'))
        return
      }
      const ap = await store().col<Appointment>('appointments').get(tokenId)
      if (ap) setOtherName(user.role === 'doctor' ? ap.patientName : ap.doctorName)
      else setOtherName('')
    })()
  }, [tokenId, user])

  /* timer */
  useEffect(() => {
    if (ended) return
    const iv = setInterval(() => {
      if (startRef.current) setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [ended])

  /* media + signaling */
  useEffect(() => {
    if (!user || !tokenId) return
    let cancelled = false

    const boot = async () => {
      // 1. local media
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }) } catch { /* none */ }
        setAudioOnly(true)
      }
      if (cancelled) { stream?.getTracks().forEach(tr => tr.stop()); return }
      streamRef.current = stream
      if (localRef.current && stream) localRef.current.srcObject = stream
      startRef.current = Date.now()

      if (isDemo || !stream) {
        // Demo / no-media: local preview only, honestly labelled.
        return
      }

      // 2. live WebRTC via Firestore signaling
      try {
        // Resolve the two call participants first: security rules restrict the
        // call document (and its candidate subcollections) to patientId/doctorId.
        let patientId = ''
        let doctorId = ''
        try {
          const tk0 = await store().col<Token>('tokens').get(tokenId)
          if (tk0) { patientId = tk0.patientId || ''; doctorId = tk0.doctorId || '' }
          else {
            const ap0 = await store().col<Appointment>('appointments').get(tokenId)
            if (ap0) { patientId = ap0.patientId || ''; doctorId = ap0.doctorId || '' }
          }
        } catch { /* offline — the rules will reject if truly unauthorized */ }

        const [{ firestore }, fs] = await Promise.all([import('../lib/storeFirebase'), import('firebase/firestore')])
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
        pcRef.current = pc
        stream.getTracks().forEach(tr => pc.addTrack(tr, stream!))
        pc.ontrack = e => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0] }
        pc.onconnectionstatechange = () => setConnected(pc.connectionState === 'connected')

        const callRef = fs.doc(firestore, 'calls', tokenId)
        const snap = await fs.getDoc(callRef)
        const data = snap.data()

        if (!snap.exists()) {
          // caller
          await fs.setDoc(callRef, { createdBy: user.id, patientId, doctorId, createdAt: Date.now() })
          const oc = fs.collection(callRef, 'offerCandidates')
          pc.onicecandidate = e => { if (e.candidate) void fs.addDoc(oc, e.candidate.toJSON()) }
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await fs.setDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } }, { merge: true })
          fs.onSnapshot(callRef, s => {
            const d = s.data()
            if (d?.answer && !pc.currentRemoteDescription) {
              void pc.setRemoteDescription(new RTCSessionDescription(d.answer))
            }
          })
          fs.onSnapshot(fs.collection(callRef, 'answerCandidates'), s => {
            s.docChanges().forEach(c => {
              if (c.type === 'added') void pc.addIceCandidate(new RTCIceCandidate(c.doc.data() as RTCIceCandidateInit))
            })
          })
        } else if (data && data.createdBy !== user.id && !data.answer) {
          // joiner
          const oc = fs.collection(callRef, 'answerCandidates')
          pc.onicecandidate = e => { if (e.candidate) void fs.addDoc(oc, e.candidate.toJSON()) }
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await fs.setDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true })
          fs.onSnapshot(fs.collection(callRef, 'offerCandidates'), s => {
            s.docChanges().forEach(c => {
              if (c.type === 'added') void pc.addIceCandidate(new RTCIceCandidate(c.doc.data() as RTCIceCandidateInit))
            })
          })
        }

        // quality monitor
        const qiv = setInterval(async () => {
          try {
            const stats = await pc.getStats()
            stats.forEach(r => {
              if (r.type === 'candidate-pair' && (r as any).nominated) {
                const rtt = (r as any).currentRoundTripTime as number
                setQuality(rtt < 0.15 ? 'good' : rtt < 0.4 ? 'fair' : 'poor')
              }
            })
          } catch { /* noop */ }
        }, 3000)
        cleanupRef.current = () => clearInterval(qiv)
      } catch (e) {
        setError(t.common.tryAgain)
      }
    }

    void boot()
    return () => {
      cancelled = true
      cleanupRef.current()
      pcRef.current?.close()
      streamRef.current?.getTracks().forEach(tr => tr.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId])

  const toggleMute = () => {
    const tr = streamRef.current?.getAudioTracks()[0]
    if (tr) { tr.enabled = !tr.enabled; setMuted(!tr.enabled) }
  }
  const toggleCam = () => {
    const tr = streamRef.current?.getVideoTracks()[0]
    if (tr) { tr.enabled = !tr.enabled; setCamOff(!tr.enabled) }
  }

  const endCall = async () => {
    cleanupRef.current()
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    const dur = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0
    if (token) {
      try { await store().col<Token>('tokens').update(token.id, { callDurationSec: dur }) } catch { /* noop */ }
    }
    if (!isDemo && tokenId) {
      try {
        const [{ firestore }, fs] = await Promise.all([import('../lib/storeFirebase'), import('firebase/firestore')])
        await fs.deleteDoc(fs.doc(firestore, 'calls', tokenId))
      } catch { /* noop */ }
    }
    setSeconds(dur)
    setEnded(true)
  }

  const qLabel = { good: t.consult.qGood, fair: t.consult.qFair, poor: t.consult.qPoor }[quality]
  const qColor = { good: 'bg-green-100 text-green-800', fair: 'bg-amber-100 text-amber-800', poor: 'bg-red-100 text-red-700' }[quality]

  if (ended) {
    return (
      <div className="max-w-[440px] mx-auto text-center py-16 fade-up">
        <p className="text-lg font-semibold text-ink-900">{t.consult.callEnded}</p>
        <p className="text-ink-500 mt-2">{t.consult.duration}: <b className="text-ink-900">{fmtDuration(seconds)}</b></p>
        {token && <p className="text-xs text-ink-400 mt-2">{token.code}</p>}
        <button onClick={() => navigate(-1)} className="mt-6 text-brand-700 font-medium">{t.common.back}</button>
      </div>
    )
  }

  return (
    <div className="fade-up -mx-4 -mt-4">
      <div className="bg-ink-900 text-white px-4 py-3 flex items-center gap-3">
        <div>
          <p className="font-semibold leading-tight">{otherName || t.consult.title}</p>
          <p className="text-xs text-slate-300 font-mono">{fmtDuration(seconds)}</p>
        </div>
        {token && <TokenPill code={token.code} band={token.band} />}
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${qColor}`}>
          <IconWifi size={13} /> {isDemo ? t.common.demoMode : qLabel}
        </span>
      </div>

      {isDemo && (
        <div className="px-4 pt-3"><Notice>{t.consult.needsFirebase}</Notice></div>
      )}
      {error && <div className="px-4 pt-3"><Notice kind="warn">{error}</Notice></div>}

      {/* video area */}
      <div className="relative bg-slate-900 aspect-[3/4] max-h-[62dvh] mx-4 mt-3 rounded-2xl overflow-hidden">
        {!audioOnly && !isDemo ? (
          <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
            <IconVideoOff size={40} />
            <p className="text-sm">{audioOnly ? t.consult.audioOnly : t.consult.connecting}</p>
          </div>
        )}
        {!connected && !isDemo && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
            <Spinner label={t.consult.connecting} />
          </div>
        )}
        {/* local PiP */}
        <div className="absolute bottom-3 right-3 w-24 h-32 rounded-xl overflow-hidden bg-slate-800 border border-white/20">
          {camOff ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400"><IconVideoOff size={22} /></div>
          ) : (
            <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
          )}
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-4 mt-5 pb-6">
        <button onClick={toggleMute} aria-label={muted ? t.consult.unmute : t.consult.mute}
          className={`p-3.5 rounded-full ${muted ? 'bg-red-100 text-red-700' : 'bg-white border border-slate-200 text-ink-700'} shadow-card`}>
          {muted ? <IconX size={20} /> : <IconMic size={20} />}
        </button>
        <button onClick={toggleCam} aria-label={camOff ? t.consult.cameraOn : t.consult.cameraOff}
          className={`p-3.5 rounded-full ${camOff ? 'bg-red-100 text-red-700' : 'bg-white border border-slate-200 text-ink-700'} shadow-card`}>
          {camOff ? <IconVideoOff size={20} /> : <IconVideo size={20} />}
        </button>
        <button onClick={() => setAudioOnly(v => !v)} aria-label={t.consult.switchAudio}
          className={`p-3.5 rounded-full ${audioOnly ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-ink-700'} shadow-card`}>
          <IconPhone size={20} />
        </button>
        <button onClick={endCall} aria-label={t.consult.endCall}
          className="p-4 rounded-full bg-red-600 text-white shadow-pop">
          <IconPhone size={22} style={{ transform: 'rotate(135deg)' }} />
        </button>
      </div>
      <style>{`.mirror{transform:scaleX(-1)}`}</style>
    </div>
  )
}
