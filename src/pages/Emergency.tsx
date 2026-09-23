import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { isDemo } from '../lib/config'
import { Button, Card, Notice, Spinner } from '../components/ui'
import { IconPhone, IconAlertOct, IconCheckCircle, IconChevronL } from '../components/icons'

export default function Emergency() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'confirm' | 'sending' | 'sent'>('confirm')
  const [alertId, setAlertId] = useState('')

  const send = async () => {
    if (!user) return
    setPhase('sending')
    let lat: number | undefined, lng: number | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) return rej(new Error('no-geo'))
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      })
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch { /* proceed without location */ }

    const alert = await store().col('emergency').create({
      patientId: user.id, patientName: user.name, phone: user.phone,
      lat, lng, bloodGroup: user.bloodGroup, allergies: user.allergies, conditions: user.conditions,
      status: 'sent', createdAt: Date.now(),
    } as any)
    setAlertId(alert.id)
    await notify(user.id, {
      kind: 'emergency', refId: alert.id, channel: 'sms',
      title: 'Emergency alert sent',
      body: `MediQ SOS: ${user.name} requested emergency help${lat ? ` at ${lat.toFixed(4)},${lng!.toFixed(4)}` : ''}. 108 has been notified.`,
    })
    await store().col('audit').create({
      actorId: user.id, actorName: user.name, action: 'emergency_alert',
      detail: `SOS ${alert.id}${lat ? ` @ ${lat.toFixed(4)},${lng!.toFixed(4)}` : ''}`, createdAt: Date.now(),
    } as any)
    setPhase('sent')
  }

  return (
    <div className="fade-up max-w-[440px] mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-ink-500 text-sm mb-4">
        <IconChevronL size={18} /> {t.common.back}
      </button>

      {phase === 'confirm' && (
        <Card className="p-6 text-center border-red-200">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <IconAlertOct size={32} />
          </div>
          <h1 className="text-xl font-bold text-ink-900 mt-4">{t.emergency.confirmTitle}</h1>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">{t.emergency.confirmBody}</p>

          {user && (
            <div className="text-left bg-slate-50 rounded-xl p-4 mt-5 space-y-1.5 text-sm">
              <p><span className="text-ink-400">{t.emergency.bloodGroup}:</span> <b>{user.bloodGroup || t.common.none}</b></p>
              <p><span className="text-ink-400">{t.emergency.allergies}:</span> <b>{user.allergies || t.common.none}</b></p>
              <p><span className="text-ink-400">{t.emergency.conditions}:</span> <b>{user.conditions || t.common.none}</b></p>
              <Link to="/profile" className="text-brand-700 font-medium text-[13px]">{t.emergency.editCritical}</Link>
            </div>
          )}

          <Button variant="emergency" size="lg" className="w-full mt-6" onClick={send}>
            <IconAlertOct size={20} /> {t.emergency.send}
          </Button>
          <a href="tel:108" className="block mt-3">
            <Button variant="secondary" size="lg" className="w-full">
              <IconPhone size={18} /> {t.emergency.call108}
            </Button>
          </a>
        </Card>
      )}

      {phase === 'sending' && (
        <Card className="p-10"><Spinner label={t.emergency.sending} /></Card>
      )}

      {phase === 'sent' && (
        <Card className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-700 flex items-center justify-center mx-auto">
            <IconCheckCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-ink-900 mt-4">{t.emergency.sent}</h1>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">{t.emergency.sentHint}</p>
          {alertId && <p className="text-xs text-ink-400 mt-3">Alert ID: {alertId.slice(-8).toUpperCase()}</p>}
          <a href="tel:108" className="block mt-6">
            <Button variant="emergency" size="lg" className="w-full">
              <IconPhone size={18} /> {t.emergency.call108}
            </Button>
          </a>
          {isDemo && (
            <div className="mt-4 text-left">
              <Notice kind="info"><span className="text-[13px]">Demo mode: the alert is recorded in the app and an SMS record is logged. Connect a dispatch provider for live 108 integration.</span></Notice>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
