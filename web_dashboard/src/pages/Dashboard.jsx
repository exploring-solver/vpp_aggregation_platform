import { useEffect, useState } from 'react'
import { Activity, Battery, Zap, Server, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function Dashboard() {
  const [aggregateData, setAggregateData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { makeApiCall, isTokenReady, isLoading: authLoading } = useAuthToken()

  console.log('Dashboard: Component mounted/re-rendered')

  // Fetch aggregate data from API
  const fetchAggregateData = async () => {
    try {
      setError(null)
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/aggregate`
      const response = await makeApiCall(apiUrl)
      
      if (response.ok) {
        const result = await response.json()
        setAggregateData(result.data)
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        setError(`API Error: ${errorData.message || response.status}`)
        // Use fallback data if API fails
        setAggregateData({
          total_power_kw: 0,
          avg_soc: 0,
          avg_freq: 50.0,
          node_count: 0,
          online_nodes: 0,
          revenue_today: 0,
          co2_saved: 0,
        })
      }
    } catch (error) {
      console.error('Error fetching aggregate data:', error)
      setError(`Network Error: ${error.message}`)
      // Use fallback data on error
      setAggregateData({
        total_power_kw: 0,
        avg_soc: 0,
        avg_freq: 50.0,
        node_count: 0,
        online_nodes: 0,
        revenue_today: 0,
        co2_saved: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch if we have a valid token
    if (isTokenReady) {
      fetchAggregateData();
      
      // Set up polling for real-time updates every 10 seconds
      const interval = setInterval(fetchAggregateData, 10000);
      
      return () => clearInterval(interval);
    }
  }, [makeApiCall, isTokenReady])

  if (authLoading || !isTokenReady || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">
            {authLoading || !isTokenReady ? 'Preparing authentication...' : 'Loading Virtual Plant Data...'}
          </p>
        </div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Total Power',
      value: `${aggregateData.total_power_kw}`,
      unit: 'kW',
      icon: Zap,
      gradient: 'from-energy-500 to-energy-600',
      bgGradient: 'from-energy-50 to-energy-100',
      borderColor: 'border-energy-200',
      trend: '+5.2%',
    },
    {
      name: 'Average SOC',
      value: `${aggregateData.avg_soc}`,
      unit: '%',
      icon: Battery,
      gradient: 'from-grid-500 to-grid-600',
      bgGradient: 'from-grid-50 to-grid-100',
      borderColor: 'border-grid-200',
      trend: '+2.1%',
    },
    {
      name: 'Grid Frequency',
      value: `${aggregateData.avg_freq}`,
      unit: 'Hz',
      icon: Activity,
      gradient: 'from-primary-500 to-primary-600',
      bgGradient: 'from-primary-50 to-primary-100',
      borderColor: 'border-primary-200',
      status: 'stable',
    },
    {
      name: 'Online Nodes',
      value: `${aggregateData.online_nodes}`,
      unit: `/${aggregateData.node_count}`,
      icon: Server,
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100',
      borderColor: 'border-purple-200',
      status: 'all',
    },
  ]

  const systemStatus = [
    { label: 'IoT Edge Layer', status: 'operational', icon: CheckCircle2 },
    { label: 'Aggregation Engine', status: 'operational', icon: CheckCircle2 },
    { label: 'AI Forecasting', status: 'operational', icon: CheckCircle2 },
    { label: 'Blockchain Settlement', status: 'operational', icon: CheckCircle2 },
  ]

  return (
    <div>
      {/* Debug Component - Remove this after testing */}
      {/* <AuthDebug /> */}
      
      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg flex items-start animate-in slide-in-from-top">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Connection Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Virtual Plant Dashboard</h1>
            <p className="mt-2 text-gray-600">Real-time grid flexibility aggregation and monitoring</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-4 py-2 bg-grid-50 border border-grid-200 rounded-xl">
              <div className="w-2 h-2 bg-grid-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-grid-700">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat) => (
          <div key={stat.name} className={`stat-card border-2 ${stat.borderColor} bg-gradient-to-br ${stat.bgGradient}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="metric-label">{stat.name}</p>
                <div className="flex items-baseline space-x-2 mt-2">
                  <p className="metric-value">{stat.value}</p>
                  <span className="text-xl font-semibold text-gray-600">{stat.unit}</span>
                </div>
                {stat.trend && (
                  <div className="flex items-center mt-2 text-sm text-grid-600">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    <span className="font-medium">{stat.trend}</span>
                  </div>
                )}
                {stat.status && (
                  <div className="mt-2">
                    <span className={`badge ${stat.status === 'stable' || stat.status === 'all' ? 'badge-success' : 'badge-warning'}`}>
                      {stat.status === 'stable' ? 'Stable' : stat.status === 'all' ? 'All Online' : stat.status}
                    </span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card-energy">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{aggregateData.revenue_today.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-energy-500 to-energy-600 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-grid">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">CO₂ Saved Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{aggregateData.co2_saved} tCO₂</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-grid-500 to-grid-600 rounded-xl">
              <Battery className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">System Status</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">All Operational</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* System Status & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Power Output (24h)</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>Real-time</span>
            </div>
          </div>
          <div className="h-80 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Chart will be implemented with Recharts</p>
              <p className="text-sm text-gray-400 mt-1">Real-time power output visualization</p>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-xl font-bold text-gray-900 mb-6">System Modules</h3>
          <div className="space-y-4">
            {systemStatus.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <item.icon className="w-5 h-5 text-grid-600" />
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">SOC Levels</h3>
            <span className="badge badge-info">All Nodes</span>
          </div>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-grid-50 to-grid-100 rounded-xl border-2 border-dashed border-grid-300">
            <div className="text-center">
              <Battery className="w-12 h-12 text-grid-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Battery SOC visualization</p>
              <p className="text-sm text-gray-400 mt-1">State of Charge across all nodes</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Grid Frequency</h3>
            <span className="badge badge-success">Stable</span>
          </div>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border-2 border-dashed border-primary-300">
            <div className="text-center">
              <Activity className="w-12 h-12 text-primary-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Frequency monitoring</p>
              <p className="text-sm text-gray-400 mt-1">Real-time grid frequency tracking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
