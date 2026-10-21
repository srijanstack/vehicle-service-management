import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import { Alert, Badge, Button, Card, Loading, Select, Table, fmtDate, statusTone, today, useLoad } from '../components/ui.jsx'

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled']

export default function WorkOrders() {
  const { data, error, loading, reload } = useLoad(() =>
    Promise.all([api.listWorkOrders(), api.listVehicles()]).then(([orders, vehicles]) => ({ orders, vehicles })),
  )
  const [filter, setFilter] = useState('')
  const [err, setErr] = useState('')
  const byId = useMemo(() => Object.fromEntries((data?.vehicles || []).map((v) => [v.id, v])), [data])

  async function setStatus(o, status) {
    setErr('')
    try {
      await api.updateWorkOrder(o.id, { status, ...(status === 'Completed' ? { completion_date: today() } : {}) })
      reload()
    } catch (e) { setErr(e.message) }
  }

  const rows = (data?.orders || []).filter((o) => !filter || o.status === filter)
  return (
    <>
      <PageHeader title="Work Orders" subtitle="Repair and maintenance tasks across the fleet." />
      <Alert>{error || err}</Alert>
      <Card action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-44">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>}>
        {loading ? <Loading /> : (
          <Table rows={rows} empty="No work orders." columns={[
            { header: 'Vehicle', render: (o) => <Link className="plate text-olive-700 hover:underline" to={`/vehicles/${o.vehicle_id}`}>{byId[o.vehicle_id]?.registration_number ?? `#${o.vehicle_id}`}</Link> },
            { header: 'Component', key: 'component_name' },
            { header: 'Issue', key: 'issue_description' },
            { header: 'Priority', render: (o) => <Badge tone={statusTone(o.priority)}>{o.priority}</Badge> },
            { header: 'Due', render: (o) => fmtDate(o.due_date) },
            { header: 'Status', render: (o) => (
              <Select value={o.status} onChange={(e) => setStatus(o, e.target.value)} className="!w-36 !py-1">
                {[...new Set([o.status, ...STATUSES])].map((s) => <option key={s}>{s}</option>)}
              </Select>) },
          ]} />
        )}
      </Card>
    </>
  )
}
