import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import RecordForm from '../components/RecordForm.jsx'
import { Alert, Badge, Button, Card, Loading, Table, fmtDate, fmtKm, fmtMoney, statusTone, today, useLoad } from '../components/ui.jsx'
import { STANDARD_COMPONENTS } from '../constants.js'

const Info = ({ label, children }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-ash-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-ash-800">{children || '—'}</dd>
  </div>
)

export default function VehicleDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const vehicle = useLoad(() => api.getVehicle(id), [id])
  const [tab, setTab] = useState('check')
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState(state?.registered ? 'Vehicle registered successfully.' : '')

  const svc = useLoad(() => api.listServiceRecords(id), [id])
  const insp = useLoad(() => api.listInspections(id), [id])
  const wo = useLoad(() => api.listWorkOrders(id), [id])
  const check = useLoad(() => api.checkMaintenance(id), [id, vehicle.data?.current_odometer_km])

  if (vehicle.loading) return <Loading />
  if (vehicle.error) return <Alert>{vehicle.error}</Alert>
  const v = vehicle.data

  const vid = Number(id)
  const comp = { name: 'component_name', label: 'Component', required: true, list: 'components' }
  const forms = {
    service: {
      title: 'Add service record', reload: () => { svc.reload(); vehicle.reload(); check.reload() },
      submit: (d) => api.createServiceRecord({ ...d, vehicle_id: vid }),
      fields: [
        { name: 'service_date', label: 'Service date', type: 'date', required: true, default: today() },
        { name: 'odometer_km', label: 'Odometer (km)', type: 'number', required: true, default: v.current_odometer_km },
        comp,
        { name: 'service_type', label: 'Service type', required: true, placeholder: 'e.g. Replacement, Routine' },
        { name: 'work_description', label: 'Work description', type: 'textarea', required: true },
        { name: 'parts_replaced', label: 'Parts replaced' },
        { name: 'performed_by', label: 'Performed by' },
        { name: 'parts_cost', label: 'Parts cost (₹)', type: 'number', default: 0 },
        { name: 'labour_cost', label: 'Labour cost (₹)', type: 'number', default: 0 },
        { name: 'remarks', label: 'Remarks', span2: true },
      ],
    },
    inspection: {
      title: 'Add inspection', reload: insp.reload,
      submit: (d) => api.createInspection({ ...d, vehicle_id: vid }),
      fields: [
        { name: 'inspection_date', label: 'Inspection date', type: 'date', required: true, default: today() },
        comp,
        { name: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Poor', 'Critical'], default: 'Good', required: true },
        { name: 'inspection_decision', label: 'Decision', type: 'select', options: ['Pass', 'Monitor', 'Service Required', 'Fail'], default: 'Pass', required: true },
        { name: 'defect_description', label: 'Defect description', type: 'textarea' },
        { name: 'recommended_action', label: 'Recommended action' },
        { name: 'inspected_by', label: 'Inspected by' },
      ],
    },
    orders: {
      title: 'Create work order', reload: wo.reload,
      submit: (d) => api.createWorkOrder({ ...d, vehicle_id: vid }),
      fields: [
        comp,
        { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
        { name: 'issue_description', label: 'Issue description', type: 'textarea', required: true },
        { name: 'due_date', label: 'Due date', type: 'date' },
        { name: 'assigned_to', label: 'Assigned to' },
        { name: 'remarks', label: 'Remarks', span2: true },
      ],
    },
  }
  const form = forms[tab]

  async function generate() {
    try {
      const r = await api.generateWorkOrders(vid)
      setNotice(`${r.created_count} work order(s) created from due maintenance.`)
      wo.reload()
    } catch (e) { setNotice(''); check.reload(); alert(e.message) }
  }

  const tabs = [['check', 'Maintenance Check'], ['service', 'Service Records'], ['inspection', 'Inspections'], ['orders', 'Work Orders']]
  const switchTab = (t) => { setTab(t); setShowForm(false) }

  const componentOptions = Array.from(new Set([
    ...(check.data?.maintenance_checks || []).map((c) => c.component || c.component_name),
    ...STANDARD_COMPONENTS,
  ]))

  return (
    <>
      <datalist id="components">{componentOptions.map((c) => <option key={c} value={c} />)}</datalist>
      <PageHeader
        title={<span className="plate">{v.registration_number}</span>}
        subtitle={`${v.vehicle_name} — ${v.manufacturer} ${v.model}`}
        action={<Link to="/vehicles"><Button variant="secondary">← Fleet</Button></Link>}
      />
      {notice && <div className="mb-4"><Alert type="success">{notice}</Alert></div>}

      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Info label="Unit">{v.unit_name}</Info>
          <Info label="Type">{v.vehicle_type}</Info>
          <Info label="Year">{v.manufacture_year}</Info>
          <Info label="Status"><Badge tone={statusTone(v.status)}>{v.status}</Badge></Info>
          <Info label="Odometer">{fmtKm(v.current_odometer_km)}</Info>
          <Info label="Last service">{fmtDate(v.last_service_date)}</Info>
          <Info label="Next service due">{fmtDate(v.next_service_due_date)}</Info>
        </dl>
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ash-200">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => switchTab(k)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-olive-700 text-olive-800' : 'border-transparent text-ash-500 hover:text-ash-800'}`}>
            {label}
          </button>
        ))}
      </div>

      <Card
        action={
          tab === 'check' ? (
            <Button onClick={generate}>Generate work orders for due items</Button>
          ) : (
            <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : `+ ${form.title}`}</Button>
          )
        }
      >
        {form && showForm && (
          <RecordForm
            key={tab}
            fields={form.fields}
            submitLabel="Save"
            onCancel={() => setShowForm(false)}
            onSubmit={async (d) => { await form.submit(d); form.reload(); setShowForm(false); setNotice('Record saved.') }}
          />
        )}

        {tab === 'check' && (
          check.error ? <Alert>{check.error}</Alert> : check.loading ? <Loading /> : (
            <Table
              empty={`No active maintenance rules for model "${v.model}". Add some under Maintenance Rules (the model name must match exactly).`}
              rows={check.data.maintenance_checks}
              columns={[
                {
                  header: 'Component',
                  render: (r) => (
                    <div>
                      <div className="font-semibold text-ash-900">{r.component || r.component_name}</div>
                      {r.notes && <div className="text-xs text-ash-500 mt-0.5">{r.notes}</div>}
                    </div>
                  ),
                },
                { header: 'Task', key: 'service_task' },
                {
                  header: 'Suggested km interval',
                  render: (r) => (
                    <span className="inline-block rounded border border-olive-200 bg-olive-50 px-2 py-0.5 font-mono text-xs font-medium text-olive-800">
                      {r.suggested_km_interval || (r.interval_km ? `${r.interval_km.toLocaleString()} km` : '0 km')}
                    </span>
                  ),
                },
                {
                  header: 'Suggested time interval',
                  render: (r) => (
                    <span className="inline-block rounded bg-ash-100 px-2 py-0.5 font-mono text-xs font-medium text-ash-700">
                      {r.suggested_time_interval || (r.interval_months ? `${r.interval_months} months` : '—')}
                    </span>
                  ),
                },
                { header: 'Next due (km)', render: (r) => fmtKm(r.next_due_km) },
                { header: 'Next due (date)', render: (r) => fmtDate(r.next_due_date) },
                {
                  header: 'Status',
                  render: (r) =>
                    r.maintenance_due ? (
                      <div>
                        <Badge tone="red">Due</Badge>
                        <div className="mt-1 text-xs text-ash-500">{r.reasons.join(', ')}</div>
                      </div>
                    ) : r.next_due_km == null && r.next_due_date == null ? (
                      <Badge tone="gray">No service history</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    ),
                },
              ]}
            />
          )
        )}
        {tab === 'service' && (svc.error ? <Alert>{svc.error}</Alert> : svc.loading ? <Loading /> : (
          <Table rows={svc.data} empty="No service records yet." columns={[
            { header: 'Date', render: (r) => fmtDate(r.service_date) },
            { header: 'Odometer', render: (r) => fmtKm(r.odometer_km) },
            { header: 'Component', key: 'component_name' },
            { header: 'Type', key: 'service_type' },
            { header: 'Work', render: (r) => <div>{r.work_description}{r.parts_replaced && <div className="text-xs text-ash-500">Parts: {r.parts_replaced}</div>}</div> },
            { header: 'Cost', render: (r) => fmtMoney(r.parts_cost + r.labour_cost) },
            { header: 'By', key: 'performed_by' },
          ]} />
        ))}
        {tab === 'inspection' && (insp.error ? <Alert>{insp.error}</Alert> : insp.loading ? <Loading /> : (
          <Table rows={insp.data} empty="No inspections yet." columns={[
            { header: 'Date', render: (r) => fmtDate(r.inspection_date) },
            { header: 'Component', key: 'component_name' },
            { header: 'Condition', render: (r) => <Badge tone={statusTone(r.condition === 'Good' ? 'Pass' : r.condition === 'Critical' ? 'Fail' : 'Medium')}>{r.condition}</Badge> },
            { header: 'Decision', key: 'inspection_decision' },
            { header: 'Defect / action', render: (r) => <div>{r.defect_description}{r.recommended_action && <div className="text-xs text-ash-500">→ {r.recommended_action}</div>}</div> },
            { header: 'By', key: 'inspected_by' },
          ]} />
        ))}
        {tab === 'orders' && (wo.error ? <Alert>{wo.error}</Alert> : wo.loading ? <Loading /> : (
          <Table rows={wo.data} empty="No work orders yet." columns={[
            { header: 'Component', key: 'component_name' },
            { header: 'Issue', key: 'issue_description' },
            { header: 'Priority', render: (r) => <Badge tone={statusTone(r.priority)}>{r.priority}</Badge> },
            { header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            { header: 'Due', render: (r) => fmtDate(r.due_date) },
            { header: 'Assigned', key: 'assigned_to' },
          ]} />
        ))}
      </Card>
    </>
  )
}
