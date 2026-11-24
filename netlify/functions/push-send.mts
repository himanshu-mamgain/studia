import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { afterSend, dueNotices, isGone, payload, type PushRecord } from '../lib/push.ts'
import { vapid } from '../lib/vapid.ts'

// Every 15 minutes (production only): sends each subscribed browser the daily-plan reminders that
// have come due (11:00, 17:00 and 21:30 in the learner's time, worked out by the Today page).

export default async () => {
  if (!vapid()) return
  const store = getStore('push-subscriptions')
  const now = Date.now()
  const { blobs } = await store.list()
  let sentCount = 0
  for (const { key } of blobs) {
    const record = (await store.get(key, { type: 'json' })) as PushRecord | null
    if (!record) continue
    const due = dueNotices(record, now)
    if (!due.length) continue
    const sent: string[] = []
    let gone = false
    for (const notice of due) {
      try {
        // Held by the push service for up to 3 hours if the phone is offline.
        await webpush.sendNotification(record.subscription, payload(notice), { TTL: 3 * 60 * 60 })
        sent.push(notice.id)
      } catch (error) {
        if (isGone((error as { statusCode?: number }).statusCode)) {
          gone = true
          break
        }
        // Anything else may be temporary: it stays due and is retried next run.
      }
    }
    if (gone) await store.delete(key)
    else await store.setJSON(key, afterSend(record, sent, now))
    sentCount += sent.length
  }
  console.log(`push-send: ${blobs.length} subscriptions, ${sentCount} sent`)
}

export const config: Config = { schedule: '*/15 * * * *' }
