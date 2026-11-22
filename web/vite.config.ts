import { defineConfig } from 'vite'

// The Studia site: the home page and the shared login. The app list comes from
// ../ecosystem.json, one folder up, so the dev server may read it.
export default defineConfig({
  server: { fs: { allow: ['..'] } },
})
