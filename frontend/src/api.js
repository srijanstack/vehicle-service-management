// Thin client for the FastAPI backend. Every function maps to a real endpoint.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// FastAPI returns { detail: "msg" } or { detail: [{loc, msg}, ...] } for 422s.
function formatDetail(detail) {
  if (!detail) return 'Request failed'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail.map((d) => `${(d.loc || []).filter((x) => x !== 'body').join('.')}: ${d.msg}`).join('; ')
  return JSON.stringify(detail)
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = BASE + path
  if (params) {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && q.set(k, v))
    const s = q.toString()
    if (s) url += '?' + s
  }
  let res
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the backend. Is the API server running on port 8000?', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(formatDetail(data?.detail), res.status)
  return data
}

// Drop empty strings so optional fields are sent as absent (backend treats them as null/default).
export const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null))

export const api = {
  health: () => request('/health'),

  listVehicles: () => request('/vehicles/'),
  getVehicle: (id) => request(`/vehicles/${id}`),
  createVehicle: (data) => request('/vehicles/', { method: 'POST', body: clean(data) }),
  updateVehicleOdometer: (id, current_odometer_km) =>
    request(`/vehicles/${id}/odometer`, { method: 'PATCH', body: { current_odometer_km: Number(current_odometer_km) } }),
  updateVehicle: (id, data) => request(`/vehicles/${id}`, { method: 'PATCH', body: clean(data) }),

  listServiceRecords: (vehicle_id) => request('/service-records/', { params: { vehicle_id } }),
  createServiceRecord: (data) => request('/service-records/', { method: 'POST', body: clean(data) }),

  listInspections: (vehicle_id) => request('/inspections/', { params: { vehicle_id } }),
  createInspection: (data) => request('/inspections/', { method: 'POST', body: clean(data) }),

  listWorkOrders: (vehicle_id) => request('/work-orders/', { params: { vehicle_id } }),
  createWorkOrder: (data) => request('/work-orders/', { method: 'POST', body: clean(data) }),
  updateWorkOrder: (id, data) => request(`/work-orders/${id}`, { method: 'PATCH', body: data }),
  deleteWorkOrder: (id) => request(`/work-orders/${id}`, { method: 'DELETE' }),
  generateWorkOrders: (vehicle_id) => request(`/work-orders/from-maintenance/${vehicle_id}`, { method: 'POST' }),

  listRules: () => request('/maintenance-rules/'),
  createRule: (data) => request('/maintenance-rules/', { method: 'POST', body: data }),
  checkMaintenance: (vehicle_id) => request(`/maintenance-rules/check/${vehicle_id}`),
}
