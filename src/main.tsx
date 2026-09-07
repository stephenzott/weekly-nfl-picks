import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// `BrowserRouter`'s `basename` must match the Vite `base` config
// (vite.config.ts) so client-side route URLs line up with where GitHub Pages
// actually serves the app from (a subpath, not the domain root).
// `import.meta.env.BASE_URL` is Vite's own copy of that same `base` value,
// so we read it from there instead of hardcoding the string twice.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
