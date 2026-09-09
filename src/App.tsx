import { NavLink, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { PicksPage } from './pages/PicksPage'
import { StandingsPage } from './pages/StandingsPage'

// The one hero moment per STYLE_GUIDE.md — a bold masthead banner
// styled like the top of a real tout sheet, with the league's actual
// (joke) name front and center. Everything below this is deliberately
// quiet by comparison.
function Masthead() {
  return (
    <header className="masthead">
      <h1 className="masthead__title">Luke's Annual $10 Donation</h1>
      <p className="masthead__subtitle">Weekly Picks Against the Spread</p>
    </header>
  )
}

// `NavLink`'s `className` prop can take a function of `{ isActive }` —
// this is how react-router lets you conditionally apply your own class
// name to whichever link matches the current URL (there's no automatic
// ".active" class applied for you, unlike some older routing libraries).
function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)

  return (
    <nav className="nav">
      <NavLink to="/" end className={linkClass}>
        Picks
      </NavLink>
      <NavLink to="/standings" className={linkClass}>
        Standings
      </NavLink>
      <NavLink to="/admin" className={linkClass}>
        Admin
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <div>
      <Masthead />
      <NavBar />
      <Routes>
        <Route path="/" element={<PicksPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}
