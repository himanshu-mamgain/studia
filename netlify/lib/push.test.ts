// npm test (at the repo root)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { afterSend, dueNotices, isGone, keyFor, parseQueue, parseSubscription, payload, upsert } from './push.ts'

const now = Date.parse('2026-11-25T05:30:00Z') // 11:00 in India
const HOUR = 3_600_000
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }
const notice = (id: string, at: number) => ({ id, kind: 'plan', at, title: 'Today: 2 items', body: 'Palindrome Check · Querying one table', url: '/today' })

test('accepts real push services only', () => {
  assert.ok(parseSubscription(sub))
  assert.equal(parseSubscription({ ...sub, endpoint: 'https://evil.example.com/x' }), null)
  assert.equal(parseSubscription({ ...sub, endpoint: 'http://fcm.googleapis.com/x' }), null)
  assert.equal(parseSubscription({ endpoint: sub.endpoint }), null)
})

test('keeps well-formed reminders for this site only', () => {
  const queue = parseQueue(
    [
      notice('plan:2026-11-26:am', now + 24 * HOUR),
      notice('plan:2026-11-25:pm', now + 6 * HOUR),
      { ...notice('a', now), url: 'https://evil.example.com' },
      { ...notice('b', now), url: '//evil.example.com' },
      notice('too-late', now - 2 * 24 * HOUR),
      notice('too-far', now + 40 * 24 * HOUR),
      notice('bad id <script>', now),
    ],
    now,
  )
  assert.deepEqual(queue.map((n) => n.id), ['plan:2026-11-25:pm', 'plan:2026-11-26:am'])
})

test('sends what is due, once, and not when it is hours late', () => {
  const record = upsert(null, sub, [notice('old', now - 4 * HOUR), notice('due', now - 5 * 60_000), notice('later', now + HOUR)], now)
  assert.deepEqual(dueNotices(record, now).map((n) => n.id), ['due'])
  const after = afterSend(record, ['due'], now)
  assert.deepEqual(dueNotices(after, now), [])
  // A new queue from the page keeps the memory of what was sent.
  assert.deepEqual(dueNotices(upsert(after, sub, record.queue, now), now), [])
})

test('keys, payloads and gone subscriptions', () => {
  assert.equal(keyFor(sub.endpoint).length, 64)
  assert.deepEqual(JSON.parse(payload(notice('x', now))), { id: 'x', title: 'Today: 2 items', body: 'Palindrome Check · Querying one table', url: '/today', tag: 'plan' })
  assert.ok(isGone(410) && isGone(404) && !isGone(500))
})
