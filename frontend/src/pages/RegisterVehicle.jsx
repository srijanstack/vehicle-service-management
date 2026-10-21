import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import { Alert, Button, Card, Field, Input, Select } from '../components/ui.jsx'

const TYPES = ['SUV', 'Truck', 'Jeep', 'Ambulance', 'Armoured Vehicle', 'Bus', 'Motorcycle', 'Recovery Vehicle', 'Other']
const STATUSES = ['Active', 'Under Maintenance', 'Inactive']

const empty = {
  registration_number: '', vehicle_name: '', vehicle_type: 'SUV', manufacturer: '', model: '',
  manufacture_year: '', unit_name: '', current_odometer_km: '0', last_service_date: '',
  next_service_due_date: '', status: 'Active',
}

export default function RegisterVehicle() {
  const nav = useNavigate()
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (f.last_service_date && f.next_service_due_date && f.next_service_due_date < f.last_service_date) {
      return setError('Next service due date cannot be earlier than the last service date.')
    }
    setBusy(true)
    try {
      const created = await api.createVehicle({
        ...f,
        registration_number: f.registration_number.trim().toUpperCase(),
        vehicle_name: f.vehicle_name.trim(),
        manufacturer: f.manufacturer.trim(),
        model: f.model.trim(),
        unit_name: f.unit_name.trim(),
        manufacture_year: f.manufacture_year ? Number(f.manufacture_year) : '',
        current_odometer_km: Number(f.current_odometer_km || 0),
      })
      nav(`/vehicles/${created.id}`, { state: { registered: true } })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Register Vehicle" subtitle="Add a new vehicle to the unit's fleet register." />
      <form onSubmit={submit} className="max-w-4xl space-y-6">
        <Alert>{error}</Alert>

        <Card title="Identification">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number plate" required hint="Must be unique across the fleet.">
              <Input required maxLength={50} value={f.registration_number} onChange={set('registration_number')}
                placeholder="e.g. 12A-345678K" className="plate uppercase" />
            </Field>
            <Field label="Unit name" required hint="Army unit this vehicle is assigned to.">
              <Input required maxLength={150} value={f.unit_name} onChange={set('unit_name')}
                placeholder="e.g. 5th Armoured Regiment" />
            </Field>
            <Field label="Vehicle name" required>
              <Input required maxLength={100} value={f.vehicle_name} onChange={set('vehicle_name')}
                placeholder="e.g. Command Jeep 01" />
            </Field>
            <Field label="Vehicle type" required>
              <Select value={f.vehicle_type} onChange={set('vehicle_type')}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Make & Model">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Manufacturer" required>
              <Input required maxLength={100} value={f.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Mahindra" />
            </Field>
            <Field label="Model name" required hint="Maintenance rules are matched on this exact name.">
              <Input required maxLength={100} value={f.model} onChange={set('model')} placeholder="e.g. Scorpio" />
            </Field>
            <Field label="Year of manufacture">
              <Input type="number" min={1900} max={2100} value={f.manufacture_year} onChange={set('manufacture_year')} placeholder="e.g. 2022" />
            </Field>
          </div>
        </Card>

        <Card title="Service Status">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current odometer (km)" required>
              <Input type="number" min={0} required value={f.current_odometer_km} onChange={set('current_odometer_km')} />
            </Field>
            <Field label="Status">
              <Select value={f.status} onChange={set('status')}>
                {STATUSES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Last service date" hint="If blank, registration date will be used as baseline.">
              <Input type="date" value={f.last_service_date} onChange={set('last_service_date')} />
            </Field>
            <Field label="Next service due" hint="Automatically calculated by the model's maintenance rules.">
              <div className="flex h-10 items-center rounded-md border border-ash-200 bg-ash-50 px-3 text-sm font-medium text-olive-800">
                ⚡ Auto-scheduled by Rules Engine
              </div>
            </Field>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register Vehicle'}</Button>
          <Link to="/vehicles"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="button" variant="ghost" onClick={() => { setF(empty); setError('') }}>Clear</Button>
        </div>
      </form>
    </>
  )
}
