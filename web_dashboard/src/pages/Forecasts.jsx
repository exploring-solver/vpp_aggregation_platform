import { useState, useEffect } from 'react'
import { TrendingUp, Brain, Activity, Brain as BrainIcon, Zap, Battery } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useAuthToken } from '../services/auth'

export default function Forecasts() {
  const [loadForecast, setLoadForecast] = useState(null)
  const [gridStress, setGridStress] = useState(null)
  const [optimization, setOptimization] = useState(null)
  const [loading, setLoading] = useState(true)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchForecastData()
    const interval = setInterval(fetchForecastData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [makeApiCall])

  const fetchForecastData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Fetch load forecast
      const loadResponse = await makeApiCall(`${apiUrl}/api/forecast/load?horizon_hours=24`)
      if (loadResponse.ok) {
        const loadData = await loadResponse.json()
        setLoadForecast(loadData.data)
      }

      // Fetch grid stress forecast
      const stressResponse = await makeApiCall(`${apiUrl}/api/forecast/grid-stress?horizon_hours=6`)
      if (stressResponse.ok) {
        const stressData = await stressResponse.json()
        setGridStress(stressData.data)
      }

      // Fetch optimization recommendation
      const optResponse = await makeApiCall(`${apiUrl}/api/optimization/recommendation`)
      if (optResponse.ok) {
        const optData = await optResponse.json()
        setOptimization(optData.data)
      }

      // Fetch agent recommendations
      const agentResponse = await makeApiCall(`${apiUrl}/api/agents/recommendations`)
      if (agentResponse.ok) {
        const agentData = await agentResponse.json()
        if (agentData.data) {
          setOptimization(prev => ({ ...prev, ...agentData.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data from forecasts
  const loadChartData = loadForecast?.forecast?.map((point, idx) => ({
    time: idx,
    load: point.load_kw || point.predicted_load || 0,
    actual: point.actual_load || null
  })) || []

  const stressChartData = gridStress?.forecast?.map((point, idx) => ({
    time: idx,
    stress: point.stress_score || point.predicted_stress || 0
  })) || []

  const forecasts = [
    {
      type: 'Load Forecast',
      prediction: loadForecast?.current_load ? `${loadForecast.current_load.toFixed(1)} kW` : 'N/A',
      confidence: loadForecast?.confidence || 85,
      timeframe: 'Next 24h',
      trend: loadForecast?.trend || 'stable',
      icon: Zap,
      color: 'energy',
    },
    {
      type: 'Grid Stress',
      prediction: gridStress?.current_stress ? gridStress.current_stress.toFixed(2) : 'N/A',
      confidence: gridStress?.confidence || 88,
      timeframe: 'Next 6h',
      trend: gridStress?.trend || 'moderate',
      icon: Activity,
      color: 'primary',
    },
    {
      type: 'SOC Forecast',
      prediction: optimization?.avg_soc ? `${optimization.avg_soc.toFixed(0)}%` : 'N/A',
      confidence: optimization?.confidence ? Math.round(optimization.confidence * 100) : 95,
      timeframe: 'Next 12h',
      trend: 'stable',
      icon: Battery,
      color: 'grid',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Forecasts & Predictions</h1>
          <p className="mt-2 text-gray-600">LSTM-based load forecasting and RL optimization predictions</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
            <Brain className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">AI Powered</span>
          </div>
        </div>
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {forecasts.map((forecast, idx) => (
          <div key={idx} className={`card-${forecast.color}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 bg-gradient-to-br from-${forecast.color}-500 to-${forecast.color}-600 rounded-lg`}>
                  <forecast.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{forecast.type}</h3>
                  <p className="text-xs text-gray-500">{forecast.timeframe}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">{forecast.prediction}</p>
                <p className="text-sm text-gray-600 mt-1">Predicted value</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-grid-600" />
                  <span className="text-sm text-gray-600">Confidence</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{forecast.confidence}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`badge ${
                  forecast.trend === 'increasing' ? 'badge-warning' :
                  forecast.trend === 'moderate' ? 'badge-info' :
                  'badge-success'
                }`}>
                  {forecast.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Load Forecast (24h)</h2>
            <span className="badge badge-info">LSTM Model</span>
          </div>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : loadChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={loadChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Hours', position: 'insideBottom' }} />
                <YAxis label={{ value: 'Load (kW)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="load" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Predicted Load" />
                {loadChartData.some(d => d.actual !== null) && (
                  <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} name="Actual Load" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center bg-gradient-to-br from-energy-50 to-energy-100 rounded-xl border-2 border-dashed border-energy-300">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-energy-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No forecast data available</p>
                <p className="text-sm text-gray-400 mt-1">Waiting for forecast service...</p>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Grid Stress Score</h2>
            <span className="badge badge-warning">High Accuracy</span>
          </div>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : stressChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={stressChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Hours', position: 'insideBottom' }} />
                <YAxis domain={[0, 1]} label={{ value: 'Stress Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="stress" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Grid Stress" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border-2 border-dashed border-primary-300">
              <div className="text-center">
                <Activity className="w-12 h-12 text-primary-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No stress data available</p>
                <p className="text-sm text-gray-400 mt-1">Waiting for forecast service...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RL Optimization */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">RL Bidding Optimization</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Recommended Action</p>
            <p className="text-lg font-bold text-gray-900">
              {optimization?.recommendedAction || optimization?.recommended_action || 'Hold'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Confidence: {optimization?.confidence ? Math.round(optimization.confidence * 100) : 0}%
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Expected Revenue</p>
            <p className="text-lg font-bold text-gray-900">
              ₹{optimization?.expectedRevenue || optimization?.expected_revenue || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per action</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Market Opportunity</p>
            <p className="text-lg font-bold text-gray-900">
              {optimization?.expectedRevenue > 1000 ? 'High' : optimization?.expectedRevenue > 500 ? 'Medium' : 'Low'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on revenue potential</p>
          </div>
        </div>
        <div className="text-center py-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-dashed border-purple-300">
          <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-50" />
          <p className="text-gray-500 font-medium">RL Agent recommendations</p>
          <p className="text-sm text-gray-400 mt-1">Q-learning / PPO optimization output</p>
        </div>
      </div>
    </div>
  )
}
