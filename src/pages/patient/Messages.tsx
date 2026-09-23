import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { markAllRead } from '../../lib/notify'
import { isDemo } from '../../lib/config'
import { Button, Card, SegmentedControl, EmptyState, Notice } from '../../components/ui'
import { IconChat, IconBell, IconPhone } from '../../components/icons'
import { fmtDate, fmtTime, type AppNotification } from '../../lib/types'

type Tab = 'all' | 'sms'

export default function Messages() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [list, setList] = useState<(AppNotification & { id: string })[]>([])
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => {
    if (!user) return
    return store().col<AppNotification>('notifications').subscribe(docs => {
      setList(docs.filter(n => n.userId === user.id).sort((a, b) => b.createdAt - a.createdAt))
    }, n => n.userId === user.id, [{ field: 'userId', op: '==', value: user.id }])
  }, [user?.id])

  const markRead = async (n: AppNotification & { id: string }) => {
    // Security rules only permit the `read` and `readAt` keys on notification updates.
    if (!n.read) await store().col<AppNotification>('notifications').update(n.id, { read: true, readAt: Date.now() })
  }

  const shown = tab === 'all' ? list : list.filter(n => n.channel === 'sms')
  const unread = list.filter(n => !n.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">{t.messages.title}</h1>
        {unread > 0 && (
          <Button size="sm" variant="secondary" onClick={() => user && markAllRead(user.id)}>
            {t.messages.markRead}
          </Button>
        )}
      </div>

      <SegmentedControl<Tab>
        options={[
          { value: 'all', label: `${t.messages.notifications} (${list.length})` },
          { value: 'sms', label: t.messages.smsLog },
        ]}
        value={tab} onChange={setTab} />

      {tab === 'sms' && isDemo && (
        <Notice>{lang === 'hi'
          ? 'डेमो मोड में SMS असली नहीं भेजे जाते — संदेश यहाँ लॉग में दिखते हैं।'
          : 'In demo mode SMS messages are simulated — they appear in this log instead of being sent.'}</Notice>
      )}

      {shown.length === 0 ? (
        <Card><EmptyState icon={<IconChat size={22} />} title={t.messages.noMessages} /></Card>
      ) : (
        <div className="space-y-2.5">
          {shown.map(n => (
            <Card key={n.id} className={`p-4 ${!n.read ? 'border-brand-200' : ''}`} onClick={() => markRead(n)}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.channel === 'sms' ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-700'}`}>
                  {n.channel === 'sms' ? <IconPhone size={17} /> : <IconBell size={17} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.read ? 'font-bold text-ink-900' : 'font-medium text-ink-700'}`}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />}
                  </div>
                  <p className="text-[13px] text-ink-500 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[11px] text-ink-400 mt-1.5">{fmtDate(n.createdAt, lang)} · {fmtTime(n.createdAt)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
