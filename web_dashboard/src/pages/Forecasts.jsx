import { useEffect, useState } from 'react'
import { TrendingUp, Brain, Activity, AlertTriangle, Zap, Battery } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function Forecasts() {
  const [forecastData, setForecastData] = useState(null)
  const [agentStatus, setAgentStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchForecastData()
    fetchAgentStatus()
    const interval = setInterval(() => {
      fetchForecastData()
      fetchAgentStatus()
    }, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [makeApiCall])

  const fetchForecastData = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/forecast/load`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setForecastData(result.data)
      }
    } catch (error) {
      console.error('Error fetching forecast:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentStatus = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/agents/LoadForecastAgent/status`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setAgentStatus(result.data)
      }
    } catch (error) {
      console.error('Error fetching agent status:', error)
    }
  }

  const forecasts = [
    {
      type: 'Load Forecast',
      prediction: forecastData?.predictions?.[0]?.value 
        ? `${forecastData.predictions[0].value.toFixed(1)} kW` 
        : '245.8 kW',
      confidence: agentStatus?.lastResult?.loadForecast?.confidence || 92,
      timeframe: 'Next 24h',
      trend: forecastData?.predictions?.[0]?.value > (forecastData?.predictions?.[1]?.value || 0) ? 'increasing' : 'stable',
      icon: Zap,
      color: 'energy',
    },
    {
      type: 'Grid Stress',
      prediction: agentStatus?.lastResult?.gridStressForecast?.current_stress_score 
        ? agentStatus.lastResult.gridStressForecast.current_stress_score.toFixed(2)
        : '0.65',
      confidence: 88,
      timeframe: 'Next 6h',
      trend: agentStatus?.lastResult?.gridStressForecast?.current_stress_score > 0.7 ? 'high' : 'moderate',
      icon: Activity,
      color: 'primary',
    },
    {
      type: 'SOC Forecast',
      prediction: '82%',
      confidence: 95,
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
          <div className="h-80 flex items-center justify-center bg-gradient-to-br from-energy-50 to-energy-100 rounded-xl border-2 border-dashed border-energy-300">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-energy-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Load forecasting chart</p>
              <p className="text-sm text-gray-400 mt-1">AI-powered predictions</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Grid Stress Score</h2>
            <span className="badge badge-warning">High Accuracy</span>
          </div>
          <div className="h-80 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border-2 border-dashed border-primary-300">
            <div className="text-center">
              <Activity className="w-12 h-12 text-primary-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Grid stress prediction</p>
              <p className="text-sm text-gray-400 mt-1">0-1 stress score visualization</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Status */}
      {agentStatus && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Load Forecast Agent</h3>
                <p className="text-sm text-gray-600">Status: {agentStatus.status}</p>
              </div>
            </div>
            <span className={`badge ${
              agentStatus.status === 'idle' ? 'badge-success' : 
              agentStatus.status === 'running' ? 'badge-info' : 'badge-warning'
            }`}>
              {agentStatus.status}
            </span>
          </div>
          {agentStatus.lastResult?.recommendations && agentStatus.lastResult.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Agent Recommendations:</p>
              {agentStatus.lastResult.recommendations.map((rec, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  rec.severity === 'high' ? 'bg-red-50 border-red-200' :
                  rec.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <p className="text-sm font-medium">{rec.message}</p>
                  <p className="text-xs text-gray-600 mt-1">Action: {rec.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <p className="text-lg font-bold text-gray-900">Charge</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Expected Revenue</p>
            <p className="text-lg font-bold text-gray-900">₹2,450</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Market Opportunity</p>
            <p className="text-lg font-bold text-gray-900">High</p>
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
