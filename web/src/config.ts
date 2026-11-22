// Netlify environment variables for the Studia site (read at build time). The same Supabase
// project and the same cookie as the apps: see ../../docs/accounts.md.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''
/** `.studia.dev` once the apps live there: then every app reads this site's session directly. */
export const COOKIE_DOMAIN = (import.meta.env.VITE_AUTH_COOKIE_DOMAIN as string | undefined) ?? ''
export const COOKIE_NAME = 'studia-auth'
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY)
