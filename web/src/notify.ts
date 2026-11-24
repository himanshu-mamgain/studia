import { doneAt, type Item, startOf, streak } from './plan.ts'
import type { TodayData } from './today.ts'

// The daily plan's phone reminders: 11:00 (today's list), 17:00 (what's left) and 21:30 (the
// day's check-in), in your own time. The page works out their text for today and the next 7
// days and sends only that to /api/push (netlify/functions), which sends each one on time. Your
// progress never leaves the page; reminders for later days assume you finish each day's list,
// and every visit to /today sends an up-to-date set.

export interface Notice {
  id: string
  kind: string
  at: number
  title: string
  body: string
  url: string
}

export const TIMES = { am: [11, 0], pm: [17, 0], night: [21, 30] } as const

const at = (date: string, [h, m]: readonly [number, number]) => startOf(date) + (h * 60 + m) * 60000
const name = (i: Item) => (i.kind.endsWith('-review') ? `revise ${i.title}` : i.title)
function list(items: Item[]) {
  const text = items.map(name).join(' · ')
  return text.length > 380 ? `${text.slice(0, 377).replace(/\s+\S*$/, '')}…` : text
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The reminders still to come: today's (from what you've actually done) and the next days'. */
export function reminders(d: TodayData, now = Date.now()): Notice[] {
  const out: Notice[] = []
  const days = [{ date: d.date, items: d.items, actual: true }, ...d.next.map((x) => ({ ...x, actual: false }))]
  for (const { date, items, actual } of days) {
    if (!items.length) continue
    const left = actual ? items.filter((i) => doneAt(i, d.done, d.state, date) === null) : items
    const push = (slot: keyof typeof TIMES, title: string, body: string) => {
      const t = at(date, TIMES[slot])
      if (t > now) out.push({ id: `plan:${date}:${slot}`, kind: `plan-${slot}`, at: t, title, body, url: '/today' })
    }
    push('am', `Today: ${plural(items.length, 'item')}`, list(items))
    if (left.length) push('pm', `${plural(left.length, 'item')} left for today`, list(left))
    if (!actual) push('night', 'Day check-in', `Did you finish today's ${items.length}? Tick them off, or they move to tomorrow.`)
    else if (left.length) push('night', `Day check-in: ${items.length - left.length} of ${items.length} done`, `Still open: ${list(left)}. Finish one now, or it moves to tomorrow.`)
    else push('night', `All ${items.length} done today`, `Streak: ${plural(streak(date, d.done, d.state), 'day')}. Tomorrow's list is ready.`)
  }
  return out
}

// ---------- Subscribing (browser only) ----------

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/**
 * The service worker, once it's running. Subscribing straight after register() fails on Chrome
 * ("no active Service Worker"), so wait for ready.
 */
async function subscription() {
  await navigator.serviceWorker.register('/sw.js')
  const reg = await navigator.serviceWorker.ready
  return { reg, sub: await reg.pushManager.getSubscription() }
}

const send = (body: unknown) =>
  fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** On every visit: keeps the reminders up to date if they're on. */
export async function refresh(d: TodayData) {
  if (!supported() || Notification.permission !== 'granted') return
  const { sub } = await subscription()
  if (sub) await send({ subscription: sub.toJSON(), queue: reminders(d) }).catch(() => undefined)
}

function key(base64: string) {
  const s = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** The reminders card at the bottom of /today. */
export async function mountNotify(box: HTMLElement, getData: () => TodayData) {
  const card = (inner: string) => (box.innerHTML = `<section class="card notify"><h2>Reminders</h2>${inner}</section>`)
  if (!supported()) {
    card(`<p class="muted">This browser can't show reminders. On an iPhone, add Studia to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>`)
    return
  }
  const { sub } = await subscription()
  const on = sub && Notification.permission === 'granted'
  const times = '11:00 (today\'s list), 17:00 (what\'s left) and 21:30 (the day\'s check-in)'
  if (Notification.permission === 'denied') {
    card(`<p class="muted">Notifications are blocked for this site. Allow them in your browser's site settings, then come back.</p>`)
    return
  }
  if (!on) {
    card(`<p class="muted">Get a notification at ${times}. Only the reminder texts go to the server, never your progress.</p>
      <p class="error" id="push-error"></p><button type="button" class="btn primary" id="push-on">Turn on reminders</button>`)
    box.querySelector('#push-on')!.addEventListener('click', async () => {
      const error = box.querySelector('#push-error')!
      error.textContent = ''
      try {
        const res = await fetch('/api/push')
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Reminders aren\'t set up on the site yet.')
        const { publicKey } = (await res.json()) as { publicKey: string }
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications weren\'t allowed.')
        const { reg } = await subscription()
        const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) })
        const saved = await send({ subscription: fresh.toJSON(), queue: reminders(getData()) })
        if (!saved.ok) throw new Error(`The server didn't save your reminders (${saved.status}). Try again.`)
        const test = await send({ subscription: fresh.toJSON(), test: true })
        if (!test.ok) throw new Error((await test.json().catch(() => ({}))).error ?? 'The test notification failed.')
        void mountNotify(box, getData)
      } catch (e) {
        const message = (e as Error).message
        error.textContent = /permission|denied/i.test(message) && Notification.permission !== 'granted' ? 'Notifications weren\'t allowed. Allow them for this site in Chrome\'s site settings, then try again.' : message
      }
    })
    return
  }
  const next = reminders(getData())[0]
  card(`<p>Reminders are on: ${times}.</p>
    ${next ? `<p class="muted">Next: ${new Date(next.at).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}, "${next.title}".</p>` : ''}
    <p class="row"><button type="button" class="btn" id="push-test">Send a test</button> <button type="button" class="btn" id="push-off">Turn off</button></p>
    <p class="muted small" id="push-note" aria-live="polite"></p>`)
  box.querySelector('#push-test')!.addEventListener('click', async () => {
    const res = await send({ subscription: sub!.toJSON(), test: true }).catch(() => null)
    const note = box.querySelector('#push-note')!
    note.textContent = res?.ok ? 'Test sent. It should arrive in a few seconds.' : `The test didn't go through${res ? ` (${(await res.json().catch(() => ({}))).error ?? res.status})` : ''}.`
  })
  box.querySelector('#push-off')!.addEventListener('click', async () => {
    await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub!.endpoint }) }).catch(() => undefined)
    await sub!.unsubscribe()
    void mountNotify(box, getData)
  })
}
