import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this app from a subpath (stephenzott.github.io/weekly-nfl-picks/),
// not the domain root, so every built asset URL needs that prefix baked in.
// `base` must match the repo name exactly (leading and trailing slash).
export default defineConfig({
  plugins: [react()],
  base: '/weekly-nfl-picks/',
})
