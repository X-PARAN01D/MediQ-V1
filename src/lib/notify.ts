import { store } from './store'
import { isDemo } from './config'
import { uid, type AppNotification } from './types'

export interface NotifyInput {
  kind: string
  refId?: string
  channel: 'sms' | 'inapp' | 'email'
  title: string
  body: string
}

/**
 * Writes a notification record.
 *
 * Demo mode: the record is written to the local store and the SMS channel is
 * simulated — stored and shown in the in-app SMS log.
 *
 * Firebase mode: goes through the `notifyUser` callable Cloud Function. The
 * client is NOT allowed to create notification documents directly (security
 * rules deny it), because a writable notification feed would let any client
 * spoof alerts to any user.
 */
export async function notify(userId: string, n: NotifyInput): Promise<void> {
  if (!isDemo) {
    const { callFn } = await import('./storeFirebase')
    await callFn('notifyUser', { userId, ...n })
    return
  }
  const rec: AppNotification = {
    id: uid('ntf'), userId, ...n, read: false, createdAt: Date.now(),
  }
  await store().col<AppNotification>('notifications').create(rec)
  if (n.channel === 'sms') {
    // eslint-disable-next-line no-console
    console.info(`[mediq-demo-sms] to ${userId}: ${n.body}`)
  }
}

export async function markAllRead(userId: string): Promise<void> {
  const s = store()
  const list = await s.col<AppNotification>('notifications').list(
    n => n.userId === userId && !n.read,
    [{ field: 'userId', op: '==', value: userId }],
  )
  // Rules allow only the `read` and `readAt` keys on update.
  await Promise.all(list.map(n => s.col<AppNotification>('notifications').update(n.id, { read: true, readAt: Date.now() })))
}
