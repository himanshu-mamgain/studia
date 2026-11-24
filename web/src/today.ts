import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { appById } from './apps.ts'
import { configured } from './config.ts'
import {
  addDays,
  daysBetween,
  dayOf,
  doneAt,
  emptyState,
  forecast,
  GOAL,
  type Done,
  type Item,
  mergeState,
  pace,
  PHASES,
  phaseOf,
  prune,
  START,
  streak,
  type StudiaState,
  today,
} from './plan.ts'

// The Today page (/today): the day's checklist across the three apps, read from your account.
// The plan itself is in plan.ts; this file loads progress, keeps Studia's own row and draws it.

const LOCAL = 'studia:plan:v1'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const fmt = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', opts)
const time = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) || null : null)

function loadLocal(): StudiaState {
  try {
    const s = JSON.parse(localStorage.getItem(LOCAL) ?? 'null') as StudiaState | null
    return s?.version === 1 ? s : emptyState()
  } catch {
    return emptyState()
  }
}

function saveLocal(state: StudiaState) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(state))
  } catch {
    // Private windows can refuse storage; the account copy still has it.
  }
}

type Row = { app: string; data: Record<string, unknown> }

/** What each app's synced progress says is done (see each app's account/merge.ts for the shapes). */
export function doneFrom(rows: Row[]): Done {
  const done: Done = { dsa: {}, reviews: [], structura: {}, schemata: {} }
  const of = (app: string) => rows.find((r) => r.app === app)?.data ?? {}

  const s = of('structura') as { topics?: Record<string, { lessonDone?: boolean; completed?: boolean; completedAt?: number; updatedAt?: number }> }
  for (const [id, t] of Object.entries(s.topics ?? {}))
    if (t.lessonDone || t.completed) done.structura[id] = t.completedAt ?? t.updatedAt ?? Date.now()

  const a = of('dsa-atlas') as {
    checklist?: { id: string; done: boolean; doneAt?: number | null; updatedAt?: number }[]
    problems?: { id: string; title: string; review?: { nextDue?: number; lastSeen?: number | null } }[]
  }
  for (const c of a.checklist ?? []) if (c.done) done.dsa[c.id] = c.doneAt ?? c.updatedAt ?? Date.now()
  for (const p of a.problems ?? [])
    if (typeof p.review?.nextDue === 'number') done.reviews.push({ id: p.id, title: p.title, nextDue: p.review.nextDue, lastSeen: p.review.lastSeen ?? null })

  const m = of('schemata') as { solved?: Record<string, string>; lessonsRead?: Record<string, string> }
  for (const [id, at] of Object.entries(m.solved ?? {})) done.schemata[`q:${id}`] = time(at) ?? Date.now()
  for (const [id, at] of Object.entries(m.lessonsRead ?? {})) done.schemata[`lesson:${id}`] = time(at) ?? Date.now()
  return done
}

/** "Open" goes through Studia's login, so the app gets your session on its own site. */
function openUrl(item: Item) {
  if (!item.url) return ''
  const app = appById(item.app)
  return configured && app ? `/login?app=${app.id}&next=${encodeURIComponent(item.url)}` : item.url
}

const COLORS: Record<string, string> = { structura: '#a78bfa', 'dsa-atlas': '#34d399', schemata: '#38bdf8', studia: '#557c72' }
const LETTER: Record<string, string> = { structura: 'S', 'dsa-atlas': 'D', schemata: 'Q', studia: '★' }
const APP_NAME: Record<string, string> = { structura: 'Structura', 'dsa-atlas': 'DSA Atlas', schemata: 'Schemata', studia: 'Studia' }

export interface TodayData {
  date: string
  items: Item[]
  next: { date: string; items: Item[] }[]
  done: Done
  state: StudiaState
}

/** Loads progress and Studia's row, makes (or reuses) today's list and saves it. */
export async function loadToday(supabase: SupabaseClient, session: Session, now = Date.now()): Promise<TodayData> {
  const realToday = dayOf(now)
  // Before the start, show day 1 as a preview.
  const date = realToday < START ? START : realToday > GOAL ? GOAL : realToday
  const { data } = await supabase.from('app_progress').select('app, data').eq('user_id', session.user.id)
  const rows = (data ?? []) as Row[]
  const done = doneFrom(rows)
  const remote = rows.find((r) => r.app === 'studia')?.data as StudiaState | undefined
  let state = remote?.version === 1 ? mergeState(loadLocal(), remote) : loadLocal()
  const t = today(date, done, state)
  if (t.made && realToday >= START) state = { ...state, days: { ...state.days, [date]: t.items } }
  state = prune(state, date, done)
  await save(supabase, session, state)
  return { date, items: t.items, next: forecast(date, t.items, done, state), done, state }
}

/** Saves Studia's row locally and to your account. Before the owner runs the 'studia' migration, the account refuses it; the local copy still works. */
export async function save(supabase: SupabaseClient, session: Session, state: StudiaState) {
  saveLocal(state)
  const { error } = await supabase
    .from('app_progress')
    .upsert({ user_id: session.user.id, app: 'studia', data: state, updated_at: new Date().toISOString() })
  if (error) console.info('Studia plan: saved on this device only:', error.message)
}

export function renderToday(d: TodayData, now = Date.now()): string {
  const { date, items, done, state } = d
  const preview = dayOf(now) < START
  const phase = phaseOf(date)
  const dayN = daysBetween(START, date) + 1
  const total = daysBetween(START, GOAL) + 1
  const finished = items.filter((i) => doneAt(i, done, state, date) !== null).length
  const s = streak(date, done, state)
  const p = pace(date, done, state)

  const row = (i: Item) => {
    const at = doneAt(i, done, state, date)
    const auto = at !== null && !(state.ticks[i.key] > 0)
    const url = openUrl(i)
    return `<li class="item${at !== null ? ' is-done' : ''}">
      <button type="button" class="tick" data-key="${esc(i.key)}" aria-pressed="${at !== null}" ${auto ? `disabled title="Done in ${esc(APP_NAME[i.app])}"` : `title="${at !== null ? 'Untick' : 'Tick it off'}"`} aria-label="${esc(i.title)}: ${at !== null ? 'done' : 'not done'}">${at !== null ? '✓' : ''}</button>
      <span class="app-mark small" style="background:${COLORS[i.app]}" aria-hidden="true">${LETTER[i.app]}</span>
      <span class="item-text"><strong>${url ? `<a href="${esc(url)}">${esc(i.title)}</a>` : esc(i.title)}</strong><span>${esc(APP_NAME[i.app])} · ${esc(i.detail)}</span></span>
      ${url ? `<a class="go" href="${esc(url)}" aria-hidden="true" tabindex="-1">Open →</a>` : ''}
    </li>`
  }

  const bar = (label: string, x: { done: number; total: number; behind: number; expected: number }, color: string) => `
    <div class="pace-row">
      <div class="pace-label"><strong>${label}</strong><span>${x.done} of ${x.total}${x.done >= x.total ? ' · all done' : x.behind ? ` · <b class="behind">${x.behind} behind</b>` : ' · on track'}</span></div>
      <span class="bar"><span style="width:${Math.round((x.done / x.total) * 100)}%;background:${color}"></span></span>
    </div>`

  const tomorrow = d.next[0]
  return `
    <section class="card today-head">
      <p class="eyebrow">${preview ? 'Starts tomorrow · ' : ''}${esc(fmt(date, { weekday: 'long', day: 'numeric', month: 'short' }))} · Day ${dayN} of ${total}</p>
      <h1>${preview ? 'Your plan starts tomorrow' : 'Today'}</h1>
      <p class="muted">Phase ${phase.n}: ${esc(phase.name)}. ${esc(phase.about)}</p>
      <span class="bar big" aria-hidden="true"><span style="width:${items.length ? Math.round((finished / items.length) * 100) : 0}%"></span></span>
      <p class="today-count"><strong>${finished} of ${items.length} done</strong>${s ? ` · 🔥 ${s}-day streak` : ''}</p>
    </section>
    <ul class="items">${items.map(row).join('')}</ul>
    <p class="fine">Items tick themselves when you finish them in the app (a lesson in Structura, "Mark solved" in DSA Atlas, a solved question or "I've read this lesson" in Schemata). Tick the rest by hand. Anything left moves to tomorrow.</p>
    ${tomorrow ? `<section class="card"><h2>Tomorrow, ${esc(fmt(tomorrow.date, { weekday: 'long', day: 'numeric', month: 'short' }))}</h2><ul class="mini">${tomorrow.items.map((i) => `<li><span class="dot" style="background:${COLORS[i.app]}"></span>${esc(i.title)} <span class="muted">· ${esc(APP_NAME[i.app])}</span></li>`).join('')}</ul></section>` : ''}
    <section class="card">
      <h2>Progress to 1 August</h2>
      ${bar('DSA Atlas · checklist problems', p.dsa, COLORS['dsa-atlas'])}
      ${bar('Structura · topics', p.structura, COLORS.structura)}
      ${bar('Schemata · lessons and questions', p.schemata, COLORS.schemata)}
    </section>
    <section class="card">
      <h2>The four phases</h2>
      <ol class="phases">${PHASES.map((x, i) => {
        const from = i === 0 ? START : addDays(PHASES[i - 1].until, 1)
        return `<li class="${x.n === phase.n ? 'is-now' : date > x.until ? 'is-past' : ''}"><strong>${x.n}. ${esc(x.name)}</strong> <span class="muted">${esc(fmt(from, { day: 'numeric', month: 'short' }))} → ${esc(fmt(x.until, { day: 'numeric', month: 'short' }))}</span><span>${esc(x.about)}</span></li>`
      }).join('')}</ol>
    </section>
    <div id="notify"></div>`
}

/** A hand tick: ticked now, or unticked (minus the time, so the latest change wins on every device). */
export function toggle(state: StudiaState, key: string, now = Date.now()): StudiaState {
  const on = (state.ticks[key] ?? 0) > 0
  return { ...state, ticks: { ...state.ticks, [key]: on ? -now : now } }
}
