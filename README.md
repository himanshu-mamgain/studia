# Studia

Studia is a unified developer ecosystem bringing together Structura, Schemata, and DSA Atlas — empowering developers to learn, practice, design, and master software engineering through interconnected tools and a seamless single sign-on experience.

| App | What it teaches | Live | Repo |
| --- | --- | --- | --- |
| **Structura** | System design you can see working: diagrams, walkthroughs, simulators | [structura-web.netlify.app](https://structura-web.netlify.app) | [structura](https://github.com/himanshu-mamgain/structura) |
| **Schemata** | Databases: real SQL in your browser, interview questions, a roadmap | [schemata-web.netlify.app](https://schemata-web.netlify.app) | [schemata](https://github.com/himanshu-mamgain/schemata) |
| **DSA Atlas** | Data structures and algorithms: brute force to optimal, complexity, revision | [dsa-atz.netlify.app](https://dsa-atz.netlify.app) | [dsa-atlas](https://github.com/himanshu-mamgain/dsa-atlas) |

The apps will move to subdomains of **studia.dev**: `structura.studia.dev`, `schemata.studia.dev`
and `atlas.studia.dev`.

## What lives here

This repo holds what the apps share. Each app's own code stays in its repo.

- [`ecosystem.json`](ecosystem.json): the app list (names, taglines, colours, addresses). Each app
  keeps a copy in code; change it here first.
- [`docs/accounts.md`](docs/accounts.md): the Studia account. One GitHub sign-in for all three apps,
  and progress synced across devices, through one Supabase project. What every app must do the
  same way, and the setup steps.
- [`docs/domain.md`](docs/domain.md): moving the apps to `studia.dev`, which lets one sign-in cover
  all of them.
- [`supabase/migrations/`](supabase/migrations): the database: the `app_progress` table and its
  row-level security policies.
- [`web/`](web): the Studia site. Its home page lists the apps; its login page signs you in once
  with GitHub and sends you back to the app page you asked for.

## Status

- [x] Studia account in Structura (sign in with GitHub, progress sync)
- [x] Supabase project and GitHub OAuth app ([setup](docs/accounts.md#setup-once-by-the-owner))
- [ ] The Studia site on Netlify ([step 4](docs/accounts.md#4-put-the-studia-site-on-netlify))
- [ ] Structura behind the Studia login ([step 5](docs/accounts.md#5-give-the-apps-their-settings))
- [ ] Studia account in Schemata
- [ ] Studia account in DSA Atlas
- [ ] `studia.dev` and the move to subdomains ([steps](docs/domain.md))
