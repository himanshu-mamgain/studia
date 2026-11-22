import ecosystem from '../../ecosystem.json'

export interface StudiaApp {
  id: string
  name: string
  tagline: string
  color: string
  url: string
  studiaUrl: string
  repo: string
}

export const APPS: StudiaApp[] = ecosystem.apps

export const appById = (id: string | null | undefined) => APPS.find((a) => a.id === id)

/**
 * Where Studia may send someone after signing in: a page of one of the apps (its Netlify
 * site, that site's deploy previews, or its studia.dev address), or localhost while
 * Studia itself runs on localhost. Anything else is refused, so the login page can't be
 * used to bounce people to another site.
 */
export function safeNext(raw: string | null, studiaIsLocal = false): { url: URL; app: StudiaApp } | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return studiaIsLocal && (url.protocol === 'http:' || url.protocol === 'https:') ? { url, app: APPS[0] } : null
  }
  if (url.protocol !== 'https:') return null
  for (const app of APPS) {
    const site = new URL(app.url).hostname // structura-web.netlify.app
    const studia = new URL(app.studiaUrl).hostname // structura.studia.dev
    const preview = site.endsWith('.netlify.app') && url.hostname.endsWith(`--${site}`) // deploy-preview-12--structura-web.netlify.app
    if (url.hostname === site || url.hostname === studia || preview) return { url, app }
  }
  return null
}
