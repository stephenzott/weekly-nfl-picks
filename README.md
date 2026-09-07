# Weekly NFL Picks

Private web app for 5 friends to pick NFL games against the spread each week
with fake money. See `PROJECT_SPEC.md` for the full requirements spec.

## Stack

- React + TypeScript, built with [Vite](https://vite.dev)
- [Firebase Firestore](https://firebase.google.com/docs/firestore) for shared, real-time data
- Deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`
- No authentication — see PROJECT_SPEC.md Section 3 for why

## Local development

```bash
npm install
npm run dev      # start local dev server
npm run build    # type-check and produce a production build in dist/
```
