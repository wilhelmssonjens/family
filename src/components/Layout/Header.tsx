import { NavLink } from 'react-router-dom'

export function Header() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-sans transition-colors px-2 py-1 rounded ${
      isActive ? 'text-accent font-semibold bg-accent/10' : 'text-text-secondary hover:text-text-primary'
    }`

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 bg-bg-primary border-b border-bg-secondary">
      <h1 className="font-serif text-lg sm:text-xl text-text-primary">
        <span className="font-semibold">Familjen</span>
      </h1>
      <nav className="flex gap-2 sm:gap-4">
        <NavLink to="/" end className={linkClass}>Släktträd</NavLink>
        <NavLink to="/lista" className={linkClass}>Lista</NavLink>
        <NavLink to="/sok" className={linkClass}>Sök</NavLink>
        <NavLink to="/galleri" className={linkClass}>Galleri</NavLink>
      </nav>
    </header>
  )
}
