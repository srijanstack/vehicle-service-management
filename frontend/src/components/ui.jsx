import { useEffect, useState } from 'react'

export const inputCls =
  'w-full rounded-md border border-ash-300 bg-white px-3 py-2 text-sm text-ash-800 placeholder:text-ash-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-500/20'

export function Field({ label, required, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ash-600">
        {label}
        {required && <span className="text-olive-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ash-500">{hint}</span>}
    </label>
  )
}

export const Input = (props) => <input {...props} className={`${inputCls} ${props.className || ''}`} />
export const Select = ({ children, ...props }) => (
  <select {...props} className={`${inputCls} ${props.className || ''}`}>{children}</select>
)
export const Textarea = (props) => <textarea rows={3} {...props} className={`${inputCls} ${props.className || ''}`} />

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-olive-700 text-white hover:bg-olive-800 disabled:bg-olive-300',
    secondary: 'border border-ash-300 bg-white text-ash-700 hover:bg-ash-100 disabled:text-ash-400',
    ghost: 'text-olive-700 hover:bg-olive-50',
  }
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-ash-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-ash-200 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-olive-800">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

const tones = {
  green: 'bg-olive-100 text-olive-800',
  gray: 'bg-ash-200 text-ash-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
}
export const Badge = ({ tone = 'gray', children }) => (
  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
)

export const statusTone = (s) =>
  ({ Active: 'green', Completed: 'green', Pass: 'green', Low: 'gray', 'In Progress': 'amber', Medium: 'amber',
     Pending: 'amber', 'Under Maintenance': 'amber', Inactive: 'gray', High: 'red', Critical: 'red', Fail: 'red' })[s] || 'gray'

export const Alert = ({ type = 'error', children }) =>
  children ? (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${
        type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-olive-200 bg-olive-50 text-olive-800'
      }`}
    >
      {children}
    </div>
  ) : null

export const Empty = ({ children }) => <p className="py-8 text-center text-sm text-ash-500">{children}</p>
export const Loading = () => <p className="py-8 text-center text-sm text-ash-500">Loading…</p>

export function Table({ columns, rows, empty = 'No records yet.' }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ash-200 text-xs uppercase tracking-wide text-ash-500">
            {columns.map((c) => (
              <th key={c.header} className="px-3 py-2 font-semibold">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-b border-ash-100 last:border-0 hover:bg-ash-50">
              {columns.map((c) => (
                <td key={c.header} className="px-3 py-2.5 align-top">{c.render ? c.render(r) : r[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Loads data on mount / when deps change.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => alive && setState({ data, error: '', loading: false }))
      .catch((e) => alive && setState({ data: null, error: e.message, loading: false }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export const fmtDate = (d) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const fmtKm = (n) => (n == null ? '—' : `${Number(n).toLocaleString('en-IN')} km`)
export const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
export const today = () => new Date().toISOString().slice(0, 10)
