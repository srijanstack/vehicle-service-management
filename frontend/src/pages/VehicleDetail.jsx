import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import RecordForm from '../components/RecordForm.jsx'
import EditVehicleModal from '../components/EditVehicleModal.jsx'
import { Alert, Badge, Button, Card, Field, Input, Loading, Select, Table, Textarea, fmtDate, fmtKm, fmtMoney, statusTone, today, useLoad } from '../components/ui.jsx'
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
  const wo = useLoad(() => api.listWorkOrders(id), [id])
  const check = useLoad(() => api.checkMaintenance(id), [id, vehicle.data?.current_odometer_km])

  // ── Multi-component service form state (must be before any early return) ──
  const [svcFields, setSvcFields] = useState({
    service_date: today(),
    odometer_km: '0',
    service_type: '',
    work_description: '',
    parts_replaced: '',
    performed_by: '',
    parts_cost: '0',
    labour_cost: '0',
    remarks: '',
  })
  const [selectedComps, setSelectedComps] = useState([])
  const [compSearch, setCompSearch] = useState('')
  const [svcBusy, setSvcBusy] = useState(false)
  const [svcError, setSvcError] = useState('')

  // ── Vehicle settings modal state ──
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false)

  // ── Odometer update modal state ──
  const [showOdoModal, setShowOdoModal] = useState(false)
  const [newOdo, setNewOdo] = useState('')
  const [odoBusy, setOdoBusy] = useState(false)
  const [odoError, setOdoError] = useState('')

  // ── Work order state: section ('pending' | 'completed') and edit/resolve modal ──
  const [woSection, setWoSection] = useState('pending')
  const [editingOrder, setEditingOrder] = useState(null)
  const [orderFields, setOrderFields] = useState({
    status: 'Pending',
    priority: 'Medium',
    issue_description: '',
    action_taken: '',
    completion_date: today(),
    assigned_to: '',
    remarks: '',
  })
  const [orderBusy, setOrderBusy] = useState(false)
  const [orderError, setOrderError] = useState('')

  // Sync odometer default once vehicle data arrives
  useEffect(() => {
    if (vehicle.data?.current_odometer_km != null) {
      setSvcFields((s) => ({ ...s, odometer_km: String(vehicle.data.current_odometer_km) }))
    }
  }, [vehicle.data?.current_odometer_km])

  if (vehicle.loading) return <Loading />
  if (vehicle.error) return <Alert>{vehicle.error}</Alert>
  const v = vehicle.data

  const openOdometerModal = () => {
    setNewOdo(v?.current_odometer_km != null ? String(v.current_odometer_km) : '')
    setOdoError('')
    setShowOdoModal(true)
  }

  async function submitOdometer(e) {
    e.preventDefault()
    const val = Number(newOdo)
    if (isNaN(val) || val < 0) {
      setOdoError('Please enter a valid kilometre reading (0 or higher).')
      return
    }
    setOdoBusy(true)
    setOdoError('')
    try {
      await api.updateVehicleOdometer(id, val)
      setShowOdoModal(false)
      setNotice(`Odometer updated to ${fmtKm(val)}. Maintenance status refreshed.`)
      vehicle.reload()
      check.reload()
      setSvcFields((s) => ({ ...s, odometer_km: String(val) }))
    } catch (err) {
      setOdoError(err.message)
    } finally {
      setOdoBusy(false)
    }
  }

  const handleVehicleUpdated = (updated) => {
    vehicle.reload()
    check.reload()
    setNotice(`Vehicle specifications, settings, and odometer updated successfully.`)
  }

  const openEditOrder = (o) => {
    setEditingOrder(o)
    setOrderFields({
      status: o.status || 'Pending',
      priority: o.priority || 'Medium',
      issue_description: o.issue_description || '',
      action_taken: o.action_taken || '',
      completion_date: o.completion_date || today(),
      assigned_to: o.assigned_to || '',
      remarks: o.remarks || '',
    })
    setOrderError('')
  }

  async function quickSetOrderStatus(o, newStatus) {
    try {
      await api.updateWorkOrder(o.id, {
        status: newStatus,
        ...(newStatus === 'Completed' && !o.completion_date ? { completion_date: today() } : {}),
      })
      wo.reload()
      check.reload()
      vehicle.reload()
      setNotice(`Work order #${o.id} status updated to ${newStatus}.`)
    } catch (e) {
      setNotice('')
      alert(e.message)
    }
  }

  async function submitWorkOrderUpdate(e) {
    e.preventDefault()
    if (!editingOrder) return
    setOrderBusy(true)
    setOrderError('')
    try {
      await api.updateWorkOrder(editingOrder.id, {
        status: orderFields.status,
        priority: orderFields.priority,
        issue_description: orderFields.issue_description,
        action_taken: orderFields.action_taken || undefined,
        completion_date: orderFields.status === 'Completed' ? orderFields.completion_date || today() : undefined,
        assigned_to: orderFields.assigned_to || undefined,
        remarks: orderFields.remarks || undefined,
      })
      setEditingOrder(null)
      wo.reload()
      check.reload()
      vehicle.reload()
      setNotice(`Work order #${editingOrder.id} updated successfully.`)
    } catch (err) {
      setOrderError(err.message)
    } finally {
      setOrderBusy(false)
    }
  }

  async function deleteWorkOrder(o) {
    if (!window.confirm(`Delete Work Order #${o.id} (${o.component_name})? This action cannot be undone.`)) return
    try {
      await api.deleteWorkOrder(o.id)
      setNotice(`Work order #${o.id} deleted successfully.`)
      if (editingOrder?.id === o.id) setEditingOrder(null)
      wo.reload()
      check.reload()
      vehicle.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const vid = Number(id)
  const comp = { name: 'component_name', label: 'Component', required: true, list: 'components' }
  const forms = {
    service: {
      title: 'Log service',
      reload: () => { svc.reload(); vehicle.reload(); check.reload() },
    },
    orders: {
      title: 'Create work order', reload: wo.reload,
      submit: async (d) => {
        await api.createWorkOrder({ ...d, vehicle_id: vid })
        return 'Work order created successfully.'
      },
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

  const allVehicleOrders = wo.data || []
  const pendingOrders = allVehicleOrders.filter((o) => o.status === 'Pending' || o.status === 'In Progress')
  const completedOrders = allVehicleOrders.filter((o) => o.status === 'Completed' || o.status === 'Cancelled')

  const tabs = [
    ['check', 'Maintenance Check'],
    ['service', 'Service Records'],
    ['orders', 'Work Orders'],
  ]
  const switchTab = (t) => { setTab(t); setShowForm(false) }

  const dueComps = (check.data?.maintenance_checks || [])
    .filter((c) => c.maintenance_due)
    .map((c) => c.component || c.component_name)

  const componentOptions = Array.from(new Set([
    ...(check.data?.maintenance_checks || []).map((c) => c.component || c.component_name),
    ...STANDARD_COMPONENTS,
  ]))

  const setSvc = (k) => (e) => setSvcFields((s) => ({ ...s, [k]: e.target.value }))
  const toggleComp = (c) => setSelectedComps((prev) =>
    prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
  )
  const filteredComps = componentOptions.filter((c) =>
    c.toLowerCase().includes(compSearch.toLowerCase())
  )

  async function submitMultiService(e) {
    e.preventDefault()
    if (selectedComps.length === 0) { setSvcError('Select at least one component.'); return }
    if (!svcFields.service_type.trim()) { setSvcError('Service type is required.'); return }
    if (!svcFields.work_description.trim()) { setSvcError('Work description is required.'); return }
    setSvcBusy(true)
    setSvcError('')
    try {
      await Promise.all(
        selectedComps.map((comp) =>
          api.createServiceRecord({
            vehicle_id: vid,
            service_date: svcFields.service_date,
            odometer_km: Number(svcFields.odometer_km),
            component_name: comp,
            service_type: svcFields.service_type,
            work_description: svcFields.work_description,
            parts_replaced: svcFields.parts_replaced || undefined,
            performed_by: svcFields.performed_by || undefined,
            parts_cost: Number(svcFields.parts_cost) || 0,
            labour_cost: Number(svcFields.labour_cost) || 0,
            remarks: svcFields.remarks || undefined,
          })
        )
      )
      forms.service.reload()
      setShowForm(false)
      setSelectedComps([])
      setCompSearch('')
      setNotice(`${selectedComps.length} service record${selectedComps.length > 1 ? 's' : ''} saved.`)
    } catch (err) {
      setSvcError(err.message)
    } finally {
      setSvcBusy(false)
    }
  }

  return (
    <>
      <datalist id="components">{componentOptions.map((c) => <option key={c} value={c} />)}</datalist>
      {showOdoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-ash-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ash-900">Update Odometer</h3>
              <button
                type="button"
                onClick={() => setShowOdoModal(false)}
                className="text-ash-400 hover:text-ash-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitOdometer} className="space-y-4">
              <div className="rounded-md bg-ash-50 p-3 text-xs text-ash-600">
                <span className="font-medium text-ash-800">{v.registration_number}</span> · {v.vehicle_name}
                <div className="mt-1">Current recorded reading: <strong className="text-ash-900">{fmtKm(v.current_odometer_km)}</strong></div>
              </div>

              <Field label="New Odometer Reading (km)" required>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  autoFocus
                  value={newOdo}
                  onChange={(e) => { setNewOdo(e.target.value); setOdoError('') }}
                  placeholder="Enter total km driven"
                  required
                />
              </Field>

              {newOdo !== '' && !isNaN(Number(newOdo)) && (
                <div className="text-xs">
                  {Number(newOdo) > v.current_odometer_km ? (
                    <span className="text-olive-700 font-medium">
                      ↑ +{(Number(newOdo) - v.current_odometer_km).toLocaleString('en-IN')} km driven since last recorded reading
                    </span>
                  ) : Number(newOdo) < v.current_odometer_km ? (
                    <span className="text-amber-700 font-medium">
                      ⚠️ {(v.current_odometer_km - Number(newOdo)).toLocaleString('en-IN')} km lower than recorded reading (odometer correction)
                    </span>
                  ) : (
                    <span className="text-ash-500">Matches current recorded reading</span>
                  )}
                </div>
              )}

              <Alert>{odoError}</Alert>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowOdoModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={odoBusy || newOdo === ''}>
                  {odoBusy ? 'Saving…' : 'Save Reading'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Work Order Modal ── */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-ash-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ash-900">Update Work Order #{editingOrder.id}</h3>
                <p className="text-xs text-ash-500 mt-0.5">{editingOrder.component_name} · {v.registration_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-ash-400 hover:text-ash-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitWorkOrderUpdate} className="space-y-4">
              <Field label="Issue Description" required>
                <Textarea
                  value={orderFields.issue_description}
                  onChange={(e) => setOrderFields((s) => ({ ...s, issue_description: e.target.value }))}
                  placeholder="Describe the issue / component defect…"
                  rows={2}
                  required
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status" required>
                  <Select
                    value={orderFields.status}
                    onChange={(e) => setOrderFields((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </Select>
                </Field>

                <Field label="Priority" required>
                  <Select
                    value={orderFields.priority}
                    onChange={(e) => setOrderFields((s) => ({ ...s, priority: e.target.value }))}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </Select>
                </Field>
              </div>

              {orderFields.status === 'Completed' && (
                <Field label="Completion Date" required>
                  <Input
                    type="date"
                    value={orderFields.completion_date}
                    onChange={(e) => setOrderFields((s) => ({ ...s, completion_date: e.target.value }))}
                    required
                  />
                </Field>
              )}

              <Field label="Assigned Technician">
                <Input
                  value={orderFields.assigned_to}
                  onChange={(e) => setOrderFields((s) => ({ ...s, assigned_to: e.target.value }))}
                  placeholder="Technician or team name"
                />
              </Field>

              <Field label="Action Taken / Work Performed">
                <Textarea
                  value={orderFields.action_taken}
                  onChange={(e) => setOrderFields((s) => ({ ...s, action_taken: e.target.value }))}
                  placeholder="Describe repair, part replacement, or tests performed…"
                  rows={3}
                />
              </Field>

              <Field label="Remarks">
                <Input
                  value={orderFields.remarks}
                  onChange={(e) => setOrderFields((s) => ({ ...s, remarks: e.target.value }))}
                  placeholder="Any additional notes…"
                />
              </Field>

              <Alert>{orderError}</Alert>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => deleteWorkOrder(editingOrder)}
                  className="!text-red-700 hover:!bg-red-50 hover:!border-red-300"
                  disabled={orderBusy}
                >
                  Delete Work Order
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditingOrder(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={orderBusy}>
                    {orderBusy ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Vehicle Settings & Odometer Modal ── */}
      {showEditVehicleModal && (
        <EditVehicleModal
          vehicle={v}
          onClose={() => setShowEditVehicleModal(false)}
          onSuccess={handleVehicleUpdated}
        />
      )}

      <PageHeader
        title={<span className="plate">{v.registration_number}</span>}
        subtitle={`${v.vehicle_name} — ${v.manufacturer} ${v.model}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => setShowEditVehicleModal(true)}>
              Edit Vehicle Settings
            </Button>
            <Button variant="secondary" onClick={openOdometerModal}>Update Km</Button>
            <Link to="/vehicles"><Button variant="secondary">← Fleet</Button></Link>
          </div>
        }
      />
      {notice && <div className="mb-4"><Alert type="success">{notice}</Alert></div>}

      <Card
        className="mb-6"
        title="Vehicle Specifications & Status"
        action={
          <Button
            variant="secondary"
            onClick={() => setShowEditVehicleModal(true)}
            className="!px-3 !py-1 text-xs"
          >
            Edit Settings & Km
          </Button>
        }
      >
        <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Info label="Unit">{v.unit_name}</Info>
          <Info label="Type">{v.vehicle_type}</Info>
          <Info label="Year">{v.manufacture_year}</Info>
          <Info label="Status"><Badge tone={statusTone(v.status)}>{v.status}</Badge></Info>
          <Info label="Odometer">
            <div className="flex items-center gap-2">
              <span>{fmtKm(v.current_odometer_km)}</span>
              <button
                type="button"
                onClick={() => setShowEditVehicleModal(true)}
                className="text-xs font-semibold text-olive-700 hover:text-olive-900 hover:underline"
                title="Update kilometers driven & vehicle settings"
              >
                Edit
              </button>
            </div>
          </Info>
          <Info label="Last service">{fmtDate(v.last_service_date)}</Info>
          <Info label="Next service due">{fmtDate(v.next_service_due_date)}</Info>
        </dl>
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ash-200">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === k
                ? 'border-olive-700 text-olive-800 font-semibold'
                : 'border-transparent text-ash-500 hover:text-ash-800'
            }`}
          >
            <span>{label}</span>
            {k === 'orders' && pendingOrders.length > 0 && (
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                  tab === 'orders'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {pendingOrders.length}
              </span>
            )}
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
        {/* ── Multi-component service form ── */}
        {tab === 'service' && showForm && (
          <form onSubmit={submitMultiService} className="mb-6 rounded-lg border border-olive-200 bg-olive-50/40 p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-olive-800">Log Service</h3>

            {/* Component picker */}
            <div className="mb-5">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ash-600">
                Components serviced <span className="text-olive-500">*</span>
              </span>
              {selectedComps.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedComps.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-olive-700 px-3 py-0.5 text-xs font-medium text-white">
                      {c}
                      <button type="button" onClick={() => toggleComp(c)} className="ml-0.5 hover:text-olive-200" aria-label={`Remove ${c}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                placeholder="Search components…"
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                className="mb-2 w-full rounded-md border border-ash-300 bg-white px-3 py-2 text-sm text-ash-800 placeholder:text-ash-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-500/20"
              />
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-ash-500">
                  {selectedComps.length === 0 ? 'No components selected' : `${selectedComps.length} selected`}
                </span>
                <div className="flex gap-3">
                  {dueComps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedComps(Array.from(new Set([...selectedComps, ...dueComps])))}
                      className="font-medium text-olive-700 hover:underline"
                    >
                      + Select due ({dueComps.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedComps(Array.from(new Set([...selectedComps, ...filteredComps])))}
                    className="text-ash-600 hover:underline"
                  >
                    Select all filtered
                  </button>
                  {selectedComps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedComps([])}
                      className="text-ash-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border border-ash-200 bg-white">
                {filteredComps.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-ash-400">No components found.</p>
                ) : (
                  filteredComps.map((c) => {
                    const checked = selectedComps.includes(c)
                    return (
                      <label
                        key={c}
                        className={`flex cursor-pointer items-center gap-3 border-b border-ash-100 px-3 py-2 text-sm last:border-0 hover:bg-ash-50 ${
                          checked ? 'bg-olive-50 font-medium text-olive-900' : 'text-ash-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleComp(c)}
                          className="h-4 w-4 rounded border-ash-300 accent-olive-700"
                        />
                        {c}
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            {/* Shared fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service date" required>
                <Input type="date" value={svcFields.service_date} onChange={setSvc('service_date')} required />
              </Field>
              <Field label="Odometer (km)" required>
                <Input type="number" min={0} value={svcFields.odometer_km} onChange={setSvc('odometer_km')} required />
              </Field>
              <Field label="Service type" required>
                <Input value={svcFields.service_type} onChange={setSvc('service_type')} placeholder="e.g. Replacement, Routine" required />
              </Field>
              <Field label="Performed by">
                <Input value={svcFields.performed_by} onChange={setSvc('performed_by')} placeholder="Technician name" />
              </Field>
              <Field label="Work description" required className="sm:col-span-2">
                <Textarea value={svcFields.work_description} onChange={setSvc('work_description')} placeholder="Describe what was done…" required />
              </Field>
              <Field label="Parts replaced" className="sm:col-span-2">
                <Input value={svcFields.parts_replaced} onChange={setSvc('parts_replaced')} placeholder="e.g. Oil filter, brake pads" />
              </Field>
              <Field label="Parts cost (₹)">
                <Input type="number" min={0} value={svcFields.parts_cost} onChange={setSvc('parts_cost')} />
              </Field>
              <Field label="Labour cost (₹)">
                <Input type="number" min={0} value={svcFields.labour_cost} onChange={setSvc('labour_cost')} />
              </Field>
              <Field label="Remarks" className="sm:col-span-2">
                <Textarea value={svcFields.remarks} onChange={setSvc('remarks')} placeholder="Any additional notes…" />
              </Field>
            </div>

            <div className="mt-5 space-y-3">
              <Alert>{svcError}</Alert>
              <div className="flex gap-3">
                <Button type="submit" disabled={svcBusy}>
                  {svcBusy ? 'Saving…' : `Save ${selectedComps.length > 0 ? `(${selectedComps.length} component${selectedComps.length > 1 ? 's' : ''})` : ''}`}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setSvcError('') }}>Cancel</Button>
              </div>
            </div>
          </form>
        )}

        {/* other tab forms (work orders) */}
        {tab !== 'service' && form && showForm && (
          <RecordForm
            key={tab}
            fields={form.fields}
            submitLabel="Save"
            onCancel={() => setShowForm(false)}
            onSubmit={async (d) => {
              const msg = await form.submit(d)
              form.reload()
              setShowForm(false)
              setNotice(typeof msg === 'string' ? msg : 'Record saved.')
            }}
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
        {tab === 'orders' && (
          <div className="space-y-4">
            {/* Two section tabs: Work Pending & Completed Work with pending count badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWoSection('pending')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    woSection === 'pending'
                      ? 'bg-olive-800 text-white shadow-sm'
                      : 'border border-ash-300 bg-white text-ash-700 hover:bg-ash-100'
                  }`}
                >
                  <span>Work Pending</span>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      woSection === 'pending'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {pendingOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWoSection('completed')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    woSection === 'completed'
                      ? 'bg-olive-800 text-white shadow-sm'
                      : 'border border-ash-300 bg-white text-ash-700 hover:bg-ash-100'
                  }`}
                >
                  <span>Completed Work</span>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      woSection === 'completed'
                        ? 'bg-olive-600 text-white'
                        : 'bg-ash-200 text-ash-700'
                    }`}
                  >
                    {completedOrders.length}
                  </span>
                </button>
              </div>

              <div className="text-xs text-ash-500">
                {woSection === 'pending'
                  ? `${pendingOrders.length} pending / in-progress work order${pendingOrders.length !== 1 ? 's' : ''}`
                  : `${completedOrders.length} resolved / cancelled work order${completedOrders.length !== 1 ? 's' : ''}`}
              </div>
            </div>

            {wo.error ? (
              <Alert>{wo.error}</Alert>
            ) : wo.loading ? (
              <Loading />
            ) : (
              <Table
                rows={woSection === 'pending' ? pendingOrders : completedOrders}
                empty={
                  woSection === 'pending'
                    ? 'No pending work orders for this vehicle.'
                    : 'No completed work orders recorded for this vehicle.'
                }
                columns={[
                  { header: 'Component', key: 'component_name' },
                  { header: 'Issue', key: 'issue_description' },
                  { header: 'Priority', render: (r) => <Badge tone={statusTone(r.priority)}>{r.priority}</Badge> },
                  {
                    header: 'Status',
                    render: (r) => (
                      <Select
                        value={r.status}
                        onChange={(e) => quickSetOrderStatus(r, e.target.value)}
                        className="!w-32 !py-1 text-xs"
                      >
                        {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </Select>
                    )
                  },
                  { header: 'Due', render: (r) => fmtDate(r.due_date) },
                  { header: 'Assigned', render: (r) => r.assigned_to || <span className="text-ash-400">Unassigned</span> },
                  {
                    header: 'Resolution',
                    render: (r) => r.status === 'Completed' ? (
                      <div>
                        <span className="text-xs font-semibold text-olive-800">Done {fmtDate(r.completion_date)}</span>
                        {r.action_taken && <div className="text-xs text-ash-600 line-clamp-2 mt-0.5">{r.action_taken}</div>}
                      </div>
                    ) : '—'
                  },
                  {
                    header: 'Actions',
                    render: (r) => (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => openEditOrder(r)}
                          className="!px-2.5 !py-1 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteWorkOrder(r)}
                          className="!px-2.5 !py-1 text-xs !text-red-700 hover:!bg-red-50 hover:!border-red-300"
                        >
                          Delete
                        </Button>
                      </div>
                    )
                  },
                ]}
              />
            )}
          </div>
        )}
      </Card>
    </>
  )
}
