import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import { Alert, Badge, Button, Card, Loading, Table, fmtDate, statusTone, today, useLoad } from '../components/ui.jsx'

const Stat = ({ label, value, tone = 'text-olive-800' }) => (
  <div className="rounded-lg border border-ash-200 bg-white p-5 shadow-sm">
    <div className="text-xs font-semibold uppercase tracking-wide text-ash-500">{label}</div>
    <div className={`mt-2 text-3xl font-bold ${tone}`}>{value}</div>
  </div>
)

export default function Dashboard() {
  const { data, error, loading } = useLoad(() =>
    Promise.all([api.listVehicles(), api.listWorkOrders()]).then(([vehicles, orders]) => ({ vehicles, orders })),
  )
  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>

  const { vehicles, orders } = data
  const open = orders.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled')
  const overdueSvc = vehicles.filter((v) => v.next_service_due_date && v.next_service_due_date < today())
  const byId = Object.fromEntries(vehicles.map((v) => [v.id, v]))
  const unitCounts = Object.entries(
    vehicles.reduce((a, v) => ({ ...a, [v.unit_name || 'Unassigned']: (a[v.unit_name || 'Unassigned'] || 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Fleet readiness at a glance."
        action={<Link to="/vehicles/register"><Button>+ Register Vehicle</Button></Link>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total vehicles" value={vehicles.length} />
        <Stat label="Active" value={vehicles.filter((v) => v.status === 'Active').length} />
        <Stat label="Open work orders" value={open.length} tone={open.length ? 'text-amber-700' : 'text-olive-800'} />
        <Stat label="Service overdue" value={overdueSvc.length} tone={overdueSvc.length ? 'text-red-700' : 'text-olive-800'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Open work orders" className="lg:col-span-2" action={<Link to="/work-orders" className="text-sm text-olive-700 hover:underline">View all</Link>}>
          <Table
            empty="No open work orders."
            rows={open.slice(0, 6)}
            columns={[
              { header: 'Vehicle', render: (o) => <Link className="plate text-olive-700 hover:underline" to={`/vehicles/${o.vehicle_id}`}>{byId[o.vehicle_id]?.registration_number ?? `#${o.vehicle_id}`}</Link> },
              { header: 'Component', key: 'component_name' },
              { header: 'Priority', render: (o) => <Badge tone={statusTone(o.priority)}>{o.priority}</Badge> },
              { header: 'Due', render: (o) => fmtDate(o.due_date) },
            ]}
          />
        </Card>
        <Card title="Vehicles by unit">
          {unitCounts.length === 0 ? <p className="text-sm text-ash-500">No vehicles registered.</p> : (
            <ul className="space-y-3">
              {unitCounts.map(([u, n]) => (
                <li key={u}>
                  <div className="mb-1 flex justify-between text-sm"><span>{u}</span><span className="font-semibold">{n}</span></div>
                  <div className="h-2 rounded bg-ash-100"><div className="h-2 rounded bg-olive-600" style={{ width: `${(n / vehicles.length) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
