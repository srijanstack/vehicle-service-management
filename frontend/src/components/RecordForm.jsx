import { useState } from 'react'
import { Alert, Button, Field, Input, Select, Textarea } from './ui.jsx'

// fields: [{ name, label, type: text|number|date|select|textarea, required, options, span2, placeholder }]
export default function RecordForm({ fields, initial = {}, submitLabel, onSubmit, onCancel }) {
  const [f, setF] = useState(() => Object.fromEntries(fields.map((x) => [x.name, initial[x.name] ?? x.default ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = Object.fromEntries(
      fields.map((x) => [x.name, x.type === 'number' && f[x.name] !== '' ? Number(f[x.name]) : f[x.name]]),
    )
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-md border border-olive-200 bg-olive-50/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((x) => (
          <Field key={x.name} label={x.label} required={x.required} className={x.span2 || x.type === 'textarea' ? 'sm:col-span-2' : ''}>
            {x.type === 'select' ? (
              <Select value={f[x.name]} onChange={set(x.name)} required={x.required}>
                {x.options.map((o) => <option key={o}>{o}</option>)}
              </Select>
            ) : x.type === 'textarea' ? (
              <Textarea value={f[x.name]} onChange={set(x.name)} required={x.required} placeholder={x.placeholder} />
            ) : (
              <Input type={x.type || 'text'} min={x.type === 'number' ? 0 : undefined} value={f[x.name]}
                onChange={set(x.name)} required={x.required} placeholder={x.placeholder} list={x.list} />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <Alert>{error}</Alert>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </form>
  )
}
