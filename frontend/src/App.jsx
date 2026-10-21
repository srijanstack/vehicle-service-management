import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Vehicles from './pages/Vehicles.jsx'
import RegisterVehicle from './pages/RegisterVehicle.jsx'
import VehicleDetail from './pages/VehicleDetail.jsx'
import WorkOrders from './pages/WorkOrders.jsx'
import Rules from './pages/Rules.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="vehicles/register" element={<RegisterVehicle />} />
        <Route path="vehicles/:id" element={<VehicleDetail />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="rules" element={<Rules />} />
        <Route path="*" element={<p className="text-ash-600">Page not found.</p>} />
      </Route>
    </Routes>
  )
}
