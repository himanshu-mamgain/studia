import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addDays, CONTENT, emptyState, forecast, GOAL, makeDay, mergeState, pace, PHASES, quota, queues, START, startOf, streak, today, weekday, type Done } from './plan.ts'

const none = (): Done => ({ dsa: {}, reviews: [], structura: {}, schemata: {} })
const keys = (items: { key: string }[]) => items.map((i) => i.key)

/** Marks every item of a day done, as if you finished the list. */
function finish(done: Done, items: { key: string; kind: string }[], at: number) {
  for (const i of items) {
    const [, a, b] = i.key.split(':')
    if (i.kind === 'dsa') done.dsa[a] = at
    if (i.kind === 'structura') done.structura[a] = at
    if (i.kind === 'schemata') done.schemata[`${a}:${b}`] = at
  }
}

describe('the plan', () => {
  it('runs from 25 Nov 2026 to 1 Aug 2027: 250 days, four phases in order', () => {
    let n = 0
    for (let d = START; d <= GOAL; d = addDays(d, 1)) n++
    assert.equal(n, 250)
    assert.deepEqual(PHASES.map((p) => p.until), ['2027-03-21', '2027-04-30', '2027-06-15', '2027-08-01'])
  })

  it('gives 8 problems, 4 topics and 5 Schemata items a week', () => {
    const week = Array.from({ length: 7 }, (_, i) => quota(addDays('2026-11-29', i)))
    const sum = (k: 'dsa' | 'structura' | 'schemata') => week.reduce((n, q) => n + q[k], 0)
    assert.deepEqual([sum('dsa'), sum('structura'), sum('schemata')], [8, 4, 5])
  })

  it('finishes all 134 problems, 62 topics and 64 Schemata items in the first phase if you keep up', () => {
    const q = queues()
    assert.deepEqual([q.dsa.length, q.structura.length, q.schemata.length], [134, 62, 64])
    const done = none()
    let d = START
    for (; d <= GOAL; d = addDays(d, 1)) {
      finish(done, makeDay(d, done, emptyState()), startOf(d) + 20 * 3600000)
      if (Object.keys(done.dsa).length === 134 && Object.keys(done.structura).length === 62 && Object.keys(done.schemata).length === 64) break
    }
    assert.ok(d <= '2027-03-21', `finished on ${d}`)
  })

  it('starts with the first item of each queue, at Wednesday\'s quota', () => {
    assert.equal(weekday(START), 3)
    const day = makeDay(START, none(), emptyState())
    assert.deepEqual(keys(day), [`dsa:${CONTENT.dsa[0].id}`, `schemata:lesson:${CONTENT.schemata.lessons[0].id}`])
  })

  it('brings back what you missed, without piling up', () => {
    const tomorrow = makeDay(addDays(START, 1), none(), emptyState())
    assert.equal(tomorrow[0].key, `dsa:${CONTENT.dsa[0].id}`)
    assert.equal(tomorrow.filter((i) => i.kind === 'dsa').length, 1)
  })

  it('keeps a day once made, so finished items stay on it', () => {
    const state = emptyState()
    state.days[START] = [{ key: 'dsa:x', kind: 'dsa', app: 'dsa-atlas', title: 'X', detail: '', url: '' }]
    assert.deepEqual(keys(today(START, none(), state).items), ['dsa:x'])
  })

  it('adds one catch-up item per app on Sunday when you are behind', () => {
    const sunday = '2026-12-06'
    assert.equal(weekday(sunday), 0)
    assert.ok(pace(sunday, none(), emptyState()).dsa.behind > 0)
    const day = makeDay(sunday, none(), emptyState())
    assert.equal(day.filter((i) => i.kind === 'dsa').length, quota(sunday).dsa + 1)
    assert.ok(day.some((i) => i.key === `practice:weekly:${sunday}`))
  })

  it('adds DSA revisions that are due, the most overdue first', () => {
    const done = none()
    done.reviews = [
      { id: 'b', title: 'B', nextDue: startOf(START) + 3600000, lastSeen: null },
      { id: 'a', title: 'A', nextDue: startOf(START) - 86400000, lastSeen: null },
      { id: 'c', title: 'C', nextDue: startOf(addDays(START, 5)), lastSeen: null },
    ]
    assert.deepEqual(keys(makeDay(START, done, emptyState()).filter((i) => i.kind === 'dsa-review')), [`dsa-review:a:${START}`])
  })

  it('revises a finished Structura topic 1, 3 and 7 days later in the first phase', () => {
    const done = none()
    done.structura['url-shortener'] = startOf(START) + 3600000
    for (const [n, expect] of [[1, true], [2, false], [3, true], [7, true]] as const) {
      const day = makeDay(addDays(START, n), done, emptyState())
      assert.equal(day.some((i) => i.key.startsWith('structura-review:url-shortener:')), expect, `day +${n}`)
    }
  })

  it('forecasts the next week without giving anything twice', () => {
    const t = makeDay(START, none(), emptyState())
    const week = forecast(START, t, none(), emptyState())
    assert.equal(week.length, 7)
    const all = [...t, ...week.flatMap((d) => d.items)].filter((i) => !i.key.startsWith('practice:'))
    assert.equal(new Set(all.map((i) => i.key)).size, all.length)
  })

  it('counts a streak of finished days', () => {
    const state = emptyState()
    const item = (k: string) => ({ key: k, kind: 'practice' as const, app: 'studia' as const, title: '', detail: '', url: '' })
    for (const d of [START, addDays(START, 1), addDays(START, 2)]) {
      state.days[d] = [item(`practice:x:${d}`)]
      state.ticks[`practice:x:${d}`] = startOf(d)
    }
    assert.equal(streak(addDays(START, 3), none(), state), 3) // today not finished yet: still 3
    state.ticks[`practice:x:${addDays(START, 1)}`] = -startOf(addDays(START, 2)) // unticked later
    assert.equal(streak(addDays(START, 3), none(), state), 1)
  })

  it('merges devices: every day, and the latest tick or untick', () => {
    const a = emptyState()
    const b = emptyState()
    a.ticks.k = 100
    b.ticks.k = -200
    b.ticks.j = 50
    assert.deepEqual(mergeState(a, b).ticks, { k: -200, j: 50 })
  })
})
