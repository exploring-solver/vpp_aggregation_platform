import { useState, useEffect } from 'react'
import { 
  Brain, Zap, TrendingUp, Activity, Target, 
  DollarSign, BarChart3, RefreshCw, Play
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuthToken } from '../services/auth'

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:5000'

export default function MLOptimization() {
  const [recommendation, setRecommendation] = useState(null)
  const [currentState, setCurrentState] = useState({
    soc: 50,
    grid_frequency: 50.0,
    power_price: 100,
    demand: 500,
    hour: new Date().getHours(),
    day_of_week: new Date().getDay()
  })
  const [strategy, setStrategy] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchRecommendation()
    fetchStrategy()
    const interval = setInterval(() => {
      fetchRecommendation()
    }, 30000)
    return () => clearInterval(interval)
  }, [currentState])

  const fetchRecommendation = async () => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/optimization/recommend`, {
        method: 'POST',
        body: JSON.stringify({ current_state: currentState })
      })
      if (response.ok) {
        const data = await response.json()
        setRecommendation(data)
      }
    } catch (error) {
      console.error('Error fetching recommendation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStrategy = async () => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/optimization/strategy/current`)
      if (response.ok) {
        const data = await response.json()
        setStrategy(data)
      }
    } catch (error) {
      console.error('Error fetching strategy:', error)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/optimization/evaluate-policy`, {
        method: 'POST',
        body: JSON.stringify({ n_episodes: 10 })
      })
      if (response.ok) {
        const data = await response.json()
        setEvaluation(data)
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to evaluate policy'}`)
      }
    } catch (error) {
      console.error('Error evaluating policy:', error)
      alert('Failed to evaluate policy')
    } finally {
      setEvaluating(false)
    }
  }

  const actionColors = {
    hold: 'gray',
    charge: 'blue',
    discharge: 'green',
    bid_high: 'purple',
    bid_low: 'orange'
  }

  const actionLabels = {
    hold: 'Hold',
    charge: 'Charge',
    discharge: 'Discharge',
    bid_high: 'Bid High',
    bid_low: 'Bid Low'
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">RL Optimization Dashboard</h1>
            <p className="mt-2 text-gray-600">Real-time reinforcement learning-based optimization recommendations</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl">
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">RL Agent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card-energy">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Recommended Action</h2>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-600" />
              <p className="text-gray-500">Loading recommendation...</p>
            </div>
          ) : recommendation ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-${actionColors[recommendation.recommended_action] || 'gray'}-100 mb-4`}>
                  <span className="text-2xl font-bold text-gray-900">
                    {actionLabels[recommendation.recommended_action] || recommendation.recommended_action}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Action ID: {recommendation.action_id}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Expected Reward</span>
                  <span className={`text-lg font-bold ${recommendation.expected_reward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{recommendation.expected_reward?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Algorithm</span>
                  <span className="text-sm font-medium text-gray-900">{recommendation.metadata?.algorithm || 'PPO'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No recommendation available</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Current State</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SOC (%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={currentState.soc}
                onChange={(e) => setCurrentState({ ...currentState, soc: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-medium">{currentState.soc}%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grid Frequency (Hz)</label>
              <input
                type="number"
                className="input"
                min="49.5"
                max="50.5"
                step="0.1"
                value={currentState.grid_frequency}
                onChange={(e) => setCurrentState({ ...currentState, grid_frequency: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Power Price (₹/kWh)</label>
              <input
                type="number"
                className="input"
                min="0"
                value={currentState.power_price}
                onChange={(e) => setCurrentState({ ...currentState, power_price: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Demand (kW)</label>
              <input
                type="number"
                className="input"
                min="0"
                value={currentState.demand}
                onChange={(e) => setCurrentState({ ...currentState, demand: parseFloat(e.target.value) })}
              />
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={fetchRecommendation}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Update Recommendation
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Strategy Parameters</h2>
          </div>
          {strategy ? (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Strategy Type</p>
                <p className="text-lg font-bold text-gray-900">{strategy.strategy}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Algorithm</p>
                <p className="text-lg font-bold text-gray-900">{strategy.algorithm}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Max Charge Rate</span>
                  <span className="font-medium">{strategy.parameters?.max_charge_rate || 250} kW</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Max Discharge Rate</span>
                  <span className="font-medium">{strategy.parameters?.max_discharge_rate || 250} kW</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Target SOC Range</span>
                  <span className="font-medium">
                    {strategy.parameters?.target_soc_range?.[0] || 30}% - {strategy.parameters?.target_soc_range?.[1] || 80}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Frequency Support</span>
                  <span className="font-medium">
                    {strategy.parameters?.frequency_support_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Loading strategy...</p>
            </div>
          )}
        </div>
      </div>

      {/* Policy Evaluation */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Policy Evaluation</h2>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleEvaluate}
            disabled={evaluating}
          >
            {evaluating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Evaluate Policy
              </>
            )}
          </button>
        </div>
        {evaluation ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Average Reward</p>
              <p className="text-2xl font-bold text-gray-900">
                {evaluation.evaluation_metrics?.avg_reward?.toFixed(2) || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Episodes</p>
              <p className="text-2xl font-bold text-gray-900">{evaluation.n_episodes || 10}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {evaluation.evaluation_metrics?.success_rate ? 
                  `${(evaluation.evaluation_metrics.success_rate * 100).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500">Click "Evaluate Policy" to run evaluation</p>
          </div>
        )}
      </div>

      {/* Action History Chart */}
      {recommendation && (
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Action Distribution</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { action: 'Hold', value: recommendation.recommended_action === 'hold' ? 1 : 0 },
                { action: 'Charge', value: recommendation.recommended_action === 'charge' ? 1 : 0 },
                { action: 'Discharge', value: recommendation.recommended_action === 'discharge' ? 1 : 0 },
                { action: 'Bid High', value: recommendation.recommended_action === 'bid_high' ? 1 : 0 },
                { action: 'Bid Low', value: recommendation.recommended_action === 'bid_low' ? 1 : 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

