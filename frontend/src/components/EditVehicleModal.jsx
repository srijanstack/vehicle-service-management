import { useState } from 'react'
import { api } from '../api.js'
import { Alert, Button, Field, Input, Select, fmtKm } from './ui.jsx'

const TYPES = [
  'SUV',
  'Truck',
  'Jeep',
  'Ambulance',
  'Armoured Vehicle',
  'Bus',
  'Motorcycle',
  'Recovery Vehicle',
  'Other',
]

const STATUSES = [
  'Active',
  'Under Maintenance',
  'Inactive',
  'Decommissioned',
]

export default function EditVehicleModal({ vehicle, onClose, onSuccess }) {
  if (!vehicle) return null

  const [f, setF] = useState({
    registration_number: vehicle.registration_number || '',
    vehicle_name: vehicle.vehicle_name || '',
    vehicle_type: vehicle.vehicle_type || 'SUV',
    manufacturer: vehicle.manufacturer || '',
    model: vehicle.model || '',
    manufacture_year: vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
    unit_name: vehicle.unit_name || '',
    current_odometer_km: vehicle.current_odometer_km != null ? String(vehicle.current_odometer_km) : '0',
    last_service_date: vehicle.last_service_date || '',
    next_service_due_date: vehicle.next_service_due_date || '',
    status: vehicle.status || 'Active',
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }))
    setError('')
  }

  const prevOdo = Number(vehicle.current_odometer_km || 0)
  const currentOdoNum = Number(f.current_odometer_km)
  const odoDiff = isNaN(currentOdoNum) ? 0 : currentOdoNum - prevOdo

  async function submit(e) {
    e.preventDefault()
    setError('')

    const odo = Number(f.current_odometer_km)
    if (isNaN(odo) || odo < 0) {
      setError('Please enter a valid odometer reading (0 or higher).')
      return
    }

    if (f.last_service_date && f.next_service_due_date && f.next_service_due_date < f.last_service_date) {
      setError('Next service due date cannot be earlier than the last service date.')
      return
    }

    setBusy(true)
    try {
      const payload = {
        registration_number: f.registration_number.trim().toUpperCase(),
        vehicle_name: f.vehicle_name.trim(),
        vehicle_type: f.vehicle_type,
        manufacturer: f.manufacturer.trim(),
        model: f.model.trim(),
        unit_name: f.unit_name.trim(),
        manufacture_year: f.manufacture_year ? Number(f.manufacture_year) : null,
        current_odometer_km: odo,
        status: f.status,
        last_service_date: f.last_service_date || null,
        next_service_due_date: f.next_service_due_date || null,
      }

      const updated = await api.updateVehicle(vehicle.id, payload)
      onSuccess?.(updated)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative my-8 w-full max-w-2xl rounded-xl border border-ash-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-ash-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ash-900">Vehicle Settings & Specifications</h3>
              <span className="plate text-xs font-semibold">{vehicle.registration_number}</span>
            </div>
            <p className="mt-0.5 text-xs text-ash-500">
              Update vehicle parameters, assigned unit, operational status, and odometer reading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ash-400 hover:bg-ash-100 hover:text-ash-700 transition-colors text-lg leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={submit} className="max-h-[78vh] overflow-y-auto p-6 space-y-6">
          <Alert>{error}</Alert>

          {/* Identification Section */}
          <section className="rounded-lg border border-ash-200 bg-ash-50/50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-olive-800">
              1. Identification & Assignment
            </h4>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Registration / Plate Number" required hint="Unique army vehicle identifier">
                <Input
                  required
                  maxLength={50}
                  value={f.registration_number}
                  onChange={set('registration_number')}
                  placeholder="e.g. 21B 09412A"
                  className="plate uppercase"
                />
              </Field>

              <Field label="Assigned Unit / Formation" required hint="Battalion or regiment assigned">
                <Input
                  required
                  maxLength={150}
                  value={f.unit_name}
                  onChange={set('unit_name')}
                  placeholder="e.g. 14 Corps Transport Detachment"
                />
              </Field>

              <Field label="Vehicle Name / Call Sign" required>
                <Input
                  required
                  maxLength={100}
                  value={f.vehicle_name}
                  onChange={set('vehicle_name')}
                  placeholder="e.g. Command Scorpio 01"
                />
              </Field>

              <Field label="Vehicle Type" required>
                <Select value={f.vehicle_type} onChange={set('vehicle_type')}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {/* Make & Model Section */}
          <section className="rounded-lg border border-ash-200 bg-ash-50/50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-olive-800">
              2. Make, Model & Year
            </h4>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Manufacturer" required>
                <Input
                  required
                  maxLength={100}
                  value={f.manufacturer}
                  onChange={set('manufacturer')}
                  placeholder="e.g. Mahindra"
                />
              </Field>

              <Field label="Model Name" required hint="Used to match maintenance schedule rules">
                <Input
                  required
                  maxLength={100}
                  value={f.model}
                  onChange={set('model')}
                  placeholder="e.g. Scorpio"
                />
              </Field>

              <Field label="Manufacture Year">
                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  value={f.manufacture_year}
                  onChange={set('manufacture_year')}
                  placeholder="e.g. 2022"
                />
              </Field>
            </div>
          </section>

          {/* Odometer & Status Section */}
          <section className="rounded-lg border border-ash-200 bg-ash-50/50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-olive-800">
              3. Odometer & Fleet Status
            </h4>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <Field label="Current Odometer (km)" required hint={`Previously recorded: ${fmtKm(prevOdo)}`}>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={f.current_odometer_km}
                    onChange={set('current_odometer_km')}
                    placeholder="Enter km reading"
                  />
                </Field>
                {/* Odometer Delta Feedback */}
                <div className="mt-1 text-xs">
                  {odoDiff > 0 ? (
                    <span className="font-medium text-olive-700">
                      ↑ +{odoDiff.toLocaleString('en-IN')} km driven since previous reading
                    </span>
                  ) : odoDiff < 0 ? (
                    <span className="font-medium text-amber-700">
                      ⚠️ Odometer correction: -{Math.abs(odoDiff).toLocaleString('en-IN')} km lower than recorded
                    </span>
                  ) : (
                    <span className="text-ash-500">Matches current recorded reading</span>
                  )}
                </div>
              </div>

              <Field label="Operational Status" required>
                <Select value={f.status} onChange={set('status')}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {/* Service Schedule Dates */}
          <section className="rounded-lg border border-ash-200 bg-ash-50/50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-olive-800">
              4. Service Baseline Dates
            </h4>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Last Service Date" hint="Date of most recent completed maintenance">
                <Input
                  type="date"
                  value={f.last_service_date}
                  onChange={set('last_service_date')}
                />
              </Field>

              <Field label="Next Service Due Date" hint="Scheduled target for next major service">
                <Input
                  type="date"
                  value={f.next_service_due_date}
                  onChange={set('next_service_due_date')}
                />
              </Field>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-ash-200 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving Settings…' : 'Save Vehicle Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
