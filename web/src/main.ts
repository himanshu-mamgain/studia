import './styles.css'
import { createBrowserClient } from '@supabase/ssr'
import { createClient, type Session } from '@supabase/supabase-js'
import { APPS, appById, safeNext, type StudiaApp } from './apps.ts'
import { configured, COOKIE_DOMAIN, COOKIE_NAME, SUPABASE_KEY, SUPABASE_URL } from './config.ts'

// The Studia site: the home page (/), the shared login (/login?app=…&next=…) and sign-out
// (/logout). An app sends a signed-out learner to /login with the page they wanted; after
// GitHub, Studia sends them straight back to it, signed in.

const root = document.getElementById('app')!
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
const path = location.pathname.replace(/\/+$/, '') || '/'
const query = new URLSearchParams(location.search)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const view = (html: string) => (root.innerHTML = html)

function who(session: Session) {
  const m = session.user.user_metadata ?? {}
  return { name: String(m.full_name || m.name || m.user_name || session.user.email || 'You'), login: m.user_name as string | undefined, avatar: m.avatar_url as string | undefined }
}

const brand = `<a class="brand" href="/"><img class="mark" src="/favicon.svg" alt="" width="36" height="36" />Studia</a>`

function appCards(session: Session | null) {
  return `<ul class="apps">${APPS.map(
    // Through the login, so you arrive signed in: it asks you to sign in first, or (signed in
    // already) hands the app its session straight away. A plain link would open the app signed
    // out, or even an old copy its service worker keeps from an earlier visit.
    (a) => `<li><a class="app card" href="${configured ? `/login?app=${esc(a.id)}&amp;next=${esc(encodeURIComponent(`${a.url}/`))}` : esc(a.url)}">
      <span class="app-mark" style="background:${esc(a.color)}" aria-hidden="true">${esc(a.name[0])}</span>
      <span class="app-text"><strong>${esc(a.name)}</strong><span>${esc(a.tagline)}</span></span>
      <span class="go" aria-hidden="true">${session ? 'Open' : 'Sign in'} →</span></a></li>`,
  ).join('')}</ul>`
}

function userBox(session: Session) {
  const u = who(session)
  return `<div class="user card">
    ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" width="44" height="44" referrerpolicy="no-referrer" />` : ''}
    <div><strong>${esc(u.name)}</strong>${u.login ? `<span>@${esc(u.login)} on GitHub</span>` : ''}</div>
    <a class="btn" href="/logout">Sign out</a>
  </div>`
}

const signInButton = (label = 'Continue with GitHub') => `<button type="button" class="btn primary" id="signin">${label}</button>`
const fine = `<p class="fine">GitHub shares your name, username, picture and email address with Studia. Nothing else.</p>`

// Studia's own session lives in the shared cookie (on .studia.dev, every app reads it too).
const supabase = configured
  ? createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
      cookieOptions: {
        name: COOKIE_NAME,
        ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
        path: '/',
        sameSite: 'lax',
        secure: location.protocol === 'https:',
        maxAge: 60 * 60 * 24 * 400,
      },
    })
  : null

/** Sign in to Studia with GitHub, then come back to this same page (e.g. /login?app=…&next=…). */
async function signIn() {
  const button = document.getElementById('signin') as HTMLButtonElement | null
  if (button) {
    button.disabled = true
    button.textContent = 'Opening GitHub…'
  }
  const back = new URL(location.href)
  back.hash = ''
  for (const key of ['code', 'error', 'error_code', 'error_description']) back.searchParams.delete(key)
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: back.toString() } })
  if (error) showError(error.message)
}

/**
 * Send a signed-in learner on to the app page they asked for. On studia.dev the app reads
 * this site's cookie, so a plain redirect is enough. On separate netlify.app sites it can't,
 * so the app gets its own session: a quick GitHub round trip (no click, as GitHub already
 * knows Studia) that lands on the app with the tokens in the address's fragment.
 */
async function continueTo(next: URL, app: StudiaApp) {
  view(`${brand}<section class="card center"><h1>Taking you to ${esc(app.name)}…</h1><p class="muted">Signed in to Studia.</p></section>`)
  next.hash = '' // Supabase adds the tokens after a '#'
  if (COOKIE_DOMAIN && next.hostname.endsWith(COOKIE_DOMAIN.replace(/^\./, ''))) {
    location.replace(next.toString())
    return
  }
  const handoff = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'studia-handoff' },
  })
  const { data, error } = await handoff.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: next.toString(), skipBrowserRedirect: true } })
  if (error || !data.url) return showError(error?.message ?? 'Could not reach GitHub.')
  location.replace(data.url)
}

function showError(message: string) {
  const box = document.getElementById('error')
  if (box) box.textContent = message
  else view(`${brand}<section class="card center"><h1>Something went wrong</h1><p class="error">${esc(message)}</p><p><a class="btn" href="/">Studia home</a></p></section>`)
  const button = document.getElementById('signin') as HTMLButtonElement | null
  if (button) {
    button.disabled = false
    button.textContent = 'Try again'
  }
}

async function start() {
  if (!supabase) {
    view(`${brand}<section class="card center"><h1>Studia isn't set up yet</h1><p class="muted">This build has no Supabase settings (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).</p></section>${appCards(null)}`)
    return
  }
  // Back from GitHub: the client swaps ?code= for a session by itself. Tidy the address.
  const failed = query.get('error_description')
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (query.has('code') || failed) {
    const clean = new URL(location.href)
    for (const key of ['code', 'error', 'error_code', 'error_description']) clean.searchParams.delete(key)
    history.replaceState(null, '', clean.pathname + clean.search)
  }

  if (path === '/logout') {
    if (session) await supabase.auth.signOut({ scope: 'local' })
    const next = safeNext(query.get('next'), local)
    const again = next ? `/login?app=${next.app.id}&next=${encodeURIComponent(next.url.toString())}` : '/login'
    view(`${brand}<section class="card center"><h1>You're signed out</h1>
      <p class="muted">You're signed out of Studia${next ? ` and ${esc(next.app.name)}` : ''} in this browser.</p>
      <p><a class="btn primary" href="${esc(again)}">Sign in again</a></p></section>${appCards(null)}`)
    return
  }

  if (path === '/login') {
    const next = safeNext(query.get('next'), local)
    const app = next?.app ?? appById(query.get('app'))
    if (session && next) return continueTo(next.url, next.app)
    if (session) {
      location.replace('/')
      return
    }
    view(`${brand}<section class="card center login">
      <h1>Sign in to continue${app ? ` to ${esc(app.name)}` : ''}</h1>
      <p class="muted">One Studia account opens Structura, Schemata and DSA Atlas. Your progress follows you to every device.</p>
      <p class="error" id="error">${failed ? `GitHub sign-in didn't finish: ${esc(failed)}` : ''}</p>
      ${signInButton()}
      ${fine}
    </section>`)
    document.getElementById('signin')!.addEventListener('click', () => void signIn())
    return
  }

  // Home.
  view(`${brand}
    <section class="hero">
      <h1>Learn, practise and design, with one account.</h1>
      <p class="muted">Studia brings together three learning apps. Sign in once with GitHub, and your progress follows you to every device.</p>
      ${session ? '' : `<p class="error" id="error">${failed ? esc(failed) : ''}</p>${signInButton()}${fine}`}
    </section>
    ${session ? userBox(session) : ''}
    ${appCards(session)}`)
  document.getElementById('signin')?.addEventListener('click', () => void signIn())
}

void start()
