import { NavLink } from 'react-router-dom'

export function Header() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-sans transition-colors ${
      isActive ? 'text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
    }`

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-bg-primary border-b border-bg-secondary">
      <h1 className="font-serif text-xl text-text-primary">
        <span className="font-semibold">Familjen</span>
      </h1>
      <nav className="flex gap-6">
        <NavLink to="/" end className={linkClass}>Träd</NavLink>
        <NavLink to="/sok" className={linkClass}>Sök</NavLink>
        <NavLink to="/galleri" className={linkClass}>Galleri</NavLink>
      </nav>
    </header>
  )
}
