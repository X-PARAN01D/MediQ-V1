import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLang, type Lang } from '../../i18n'
import { store } from '../../lib/store'
import { Button, Card, SectionTitle, Field, Input, Select, Notice, ConfirmDialog, Avatar } from '../../components/ui'
import { IconLogout, IconShieldCheck, IconTrash, IconGlobe } from '../../components/icons'
import { fmtDate } from '../../lib/types'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const GENDERS = ['male', 'female', 'other'] as const

export default function Profile() {
  const { t, lang, setLang } = useLang()
  const { user, signOut, refresh } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [age, setAge] = useState(user?.age?.toString() || '')
  const [gender, setGender] = useState(user?.gender || '')
  const [village, setVillage] = useState(user?.village || '')
  const [email, setEmail] = useState(user?.email || '')
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || '')
  const [allergies, setAllergies] = useState(user?.allergies || '')
  const [conditions, setConditions] = useState(user?.conditions || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!user) return null

  const save = async () => {
    setSaving(true)
    try {
      await store().col('users').update(user.id, {
        name: name.trim() || user.name,
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        village: village.trim() || undefined,
        email: email.trim() || undefined,
        bloodGroup: bloodGroup || undefined,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
      })
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = async () => {
    await store().col('users').update(user.id, { deleteRequestedAt: Date.now() })
    await refresh()
  }

  const genderLabel = (g: string) =>
    g === 'male' ? t.common.male : g === 'female' ? t.common.female : t.common.other

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size={60} />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">{user.name}</h1>
          <p className="text-sm text-ink-500">{user.phone || user.email}</p>
          {user.abhaId && (
            <p className="text-[13px] text-ink-500 mt-0.5">
              <span className="font-medium text-ink-700">{t.profile.abha}:</span> {user.abhaId}
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>{t.profile.personal}</SectionTitle>
        <Card className="p-5 space-y-4">
          <Field label={t.auth.name}><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.auth.age}><Input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} /></Field>
            <Field label={t.auth.gender}>
              <Select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">{t.common.none}</option>
                {GENDERS.map(g => <option key={g} value={g}>{genderLabel(g)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t.auth.village}><Input value={village} onChange={e => setVillage(e.target.value)} /></Field>
          <Field label={t.auth.phone}><Input value={user.phone || ''} disabled /></Field>
          <Field label={t.auth.email}><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Button className="w-full" disabled={saving} onClick={save}>
            {saving ? t.common.loading : saved ? (lang === 'hi' ? 'सहेजा गया' : 'Saved') : t.common.save}
          </Button>
        </Card>
      </div>

      <div>
        <SectionTitle>{t.profile.language}</SectionTitle>
        <Card className="p-4">
          <div className="flex gap-2">
            {(['en', 'hi'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium ${lang === l ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-700'}`}>
                <IconGlobe size={16} /> {l === 'en' ? 'English' : 'हिंदी'}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>{t.emergency.editCritical}</SectionTitle>
        <Card className="p-5 space-y-4">
          <Field label={t.emergency.bloodGroup}>
            <Select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
              <option value="">{t.common.none}</option>
              {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label={t.emergency.allergies}><Input value={allergies} onChange={e => setAllergies(e.target.value)}
            placeholder={lang === 'hi' ? 'जैसे पेनिसिलिन' : 'e.g. penicillin'} /></Field>
          <Field label={t.emergency.conditions}><Input value={conditions} onChange={e => setConditions(e.target.value)}
            placeholder={lang === 'hi' ? 'जैसे मधुमेह, उच्च रक्तचाप' : 'e.g. diabetes, hypertension'} /></Field>
          <Notice>{t.emergency.confirmBody}</Notice>
          <Button variant="secondary" className="w-full" disabled={saving} onClick={save}>{t.common.save}</Button>
        </Card>
      </div>

      <div>
        <SectionTitle>{t.profile.consents}</SectionTitle>
        <Card className="p-4">
          <ul className="space-y-2.5">
            {[
              { label: lang === 'hi' ? 'इलाज व देखभाल के लिए डेटा उपयोग' : 'Data use for treatment & care', on: true },
              { label: lang === 'hi' ? 'SMS/सूचना अलर्ट' : 'SMS / notification alerts', on: true },
              { label: lang === 'hi' ? 'वॉइस रिकॉर्डिंग संग्रहण' : 'Voice recording storage', on: false },
            ].map((c, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <IconShieldCheck size={17} className={c.on ? 'text-green-600' : 'text-ink-300'} />
                <span className="text-ink-700">{c.label}</span>
                <span className="ml-auto text-xs text-ink-400">{c.on ? (lang === 'hi' ? 'अनुमति दी' : 'Granted') : (lang === 'hi' ? 'नहीं दी' : 'Not granted')}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-400 mt-3">
            {lang === 'hi' ? 'सहमति वापस लेने के लिए प्रोफ़ाइल सहायता से संपर्क करें।' : 'Contact support to withdraw any consent.'}
          </p>
        </Card>
      </div>

      <Card className="p-4 space-y-2.5">
        {user.deleteRequestedAt ? (
          <Notice kind="warn">{t.profile.deleteRequested} ({fmtDate(user.deleteRequestedAt, lang)})</Notice>
        ) : (
          <button onClick={() => setDeleteOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50">
            <IconTrash size={16} /> {t.profile.deleteRequest}
          </button>
        )}
        <button onClick={async () => { await signOut(); navigate('/') }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-ink-700 text-sm font-medium hover:bg-slate-50">
          <IconLogout size={16} /> {t.auth.signOut}
        </button>
      </Card>

      <ConfirmDialog open={deleteOpen} title={t.profile.deleteAccount} body={t.profile.deleteConfirm}
        confirmLabel={t.profile.deleteRequest} danger
        onClose={() => setDeleteOpen(false)} onConfirm={requestDelete} />
    </div>
  )
}
