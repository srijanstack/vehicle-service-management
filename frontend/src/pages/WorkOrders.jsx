import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import { Alert, Badge, Button, Card, Field, Input, Loading, Select, Table, Textarea, fmtDate, statusTone, today, useLoad } from '../components/ui.jsx'

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled']

export default function WorkOrders() {
  const { data, error, loading, reload } = useLoad(() =>
    Promise.all([api.listWorkOrders(), api.listVehicles()]).then(([orders, vehicles]) => ({ orders, vehicles })),
  )
  const [section, setSection] = useState('pending') // 'pending' | 'completed'
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  // Edit/resolve modal state
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
  const [modalErr, setModalErr] = useState('')

  const byId = useMemo(() => Object.fromEntries((data?.vehicles || []).map((v) => [v.id, v])), [data])

  const allOrders = data?.orders || []
  const pendingOrders = useMemo(
    () => allOrders.filter((o) => o.status === 'Pending' || o.status === 'In Progress'),
    [allOrders]
  )
  const completedOrders = useMemo(
    () => allOrders.filter((o) => o.status === 'Completed' || o.status === 'Cancelled'),
    [allOrders]
  )

  const activeList = section === 'pending' ? pendingOrders : completedOrders
  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return activeList
    return activeList.filter((o) => {
      const plate = byId[o.vehicle_id]?.registration_number || ''
      return (
        plate.toLowerCase().includes(s) ||
        o.component_name?.toLowerCase().includes(s) ||
        o.issue_description?.toLowerCase().includes(s) ||
        o.assigned_to?.toLowerCase().includes(s)
      )
    })
  }, [activeList, q, byId])

  async function setStatus(o, status) {
    setErr('')
    try {
      await api.updateWorkOrder(o.id, {
        status,
        ...(status === 'Completed' && !o.completion_date ? { completion_date: today() } : {}),
      })
      setNotice(`Work order #${o.id} status changed to ${status}.`)
      reload()
    } catch (e) {
      setErr(e.message)
    }
  }

  const openEditModal = (o) => {
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
    setModalErr('')
  }

  async function submitModalUpdate(e) {
    e.preventDefault()
    if (!editingOrder) return
    setOrderBusy(true)
    setModalErr('')
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
      setNotice(`Work order #${editingOrder.id} updated successfully.`)
      reload()
    } catch (e) {
      setModalErr(e.message)
    } finally {
      setOrderBusy(false)
    }
  }

  async function deleteOrder(o) {
    if (!window.confirm(`Delete Work Order #${o.id} (${o.component_name})? This action cannot be undone.`)) return
    try {
      await api.deleteWorkOrder(o.id)
      setNotice(`Work order #${o.id} deleted successfully.`)
      if (editingOrder?.id === o.id) setEditingOrder(null)
      reload()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <>
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-ash-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ash-900">Update Work Order #{editingOrder.id}</h3>
                <p className="text-xs text-ash-500 mt-0.5">
                  {byId[editingOrder.vehicle_id]?.registration_number} · {editingOrder.component_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-ash-400 hover:text-ash-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitModalUpdate} className="space-y-4">
              <Field label="Issue Description" required>
                <Textarea
                  value={orderFields.issue_description}
                  onChange={(e) => setOrderFields((s) => ({ ...s, issue_description: e.target.value }))}
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
                  placeholder="Describe repair, part replacement, or test performed…"
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

              <Alert>{modalErr}</Alert>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => deleteOrder(editingOrder)}
                  className="!text-red-700 hover:!bg-red-50 hover:!border-red-300"
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

      <PageHeader
        title="Work Orders"
        subtitle="Manage pending repairs and track completed maintenance tasks across the fleet."
      />
      {notice && <div className="mb-4"><Alert type="success">{notice}</Alert></div>}
      <Alert>{error || err}</Alert>

      {/* Two section selector buttons with Work Pending count/badge */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-ash-200 pb-3">
        <button
          type="button"
          onClick={() => setSection('pending')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            section === 'pending'
              ? 'bg-olive-800 text-white shadow-sm'
              : 'border border-ash-300 bg-white text-ash-700 hover:bg-ash-100'
          }`}
        >
          <span>Work Pending</span>
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
              section === 'pending'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {pendingOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSection('completed')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            section === 'completed'
              ? 'bg-olive-800 text-white shadow-sm'
              : 'border border-ash-300 bg-white text-ash-700 hover:bg-ash-100'
          }`}
        >
          <span>Completed Work</span>
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
              section === 'completed'
                ? 'bg-olive-600 text-white'
                : 'bg-ash-200 text-ash-700'
            }`}
          >
            {completedOrders.length}
          </span>
        </button>
      </div>

      <Card
        title={
          <div className="flex items-center gap-2.5">
            <span>{section === 'pending' ? 'Pending Work Orders' : 'Completed Work Orders'}</span>
            <Badge tone={section === 'pending' ? 'amber' : 'green'}>
              {section === 'pending' ? `${pendingOrders.length} Pending` : `${completedOrders.length} Resolved`}
            </Badge>
          </div>
        }
        action={
          <Input
            placeholder="Search work orders…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!w-64 !py-1 text-xs"
          />
        }
      >
        {loading ? (
          <Loading />
        ) : (
          <Table
            rows={filteredRows}
            empty={
              section === 'pending'
                ? 'No pending work orders. All fleet tasks are currently resolved!'
                : 'No completed work orders yet.'
            }
            columns={[
              {
                header: 'Vehicle',
                render: (o) => (
                  <Link
                    className="plate text-olive-700 hover:underline"
                    to={`/vehicles/${o.vehicle_id}`}
                  >
                    {byId[o.vehicle_id]?.registration_number ?? `#${o.vehicle_id}`}
                  </Link>
                ),
              },
              { header: 'Component', key: 'component_name' },
              { header: 'Issue', key: 'issue_description' },
              {
                header: 'Priority',
                render: (o) => <Badge tone={statusTone(o.priority)}>{o.priority}</Badge>,
              },
              { header: 'Due', render: (o) => fmtDate(o.due_date) },
              {
                header: 'Status',
                render: (o) => (
                  <Select
                    value={o.status}
                    onChange={(e) => setStatus(o, e.target.value)}
                    className="!w-32 !py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                ),
              },
              { header: 'Assigned', key: 'assigned_to' },
              {
                header: 'Resolution',
                render: (o) =>
                  o.status === 'Completed' ? (
                    <div>
                      <span className="text-xs font-semibold text-olive-800">
                        Done {fmtDate(o.completion_date)}
                      </span>
                      {o.action_taken && (
                        <div className="text-xs text-ash-600 line-clamp-2 mt-0.5">
                          {o.action_taken}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-ash-400">In queue</span>
                  ),
              },
              {
                header: 'Actions',
                render: (o) => (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => openEditModal(o)}
                      className="!px-2.5 !py-1 text-xs"
                      title="Edit work order details"
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={() => deleteOrder(o)}
                      className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 hover:border-red-400"
                      title="Delete work order"
                    >
                      Delete
                    </button>
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

