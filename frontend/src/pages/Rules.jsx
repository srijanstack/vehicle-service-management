import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { PageHeader } from '../components/Layout.jsx'
import RecordForm from '../components/RecordForm.jsx'
import { STANDARD_COMPONENTS } from '../constants.js'
import { Alert, Badge, Button, Card, Input, Loading, Select, Table, useLoad } from '../components/ui.jsx'

export default function Rules() {
  const { data, error, loading, reload } = useLoad(() =>
    Promise.all([api.listRules(), api.listVehicles()]).then(([rules, vehicles]) => ({ rules, vehicles })),
  )
  const [show, setShow] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const rawRules = data?.rules || []
  const models = useMemo(() => {
    const list = [
      ...new Set([
        ...rawRules.map((r) => r.vehicle_model),
        ...(data?.vehicles || []).map((v) => v.model),
      ]),
    ].filter(Boolean)
    return list.sort()
  }, [data, rawRules])

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rawRules.filter((r) => {
      const comp = (r.component || r.component_name || '').toLowerCase()
      const task = (r.service_task || '').toLowerCase()
      const notes = (r.notes || '').toLowerCase()
      const matchesSearch = !q || comp.includes(q) || task.includes(q) || notes.includes(q)
      const matchesModel = !modelFilter || r.vehicle_model === modelFilter
      const isInspection = r.inspection_required === 1
      const matchesType =
        !typeFilter ||
        (typeFilter === 'Inspection' && isInspection) ||
        (typeFilter === 'Service' && !isInspection)
      return matchesSearch && matchesModel && matchesType
    })
  }, [rawRules, search, modelFilter, typeFilter])

  const inspectionCount = rawRules.filter((r) => r.inspection_required === 1).length
  const serviceCount = rawRules.filter((r) => r.inspection_required !== 1).length

  return (
    <>
      <PageHeader
        title="Maintenance Rules"
        subtitle="Standard maintenance and inspection schedule matrix per vehicle model."
        action={<Button onClick={() => setShow((s) => !s)}>{show ? 'Close' : '+ Add rule'}</Button>}
      />
      <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="components">{STANDARD_COMPONENTS.map((c) => <option key={c} value={c} />)}</datalist>

      {notice && <div className="mb-4"><Alert type="success">{notice}</Alert></div>}
      <Alert>{error}</Alert>

      {/* Summary Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-ash-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-ash-500">Total Rules</div>
          <div className="mt-1 text-2xl font-bold text-olive-800">{rawRules.length}</div>
        </div>
        <div className="rounded-lg border border-ash-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-ash-500">Vehicle Models</div>
          <div className="mt-1 text-2xl font-bold text-ash-800">{models.length || 1}</div>
        </div>
        <div className="rounded-lg border border-ash-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-ash-500">Inspection Rules</div>
          <div className="mt-1 text-2xl font-bold text-olive-700">{inspectionCount}</div>
        </div>
        <div className="rounded-lg border border-ash-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-ash-500">Service / Replace</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{serviceCount}</div>
        </div>
      </div>

      <Card>
        {show && (
          <div className="mb-6 border-b border-ash-200 pb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-olive-800">New Maintenance Rule</h3>
            <RecordForm
              fields={[
                { name: 'vehicle_model', label: 'Vehicle model', required: true, list: 'models', placeholder: 'e.g. Scorpio', default: models[0] || 'Scorpio' },
                { name: 'component', label: 'Component', required: true, list: 'components', placeholder: 'e.g. Engine Oil, Front Brake Pads' },
                { name: 'suggested_km_interval', label: 'Suggested km interval', placeholder: 'e.g. 5,000 km, 5,000 km inspection, 0 km' },
                { name: 'suggested_time_interval', label: 'Suggested time interval', placeholder: 'e.g. 6 months, 3 months, 24 months' },
                { name: 'service_task', label: 'Service task', required: true, span2: true, placeholder: 'e.g. Drain and replace engine oil and filter element' },
                { name: 'notes', label: 'Notes / Technical specs', span2: true, placeholder: 'e.g. Drain hot; replace sump drain plug washer and filter.' },
              ]}
              submitLabel="Save rule"
              onCancel={() => setShow(false)}
              onSubmit={async (d) => {
                await api.createRule({
                  ...d,
                  component_name: d.component,
                })
                reload()
                setShow(false)
                setNotice(`Rule for "${d.component}" saved successfully.`)
              }}
            />
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Input
            placeholder="Search component, task, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
            <option value="">All models ({rawRules.length})</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All action types</option>
            <option value="Inspection">Inspection only ({inspectionCount})</option>
            <option value="Service">Service / Replacement ({serviceCount})</option>
          </Select>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <Table
            rows={filteredRules}
            empty="No rules match the selected criteria."
            columns={[
              {
                header: 'Component',
                render: (r) => (
                  <div>
                    <div className="font-semibold text-ash-900">{r.component || r.component_name}</div>
                    <div className="mt-0.5">
                      <Badge tone={r.inspection_required === 1 ? 'green' : 'amber'}>
                        {r.inspection_required === 1 ? 'Inspection' : 'Service'}
                      </Badge>
                    </div>
                  </div>
                ),
              },
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
              { header: 'Model', key: 'vehicle_model' },
              {
                header: 'Service task',
                render: (r) => (
                  <div className="max-w-md">
                    <div className="text-sm text-ash-800">{r.service_task}</div>
                    {r.notes && (
                      <div className="mt-1 text-xs text-ash-500 italic">
                        Note: {r.notes}
                      </div>
                    )}
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

