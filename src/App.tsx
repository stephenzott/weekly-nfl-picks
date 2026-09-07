import { NavLink, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { PicksPage } from './pages/PicksPage'
import { StandingsPage } from './pages/StandingsPage'

// `NavLink` (vs. plain `Link`) automatically adds an "active" class to
// whichever link matches the current URL, which is what lets us highlight
// the current tab below.
function NavBar() {
  return (
    <nav>
      <NavLink to="/">Picks</NavLink>
      {' | '}
      <NavLink to="/standings">Standings</NavLink>
      {' | '}
      <NavLink to="/admin">Admin</NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        <Route path="/" element={<PicksPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}
