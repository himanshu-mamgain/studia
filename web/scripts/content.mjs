// Refreshes src/content.json, the three apps' study lists the daily plan is made from (plan.ts):
// Structura's topics in roadmap order, DSA Atlas's Master Checklist and Schemata's lessons and
// questions. Each app publishes its list; if one can't be reached, its saved copy is kept, so the
// build never fails on it. Runs before every build.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '../src/content.json')
const saved = JSON.parse(readFileSync(file, 'utf8'))

async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn(`content: kept the saved copy of ${url} (${e.message})`)
    return null
  }
}

const [topics, checklist, plan] = await Promise.all([
  get('https://structura-web.netlify.app/topics.json'),
  get('https://dsa-atz.netlify.app/checklist.json'),
  get('https://schemata-web.netlify.app/plan.json'),
])

const next = {
  structura:
    Array.isArray(topics) && topics.every((t) => typeof t.order === 'number')
      ? [...topics].sort((a, b) => a.order - b.order).map(({ id, title, area, stage }) => ({ id, title, area, stage }))
      : saved.structura,
  dsa: Array.isArray(checklist?.items) && checklist.items.length ? checklist.items : saved.dsa,
  schemata: Array.isArray(plan?.lessons) && Array.isArray(plan?.questions) ? plan : saved.schemata,
}
writeFileSync(file, JSON.stringify(next))
console.log(`content: ${next.structura.length} topics, ${next.dsa.length} problems, ${next.schemata.lessons.length} lessons, ${next.schemata.questions.length} questions`)
