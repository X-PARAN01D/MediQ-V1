import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import {
  Button, Card, SectionTitle, Field, Input, TextArea, Notice, Spinner, Avatar,
} from '../../components/ui'
import { IconCheckCircle, IconShieldCheck } from '../../components/icons'
import type { User } from '../../lib/types'

export default function Profile() {
  const { user, refresh, signOut } = useAuth()
  const { t } = useLang()
  const [form, setForm] = useState({
    name: '', specialization: '', clinic: '', experience: '',
    fee: '', languages: '', bio: '', qualifications: '', availability: '',
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) setForm({
      name: user.name || '',
      specialization: user.specialization || '',
      clinic: user.clinic || '',
      experience: user.experience?.toString() || '',
      fee: user.fee?.toString() || '',
      languages: (user.languages || []).join(', '),
      bio: user.bio || '',
      qualifications: user.qualifications || '',
      availability: user.availability || '',
    })
  }, [user?.id])

  if (!user) return <Spinner />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    setBusy(true); setSaved(false)
    try {
      const exp = parseInt(form.experience, 10)
      const fee = parseInt(form.fee, 10)
      await store().col<User>('users').update(user.id, {
        name: form.name.trim(),
        specialization: form.specialization.trim(),
        clinic: form.clinic.trim(),
        experience: Number.isNaN(exp) ? undefined : exp,
        fee: Number.isNaN(fee) ? undefined : fee,
        languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
        bio: form.bio.trim(),
        qualifications: form.qualifications.trim(),
        availability: form.availability.trim(),
      })
      await refresh()
      setSaved(true)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-3">
        <Avatar name={user.name} size={52} />
        <div>
          <p className="font-bold text-ink-900 text-[16px]">{user.name}</p>
          <p className="text-[13px] text-ink-500">{user.specialization} · {user.clinic}</p>
          {user.verification === 'approved' && (
            <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 text-[11px] font-semibold">
              <IconShieldCheck size={13} />{t.doctors.verified}
            </span>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3.5">
        <SectionTitle>{t.doctor.editProfileD}</SectionTitle>
        <Field label={t.auth.name} required>
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.auth.specialization}>
            <Input value={form.specialization} onChange={set('specialization')} />
          </Field>
          <Field label={t.auth.clinic}>
            <Input value={form.clinic} onChange={set('clinic')} />
          </Field>
          <Field label={`${t.doctors.experience}`}>
            <Input inputMode="numeric" value={form.experience} onChange={set('experience')} placeholder="8" />
          </Field>
          <Field label={t.doctor.consultationFee}>
            <Input inputMode="numeric" value={form.fee} onChange={set('fee')} placeholder="200" />
          </Field>
        </div>
        <Field label={t.doctors.languages} hint="Comma separated">
          <Input value={form.languages} onChange={set('languages')} placeholder="Marathi, Hindi, English" />
        </Field>
        <Field label={t.doctors.qualifications}>
          <Input value={form.qualifications} onChange={set('qualifications')} placeholder="MBBS, MD" />
        </Field>
        <Field label={t.doctor.availability}>
          <Input value={form.availability} onChange={set('availability')} placeholder="Mon–Sat · 9:00 AM – 1:00 PM" />
        </Field>
        <Field label={t.doctor.bio}>
          <TextArea value={form.bio} onChange={set('bio')} rows={3} />
        </Field>
        {saved && (
          <Notice>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <IconCheckCircle size={15} />Saved
            </span>
          </Notice>
        )}
        <Button className="w-full" onClick={save} disabled={busy || !form.name.trim()}>
          {busy ? t.common.loading : t.common.save}
        </Button>
      </Card>

      <Button variant="secondary" className="w-full" onClick={signOut}>
        {t.auth.signOut}
      </Button>
    </div>
  )
}
