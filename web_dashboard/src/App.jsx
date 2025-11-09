import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Nodes from './pages/Nodes'
import NodeDetail from './pages/NodeDetail'
import Dispatch from './pages/Dispatch'
import Forecasts from './pages/Forecasts'
import DGridOperator from './pages/DGridOperator'
import DataCenterOperator from './pages/DataCenterOperator'
import AgentManagement from './pages/AgentManagement'
import Trading from './pages/Trading'
import MLTraining from './pages/MLTraining'
import MLOptimization from './pages/MLOptimization'
import MLInsights from './pages/MLInsights'
import MLControl from './pages/MLControl'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const { isLoading } = useAuth0()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading VPP Platform...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
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
          <Route path="agents" element={<AgentManagement />} />
          <Route path="trading" element={<Trading />} />
          <Route path="dgrid-operator" element={<DGridOperator />} />
          <Route path="data-center-operator" element={<DataCenterOperator />} />
        <Route path="ml-training" element={<MLTraining />} />
        <Route path="ml-optimization" element={<MLOptimization />} />
        <Route path="ml-insights" element={<MLInsights />} />
        <Route path="ml-control" element={<MLControl />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
