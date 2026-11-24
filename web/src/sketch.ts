import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'

// Studia's hand-drawn look, the same as Structura's diagrams (rough.js). Cards, buttons, tasks,
// the week's days, the progress ring and bars get a sketchy outline drawn into an SVG behind
// their content. Every shape has a fixed seed from its place on the page, so it looks the same
// on every draw instead of wobbling, and it's redrawn when the element changes size.
//
// Colours come from CSS: `--sk` is the pencil colour (falls back to the text colour), `--app`
// the app's colour for tasks and bars.

const gen = rough.generator()
const SELECTOR = '[data-sketch], .card, .btn, .task, .week li, .hero-card, .today-link'
const drawn = new WeakMap<Element, string>()
let observer: ResizeObserver | null = null

function seedOf(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 2147483646) + 1
}

/** A rounded rectangle as SVG path data, so rough.js can wobble its corners too. */
function rounded(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
}

const paths = (d: ReturnType<typeof gen.path>, extra = '') =>
  gen
    .toPaths(d)
    .map((p) => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? 'none'}" ${extra}/>`)
    .join('')

function css(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

function draw(el: HTMLElement) {
  const { width: w, height: h } = el.getBoundingClientRect()
  if (!w || !h) return
  const kind = el.dataset.sketch || 'box'
  const pencil = css(el, '--sk') || getComputedStyle(el).color
  const app = css(el, '--app') || pencil
  const key = `${kind}:${Math.round(w)}x${Math.round(h)}:${pencil}:${app}:${el.dataset.value ?? ''}:${el.getAttribute('aria-pressed') ?? ''}`
  if (drawn.get(el) === key && el.querySelector(':scope > svg.sketch')) return
  drawn.set(el, key)
  const seed = seedOf(`${el.className}:${el.textContent?.slice(0, 40)}`)
  const base: Options = { seed, stroke: pencil, strokeWidth: 1.6, roughness: 1.1, bowing: 0.8 }
  let svg = ''

  if (kind === 'ring') {
    // A circle track, and an arc for the share done.
    const f = Math.max(0, Math.min(1, Number(el.dataset.value) || 0))
    const c = Math.min(w, h) / 2
    svg += paths(gen.circle(w / 2, h / 2, c * 2 - 10, { ...base, stroke: 'rgba(255,255,255,.35)', strokeWidth: 3 }))
    if (f > 0)
      svg += paths(
        f >= 0.999
          ? gen.circle(w / 2, h / 2, c * 2 - 10, { ...base, seed: seed + 1, stroke: pencil, strokeWidth: 5, roughness: 0.9 })
          : gen.arc(w / 2, h / 2, c * 2 - 10, c * 2 - 10, -Math.PI / 2, -Math.PI / 2 + f * 2 * Math.PI, false, { ...base, seed: seed + 1, stroke: pencil, strokeWidth: 5, roughness: 0.9 }),
      )
  } else if (kind === 'bar') {
    const f = Math.max(0, Math.min(1, Number(el.dataset.value) || 0))
    svg += paths(gen.path(rounded(1, 1, w - 2, h - 2, h / 2), { ...base, stroke: pencil, strokeWidth: 1.3 }))
    if (f > 0)
      svg += paths(
        gen.rectangle(2, 2, Math.max(4, (w - 4) * f), h - 4, { seed: seed + 2, stroke: 'none', fill: app, fillStyle: 'hachure', hachureGap: 3.2, hachureAngle: -41, fillWeight: 1.6, roughness: 1 }),
      )
  } else if (kind === 'tick') {
    const on = el.getAttribute('aria-pressed') === 'true'
    svg += paths(gen.circle(w / 2, h / 2, Math.min(w, h) - 4, { ...base, stroke: on ? '#1c8a49' : pencil, strokeWidth: 1.8, ...(on ? { fill: '#1c8a49', fillStyle: 'hachure', hachureGap: 3, fillWeight: 1.4 } : {}) }))
    if (on) svg += paths(gen.linearPath([[w * 0.28, h * 0.52], [w * 0.44, h * 0.68], [w * 0.74, h * 0.32]], { ...base, seed: seed + 3, stroke: '#fffdf8', strokeWidth: 3, roughness: 0.6 }))
  } else {
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12
    svg += paths(gen.path(rounded(2, 2, w - 4, h - 4, r), base))
    // Tasks: a hachured strip down the left edge in the app's colour.
    if (el.classList.contains('task'))
      svg += paths(gen.rectangle(4, 6, 6, h - 12, { seed: seed + 4, stroke: 'none', fill: app, fillStyle: 'hachure', hachureGap: 2.5, fillWeight: 1.5, roughness: 0.8 }))
  }

  let layer = el.querySelector<SVGSVGElement>(':scope > svg.sketch')
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    layer.setAttribute('class', 'sketch')
    layer.setAttribute('aria-hidden', 'true')
    el.prepend(layer)
  }
  layer.setAttribute('viewBox', `0 0 ${w} ${h}`)
  layer.innerHTML = svg
}

/** Draws every sketched element under `root`, and redraws each when its size changes. */
export function sketchAll(root: ParentNode = document) {
  observer ??= new ResizeObserver((entries) => entries.forEach((e) => draw(e.target as HTMLElement)))
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    el.classList.add('sketched')
    draw(el)
    observer!.observe(el)
  })
}
