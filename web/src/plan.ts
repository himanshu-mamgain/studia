// The daily plan: one checklist a day across Structura (system design), DSA Atlas (problems) and
// Schemata (databases), from 25 Nov 2026 to the owner's job-switch goal on 1 Aug 2027.
//
// It's a queue, not a fixed calendar: each day takes the next unfinished items of each app, at
// that weekday's quota. Anything you miss stays at the front of the queue, so it comes back
// tomorrow by itself and the list never piles up; the pace line says how far behind you are, and
// Sunday adds one catch-up item per app. Items tick themselves off from each app's synced progress.
// A day's list is kept once it's made (StudiaState.days), so what you finish stays on it, ticked.
//
// Pure functions only: no DOM, no network (today.ts does those). Tested in plan.test.ts.

import content from './content.json'

export const START = '2026-11-25'
export const GOAL = '2027-08-01'

export const URLS = {
  structura: 'https://structura-web.netlify.app',
  'dsa-atlas': 'https://dsa-atz.netlify.app',
  schemata: 'https://schemata-web.netlify.app',
} as const

export type AppId = keyof typeof URLS | 'studia'
export type Kind = 'dsa' | 'dsa-review' | 'structura' | 'structura-review' | 'schemata' | 'practice'

export interface Item {
  /** Unique: `dsa:<id>`, `schemata:q:<id>`, `dsa-review:<problem>:<date>`, `practice:mock:<date>`… */
  key: string
  kind: Kind
  app: AppId
  title: string
  /** One short line under the title: "Tier 1 · Recursion", "Lesson · Foundations". */
  detail: string
  /** Where "Open" goes; empty for things you do outside the apps. */
  url: string
}

export interface Content {
  structura: { id: string; title: string; area: string; stage: string | null }[]
  dsa: { id: string; title: string; tier: number; pattern: string }[]
  schemata: {
    lessons: { id: string; title: string; phase: string }[]
    questions: { id: string; title: string; stage: string; level: string; kind: string }[]
  }
}

export const CONTENT = content as Content

/** What the apps' synced progress says you've done (today.ts reads it from your account). */
export interface Done {
  /** Checklist problem id → when you marked it solved (epoch ms). */
  dsa: Record<string, number>
  /** Problems in revision: next due and last reviewed (epoch ms). */
  reviews: { id: string; title: string; nextDue: number; lastSeen: number | null }[]
  /** Topic id → when you finished its lesson or marked it complete (epoch ms). */
  structura: Record<string, number>
  /** `lesson:<id>` or `q:<id>` → when (epoch ms). */
  schemata: Record<string, number>
}

/** What Studia keeps itself (in your account, app = 'studia'). */
export interface StudiaState {
  version: 1
  /** The list made for each recent day, so ticked items stay on it. */
  days: Record<string, Item[]>
  /**
   * Item key → when you ticked it by hand (for mocks, revisions and things done elsewhere), or
   * minus when you unticked it, so the latest change wins on every device.
   */
  ticks: Record<string, number>
  /** Older days, summed up: date → [done, total]. */
  history: Record<string, [number, number]>
}

export const emptyState = (): StudiaState => ({ version: 1, days: {}, ticks: {}, history: {} })

// ---------- Dates (local calendar days as YYYY-MM-DD) ----------

export const dayOf = (t: number | Date) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const utc = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
export const addDays = (date: string, n: number) => new Date(utc(date) + n * 86400000).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000)
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (date: string) => new Date(utc(date)).getUTCDay()
/** Local midnight at the start of `date`, as epoch ms. */
export const startOf = (date: string) => new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)).getTime()

// ---------- Phases ----------

export interface Phase {
  n: 1 | 2 | 3 | 4
  name: string
  until: string
  about: string
}

export const PHASES: Phase[] = [
  { n: 1, name: 'First pass', until: '2027-03-21', about: 'Every checklist problem, topic and lesson once, with daily revision.' },
  { n: 2, name: 'Depth', until: '2027-04-30', about: 'Revision every day, and one full design a week.' },
  { n: 3, name: 'Interview mode', until: '2027-06-15', about: 'Mock interviews twice a week; apply from mid-May.' },
  { n: 4, name: 'Interviews', until: GOAL, about: 'Light daily revision around your interview rounds.' },
]

export const phaseOf = (date: string) => PHASES.find((p) => date <= p.until) ?? PHASES[3]

// ---------- Quotas ----------

//                 Sun Mon Tue Wed Thu Fri Sat
const NEW_DSA = [1, 1, 1, 1, 1, 1, 2]
const NEW_STRUCTURA = [1, 0, 1, 0, 1, 0, 1]
const NEW_SCHEMATA = [1, 1, 0, 1, 0, 1, 1]

/** New items a day, before Sunday's catch-up. About 16 weeks to finish all three. */
export function quota(date: string) {
  const w = weekday(date)
  return { dsa: NEW_DSA[w], structura: NEW_STRUCTURA[w], schemata: NEW_SCHEMATA[w] }
}

/** Revisions a day: more once the first pass is done, most on Sundays. */
function reviewQuota(date: string) {
  const w = weekday(date)
  const first = phaseOf(date).n === 1
  return { dsa: w === 0 ? (first ? 3 : 4) : first ? 1 : 2, structura: w === 0 ? 2 : 1 }
}

// ---------- The three queues, in study order ----------

const levelRank: Record<string, number> = { easy: 0, medium: 1, hard: 2 }

export function queues(c: Content = CONTENT) {
  const dsa: Item[] = c.dsa.map((p) => ({
    key: `dsa:${p.id}`,
    kind: 'dsa',
    app: 'dsa-atlas',
    title: p.title,
    detail: `Tier ${p.tier} · ${p.pattern}`,
    url: `${URLS['dsa-atlas']}/?solve=${encodeURIComponent(p.id)}`,
  }))
  const structura: Item[] = c.structura.map((t) => ({
    key: `structura:${t.id}`,
    kind: 'structura',
    app: 'structura',
    title: t.title,
    detail: `Lesson${t.stage ? ` · ${t.stage}` : ''}`,
    url: `${URLS.structura}/topic/${encodeURIComponent(t.id)}/?learn`,
  }))
  // Each lesson, then its questions from easy to hard.
  const lessonIds = new Set(c.schemata.lessons.map((l) => l.id))
  const question = (q: Content['schemata']['questions'][number]): Item => ({
    key: `schemata:q:${q.id}`,
    kind: 'schemata',
    app: 'schemata',
    title: q.title,
    detail: `${q.kind === 'sql' ? 'SQL' : q.kind === 'design' ? 'Schema design' : 'Theory'} question · ${q.level}`,
    url: `${URLS.schemata}/questions/${encodeURIComponent(q.id)}`,
  })
  const schemata: Item[] = [
    ...c.schemata.lessons.flatMap((l) => [
      {
        key: `schemata:lesson:${l.id}`,
        kind: 'schemata' as const,
        app: 'schemata' as const,
        title: l.title,
        detail: `Lesson · ${l.phase}`,
        url: `${URLS.schemata}/topics/${encodeURIComponent(l.id)}`,
      },
      ...c.schemata.questions
        .filter((q) => q.stage === l.id)
        .sort((a, b) => (levelRank[a.level] ?? 1) - (levelRank[b.level] ?? 1))
        .map(question),
    ]),
    ...c.schemata.questions.filter((q) => !lessonIds.has(q.stage)).map(question),
  ]
  return { dsa, structura, schemata }
}

// ---------- Done ----------

/** When the apps (or your own tick) say this item was done, if it was. */
export function doneAt(item: Item, done: Done, state: StudiaState, date: string): number | null {
  const tick = state.ticks[item.key]
  if (tick > 0) return tick
  const id = item.key.split(':')
  switch (item.kind) {
    case 'dsa':
      return done.dsa[id[1]] ?? null
    case 'structura':
      return done.structura[id[1]] ?? null
    case 'schemata':
      return done.schemata[`${id[1]}:${id[2]}`] ?? null
    case 'dsa-review': {
      // Reviewed in DSA Atlas on (or after) that day.
      const p = done.reviews.find((r) => r.id === id[1])
      return p?.lastSeen && p.lastSeen >= startOf(date) ? p.lastSeen : null
    }
    default:
      return null // revisions of topics, mocks and reviews are ticked by hand
  }
}

const isDoneNow = (item: Item, done: Done, state: StudiaState) =>
  doneAt(item, done, state, item.key.split(':').at(-1) ?? START) !== null

// ---------- Pace ----------

export interface Pace {
  done: number
  total: number
  /** How many the plan expected done before today. */
  expected: number
  behind: number
}

/** Per app: done so far, against what the quotas expected by the start of `date`. */
export function pace(date: string, done: Done, state: StudiaState) {
  const q = queues()
  const expected = { dsa: 0, structura: 0, schemata: 0 }
  for (let d = START; d < date && d <= GOAL; d = addDays(d, 1)) {
    const n = quota(d)
    expected.dsa += n.dsa
    expected.structura += n.structura
    expected.schemata += n.schemata
  }
  const one = (list: Item[], exp: number): Pace => {
    const n = list.filter((i) => isDoneNow(i, done, state)).length
    const e = Math.min(exp, list.length)
    return { done: n, total: list.length, expected: e, behind: Math.max(0, e - n) }
  }
  return { dsa: one(q.dsa, expected.dsa), structura: one(q.structura, expected.structura), schemata: one(q.schemata, expected.schemata) }
}

// ---------- Making a day ----------

/**
 * The list for `date`: the next unfinished items of each queue at the day's quota (plus one
 * catch-up per app on Sundays when behind), due revisions, and the phase's practice. `planned`
 * holds keys already given to earlier days in a forecast, so a week ahead doesn't repeat them.
 */
export function makeDay(date: string, done: Done, state: StudiaState, planned: Set<string> = new Set()): Item[] {
  const q = queues()
  const n = quota(date)
  const phase = phaseOf(date)
  const sunday = weekday(date) === 0
  const p = sunday ? pace(date, done, state) : null
  const next = (list: Item[], count: number) =>
    list.filter((i) => !planned.has(i.key) && !isDoneNow(i, done, state)).slice(0, count)

  const items: Item[] = [
    ...next(q.dsa, n.dsa + (p && p.dsa.behind ? 1 : 0)),
    ...next(q.structura, n.structura + (p && p.structura.behind ? 1 : 0)),
    ...next(q.schemata, n.schemata + (p && p.schemata.behind ? 1 : 0)),
  ]

  // DSA revision: problems DSA Atlas says are due by the end of the day, the most overdue first.
  const r = reviewQuota(date)
  const end = startOf(addDays(date, 1))
  for (const due of done.reviews
    .filter((x) => x.nextDue < end && !planned.has(`dsa-review:${x.id}`))
    .sort((a, b) => a.nextDue - b.nextDue)
    .slice(0, r.dsa)) {
    planned.add(`dsa-review:${due.id}`)
    items.push({
      key: `dsa-review:${due.id}:${date}`,
      kind: 'dsa-review',
      app: 'dsa-atlas',
      title: due.title,
      detail: 'Revise · solve it again without notes',
      url: `${URLS['dsa-atlas']}/?problem=${encodeURIComponent(due.id)}`,
    })
  }

  // Structura revision: in the first pass, topics finished 1, 3 or 7 days before; after it,
  // every finished topic in turn, the one revised longest ago first.
  const finished = Object.entries(done.structura)
  // (In a forecast, topics already given to an earlier day count as just revised.)
  const lastRevised = (id: string) =>
    planned.has(`structura-review:${id}`)
      ? Infinity
      : Math.max(0, ...Object.entries(state.ticks).filter(([k]) => k.startsWith(`structura-review:${id}:`)).map(([, t]) => t))
  const toRevise =
    phase.n === 1
      ? finished.filter(([, at]) => [1, 3, 7].includes(daysBetween(dayOf(at), date))).map(([id]) => id)
      : finished.map(([id]) => id).sort((a, b) => lastRevised(a) - lastRevised(b))
  const titleOf = new Map(CONTENT.structura.map((t) => [t.id, t.title]))
  for (const id of toRevise.filter((id) => titleOf.has(id)).slice(0, r.structura)) {
    planned.add(`structura-review:${id}`)
    items.push({
      key: `structura-review:${id}:${date}`,
      kind: 'structura-review',
      app: 'structura',
      title: titleOf.get(id)!,
      detail: 'Revise · read the takeaways and answer the Q&As aloud',
      url: `${URLS.structura}/topic/${encodeURIComponent(id)}/?read`,
    })
  }

  // Practice outside the apps.
  const w = weekday(date)
  const practice = (type: string, title: string, detail: string, url = '') =>
    items.push({ key: `practice:${type}:${date}`, kind: 'practice', app: 'studia', title, detail, url })
  if (phase.n === 2 && w === 6)
    practice('design', 'Design one system in 45 minutes', 'Pick a Structura topic you finished, draw it on paper, then compare', URLS.structura)
  if ((phase.n === 3 && (w === 3 || w === 6)) || (phase.n === 4 && w === 3))
    practice('mock', 'Mock interview (45 minutes)', 'One DSA problem out loud, then one design, timed')
  if (phase.n === 3 && w === 1 && date >= '2027-05-15')
    practice('apply', 'Apply to 3 roles at product companies', 'Note each one in DSA Atlas goals')
  if (w === 0) practice('weekly', 'Weekly review (15 minutes)', 'What went wrong this week? Move anything left to next week')

  for (const i of items) planned.add(i.key)
  return items
}

/** Today's list: the one already made for today, or a new one. */
export function today(date: string, done: Done, state: StudiaState): { items: Item[]; made: boolean } {
  const kept = state.days[date]
  if (kept) return { items: kept, made: false }
  return { items: makeDay(date, done, state), made: true }
}

/** The next `n` days after `date`, assuming you finish each day's list. For reminders. */
export function forecast(date: string, todayItems: Item[], done: Done, state: StudiaState, n = 7): { date: string; items: Item[] }[] {
  const planned = new Set(todayItems.map((i) => i.key.split(':').slice(0, i.kind === 'schemata' ? 3 : 2).join(':')))
  const out: { date: string; items: Item[] }[] = []
  for (let d = addDays(date, 1); out.length < n && d <= GOAL; d = addDays(d, 1)) out.push({ date: d, items: makeDay(d, done, state, planned) })
  return out
}

/** Keeps the last two weeks of lists; older days become [done, total] in history. */
export function prune(state: StudiaState, date: string, done: Done): StudiaState {
  const days: Record<string, Item[]> = {}
  const history = { ...state.history }
  for (const [d, items] of Object.entries(state.days)) {
    if (daysBetween(d, date) > 14) history[d] = [items.filter((i) => doneAt(i, done, state, d) !== null).length, items.length]
    else days[d] = items
  }
  return { ...state, days, history }
}

/** Days in a row, up to today, with every item done (today counts once it's finished). */
export function streak(date: string, done: Done, state: StudiaState): number {
  const full = (d: string) => {
    const items = state.days[d]
    if (items) return items.length > 0 && items.every((i) => doneAt(i, done, state, d) !== null)
    const h = state.history[d]
    return !!h && h[1] > 0 && h[0] === h[1]
  }
  let n = 0
  let d = full(date) ? date : addDays(date, -1)
  while (d >= START && full(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** Combines this device's state with the account's: every day and tick from either. */
export function mergeState(a: StudiaState, b: StudiaState): StudiaState {
  const ticks = { ...b.ticks }
  for (const [k, t] of Object.entries(a.ticks)) if (Math.abs(t) > Math.abs(ticks[k] ?? 0)) ticks[k] = t
  return { version: 1, days: { ...b.days, ...a.days }, ticks, history: { ...b.history, ...a.history } }
}
