import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Nodes from './pages/Nodes'
import NodeDetail from './pages/NodeDetail'
import Dispatch from './pages/Dispatch'
import Forecasts from './pages/Forecasts'
import DGridOperator from './pages/DGridOperator'
import DataCenterOperator from './pages/DataCenterOperator'
import SimpleLogin from './pages/SimpleLogin'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<SimpleLogin />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="nodes" element={<Nodes />} />
        <Route path="nodes/:dcId" element={<NodeDetail />} />
        <Route path="dispatch" element={<Dispatch />} />
        <Route path="forecasts" element={<Forecasts />} />
        <Route path="dgrid-operator" element={<DGridOperator />} />
        <Route path="data-center-operator" element={<DataCenterOperator />} />
      </Route>
    </Routes>
  )
}

export default App
