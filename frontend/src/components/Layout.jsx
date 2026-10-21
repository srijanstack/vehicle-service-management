import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api.js'

const links = [
  ['/', 'Dashboard', true],
  ['/vehicles', 'Fleet'],
  ['/vehicles/register', 'Register Vehicle'],
  ['/work-orders', 'Work Orders'],
  ['/rules', 'Maintenance Rules'],
]

function ApiStatus() {
  const [ok, setOk] = useState(null)
  useEffect(() => {
    const ping = () => api.health().then(() => setOk(true)).catch(() => setOk(false))
    ping()
    const t = setInterval(ping, 15000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-2 text-xs text-olive-200">
      <span className={`h-2 w-2 rounded-full ${ok == null ? 'bg-ash-400' : ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {ok == null ? 'Checking API…' : ok ? 'Backend online' : 'Backend offline'}
    </div>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-olive-800 text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0">
        <div className="border-b border-olive-700 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-olive-300">Army</div>
          <div className="text-lg font-bold leading-tight">Vehicle Maintenance Portal</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col md:overflow-visible">
          {links.map(([to, label, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end || to === '/vehicles'}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-olive-800' : 'text-olive-100 hover:bg-olive-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-6 py-4 md:absolute md:bottom-0 md:block"><ApiStatus /></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-olive-700 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-olive-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ash-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
