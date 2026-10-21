import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import EditVehicleModal from '../components/EditVehicleModal.jsx'
import { Alert, Badge, Button, Card, Field, Input, Loading, Select, Table, fmtDate, fmtKm, statusTone, useLoad } from '../components/ui.jsx'

export default function Vehicles() {
  const { data, error, loading, reload } = useLoad(api.listVehicles)
  const [q, setQ] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState('')

  const [editingVehicle, setEditingVehicle] = useState(null)
  const [settingsVehicle, setSettingsVehicle] = useState(null)
  const [odoInput, setOdoInput] = useState('')
  const [odoBusy, setOdoBusy] = useState(false)
  const [odoError, setOdoError] = useState('')
  const [notice, setNotice] = useState('')

  const units = useMemo(() => [...new Set((data || []).map((v) => v.unit_name).filter(Boolean))].sort(), [data])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data || []).filter(
      (v) =>
        (!unit || v.unit_name === unit) &&
        (!status || v.status === status) &&
        (!s || [v.registration_number, v.vehicle_name, v.model, v.manufacturer].some((x) => x?.toLowerCase().includes(s))),
    )
  }, [data, q, unit, status])

  async function saveQuickOdometer(e) {
    e.preventDefault()
    if (!editingVehicle) return
    const val = Number(odoInput)
    if (isNaN(val) || val < 0) {
      setOdoError('Please enter a valid kilometre reading (0 or higher).')
      return
    }
    setOdoBusy(true)
    setOdoError('')
    try {
      await api.updateVehicleOdometer(editingVehicle.id, val)
      setNotice(`Updated odometer for ${editingVehicle.registration_number} to ${fmtKm(val)}.`)
      setEditingVehicle(null)
      reload()
    } catch (err) {
      setOdoError(err.message)
    } finally {
      setOdoBusy(false)
    }
  }

  return (
    <>
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-ash-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ash-900">Update Odometer</h3>
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="text-ash-400 hover:text-ash-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveQuickOdometer} className="space-y-4">
              <div className="rounded-md bg-ash-50 p-3 text-xs text-ash-600">
                <span className="font-medium text-ash-800">{editingVehicle.registration_number}</span> · {editingVehicle.vehicle_name}
                <div className="mt-1">Current recorded reading: <strong className="text-ash-900">{fmtKm(editingVehicle.current_odometer_km)}</strong></div>
              </div>

              <Field label="New Odometer Reading (km)" required>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  autoFocus
                  value={odoInput}
                  onChange={(e) => { setOdoInput(e.target.value); setOdoError('') }}
                  placeholder="Enter total km driven"
                  required
                />
              </Field>

              {odoInput !== '' && !isNaN(Number(odoInput)) && (
                <div className="text-xs">
                  {Number(odoInput) > editingVehicle.current_odometer_km ? (
                    <span className="text-olive-700 font-medium">
                      ↑ +{(Number(odoInput) - editingVehicle.current_odometer_km).toLocaleString('en-IN')} km driven since last recorded reading
                    </span>
                  ) : Number(odoInput) < editingVehicle.current_odometer_km ? (
                    <span className="text-amber-700 font-medium">
                      ⚠️ {(editingVehicle.current_odometer_km - Number(odoInput)).toLocaleString('en-IN')} km lower than recorded reading (odometer correction)
                    </span>
                  ) : (
                    <span className="text-ash-500">Matches current recorded reading</span>
                  )}
                </div>
              )}

              <Alert>{odoError}</Alert>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingVehicle
                    setEditingVehicle(null)
                    setSettingsVehicle(target)
                  }}
                  className="text-xs font-semibold text-olive-700 hover:text-olive-900 hover:underline"
                >
                  Edit all vehicle settings →
                </button>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditingVehicle(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={odoBusy || odoInput === ''}>
                    {odoBusy ? 'Saving…' : 'Save Reading'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {settingsVehicle && (
        <EditVehicleModal
          vehicle={settingsVehicle}
          onClose={() => setSettingsVehicle(null)}
          onSuccess={() => {
            reload()
            setNotice(`Vehicle ${settingsVehicle.registration_number} specifications and odometer updated successfully.`)
          }}
        />
      )}

      <PageHeader
        title="Fleet"
        subtitle={data ? `${rows.length} of ${data.length} vehicles` : ' '}
        action={<Link to="/vehicles/register"><Button>+ Register Vehicle</Button></Link>}
      />
      {notice && <div className="mb-4"><Alert type="success">{notice}</Alert></div>}
      <Alert>{error}</Alert>
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search plate, name, model…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">All units</option>
            {units.map((u) => <option key={u}>{u}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['Active', 'Under Maintenance', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        {loading ? <Loading /> : (
          <Table
            empty="No vehicles match. Register the first one."
            rows={rows}
            columns={[
              { header: 'Number plate', render: (v) => <Link to={`/vehicles/${v.id}`} className="plate font-medium text-olive-700 hover:underline">{v.registration_number}</Link> },
              { header: 'Vehicle', render: (v) => <div><div className="font-medium">{v.vehicle_name}</div><div className="text-xs text-ash-500">{v.manufacturer} {v.model}{v.manufacture_year ? ` · ${v.manufacture_year}` : ''}</div></div> },
              { header: 'Unit', key: 'unit_name' },
              {
                header: 'Odometer',
                render: (v) => (
                  <div className="flex items-center gap-2">
                    <span>{fmtKm(v.current_odometer_km)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVehicle(v)
                        setOdoInput(String(v.current_odometer_km))
                        setOdoError('')
                      }}
                      className="text-xs font-semibold text-olive-700 hover:text-olive-900 hover:underline"
                      title="Update odometer reading"
                    >
                      Edit
                    </button>
                  </div>
                ),
              },
              { header: 'Last service', render: (v) => fmtDate(v.last_service_date) },
              { header: 'Next due', render: (v) => fmtDate(v.next_service_due_date) },
              { header: 'Status', render: (v) => <Badge tone={statusTone(v.status)}>{v.status}</Badge> },
              {
                header: 'Actions',
                render: (v) => (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => setSettingsVehicle(v)}
                      className="!px-2.5 !py-1 text-xs"
                      title="Edit vehicle settings & odometer"
                    >
                      Edit
                    </Button>
                    <Link to={`/vehicles/${v.id}`}>
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1 text-xs !text-olive-700 hover:!bg-olive-50"
                        title="View vehicle dashboard"
                      >
                        View →
                      </Button>
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  )
}
