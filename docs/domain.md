# Moving the apps to studia.dev

Each app gets a subdomain of one domain, so they can share one sign-in and new apps fit in later:

| App | Today | After the move |
| --- | --- | --- |
| Studia home (later) | none | `https://studia.dev` |
| Structura | `https://structura-web.netlify.app` | `https://structura.studia.dev` |
| Schemata | `https://schemata-web.netlify.app` | `https://schemata.studia.dev` |
| DSA Atlas | `https://dsa-atz.netlify.app` | `https://atlas.studia.dev` |

Why a domain of our own: a sign-in cookie set on `.studia.dev` is sent to every `*.studia.dev`
site. `netlify.app` is on the browsers' public suffix list, a list of domains where each subdomain
belongs to a different owner, so one Netlify site can't set a cookie the others can read.

## Steps

1. **Buy the domain.** Check that `studia.dev` is free on a registrar (Cloudflare, Namecheap,
   Porkbun, or Netlify itself) and buy it. `.dev` sites must use HTTPS; Netlify does that for you.
2. **Point it at Netlify.** The simplest way is Netlify DNS: in Netlify, **Domains → Add a domain**,
   then set the registrar's name servers to the four Netlify gives you.
3. **Give each site its subdomain.** In each Netlify site, **Domain management → Add a domain**:
   `structura.studia.dev`, `schemata.studia.dev`, `atlas.studia.dev`, and make it the primary
   domain. Netlify then sends the old `netlify.app` address to the new one, so old links and
   installed apps keep working.
4. **Share the sign-in.** Add the cookie domain setting (`.studia.dev`) to all three sites (names in
   [accounts.md](accounts.md#settings-each-app-needs)) and redeploy.
5. **Update Supabase and GitHub.** In Supabase **URL Configuration**, set the Site URL to
   `https://studia.dev` and add `https://studia.dev/**` and `https://*.studia.dev/**` to the
   Redirect URLs (keep the old ones for a while). In the GitHub OAuth app, set the Homepage URL to
   `https://studia.dev`. The callback URL doesn't change.
6. **Update the app list.** Copy each `studiaUrl` from [`ecosystem.json`](../ecosystem.json) into
   `url`, then into each app's ecosystem list (Structura `apps/web/src/ecosystem.ts`, Schemata
   `src/ecosystem.ts`, DSA Atlas `packages/shared/src/ecosystem.ts`) and their links to each other.

People who were signed in before the move sign in once more: the old cookie belonged to the old
address.
