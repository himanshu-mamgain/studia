import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reminders } from './notify.ts'
import { emptyState, forecast, makeDay, START, startOf, type Done } from './plan.ts'

const none = (): Done => ({ dsa: {}, reviews: [], structura: {}, schemata: {} })

function data(done = none()) {
  const items = makeDay(START, done, emptyState())
  return { date: START, items, next: forecast(START, items, done, emptyState()), done, state: emptyState() }
}

describe('reminders', () => {
  it('sends 11:00, 17:00 and 21:30 for today and the next 7 days', () => {
    const r = reminders(data(), startOf(START) + 8 * 3600000) // 08:00
    assert.equal(r.length, 24)
    assert.deepEqual(r.slice(0, 3).map((n) => new Date(n.at).getHours() * 60 + new Date(n.at).getMinutes()), [660, 1020, 1290])
    assert.equal(r[0].id, `plan:${START}:am`)
    assert.match(r[0].title, /^Today: 3 items$/)
    assert.ok(r.every((n) => n.url === '/today'))
  })

  it('skips times that have passed, and says what is left', () => {
    const d = data()
    const done = { ...d.done, dsa: { [d.items[0].key.split(':')[1]]: startOf(START) + 12 * 3600000 } }
    const r = reminders({ ...d, done }, startOf(START) + 13 * 3600000) // 13:00
    assert.equal(r[0].id, `plan:${START}:pm`)
    assert.equal(r[0].title, '2 items left for today')
    assert.equal(r[0].body, `${d.items[1].title} · ${d.items[2].title}`)
    assert.equal(r[1].title, 'Day check-in: 1 of 3 done')
  })

  it('says well done at 21:30, with no 17:00 nudge, when everything is done', () => {
    const d = data()
    const at = startOf(START) + 12 * 3600000
    const done: Done = {
      ...none(),
      dsa: { [d.items[0].key.split(':')[1]]: at },
      structura: { [d.items[1].key.split(':')[1]]: at },
      schemata: { [d.items[2].key.split(':').slice(1).join(':')]: at },
    }
    const r = reminders({ ...d, done }, startOf(START) + 13 * 3600000).filter((n) => n.id.startsWith(`plan:${START}`))
    assert.deepEqual(r.map((n) => n.title), ['All 3 done today'])
  })
})
