import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import { Alert, Badge, Button, Card, Input, Loading, Select, Table, fmtDate, fmtKm, statusTone, useLoad } from '../components/ui.jsx'

export default function Vehicles() {
  const { data, error, loading } = useLoad(api.listVehicles)
  const [q, setQ] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState('')

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

  return (
    <>
      <PageHeader
        title="Fleet"
        subtitle={data ? `${rows.length} of ${data.length} vehicles` : ' '}
        action={<Link to="/vehicles/register"><Button>+ Register Vehicle</Button></Link>}
      />
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
              { header: 'Odometer', render: (v) => fmtKm(v.current_odometer_km) },
              { header: 'Last service', render: (v) => fmtDate(v.last_service_date) },
              { header: 'Next due', render: (v) => fmtDate(v.next_service_due_date) },
              { header: 'Status', render: (v) => <Badge tone={statusTone(v.status)}>{v.status}</Badge> },
            ]}
          />
        )}
      </Card>
    </>
  )
}
