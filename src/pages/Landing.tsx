import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import { Button, Card } from '../components/ui'
import { IconMic, IconChat, IconVideo, IconFile, IconChevronR } from '../components/icons'

export default function Landing() {
  const { t } = useLang()
  const steps = [
    { icon: <IconChat size={22} />, title: t.landing.step1t, desc: t.landing.step1d },
    { icon: <IconMic size={22} />, title: t.landing.step2t, desc: t.landing.step2d },
    { icon: <IconVideo size={22} />, title: t.landing.step3t, desc: t.landing.step3d },
    { icon: <IconFile size={22} />, title: t.landing.step4t, desc: t.landing.step4d },
  ]
  return (
    <div className="fade-up">
      {/* hero */}
      <div className="pt-8 pb-6 text-center">
        <img src="/logo.png" alt="MediQ" className="w-20 h-20 rounded-full object-cover mx-auto shadow-card" />
        <h1 className="text-[26px] leading-snug font-bold tracking-tight text-ink-900 mt-5 max-w-[320px] mx-auto">
          {t.landing.title}
        </h1>
        <p className="text-[15px] text-ink-500 mt-3 max-w-[340px] mx-auto leading-relaxed">{t.landing.sub}</p>
      </div>

      <div className="space-y-3">
        <Link to="/auth?role=patient"><Button size="lg" className="w-full">{t.landing.ctaPatient}</Button></Link>
        <Link to="/auth?role=doctor"><Button size="lg" variant="secondary" className="w-full">{t.landing.ctaDoctor}</Button></Link>
      </div>

      {/* how it works */}
      <h2 className="text-[15px] font-semibold text-ink-900 mt-8 mb-3">{t.landing.howItWorks}</h2>
      <Card className="divide-y divide-slate-100">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3.5 p-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <p className="font-medium text-ink-900 text-[15px]">{i + 1}. {s.title}</p>
              <p className="text-[13px] text-ink-500 mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </Card>

      <Link to="/auth" className="flex items-center justify-center gap-1 text-brand-700 font-medium text-sm mt-6 pb-8">
        {t.landing.loginTitle} <IconChevronR size={16} />
      </Link>
    </div>
  )
}
