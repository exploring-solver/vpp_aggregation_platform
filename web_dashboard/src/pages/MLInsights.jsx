import { useState, useEffect } from 'react'
import { 
  Brain, Lightbulb, TrendingUp, AlertCircle, 
  FileText, BarChart3, RefreshCw, Sparkles
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:5000'

export default function MLInsights() {
  const [dailySummary, setDailySummary] = useState(null)
  const [improvements, setImprovements] = useState(null)
  const [patterns, setPatterns] = useState({})
  const [selectedNode, setSelectedNode] = useState('')
  const [loading, setLoading] = useState(true)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchDailySummary()
    fetchImprovements()
    const interval = setInterval(() => {
      fetchDailySummary()
      fetchImprovements()
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedNode) {
      fetchPatterns(selectedNode)
    }
  }, [selectedNode])

  const fetchDailySummary = async () => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/insights/daily-summary`)
      if (response.ok) {
        const data = await response.json()
        setDailySummary(data)
      }
    } catch (error) {
      console.error('Error fetching daily summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchImprovements = async (days = 7) => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/insights/improvements?days=${days}`)
      if (response.ok) {
        const data = await response.json()
        setImprovements(data)
      }
    } catch (error) {
      console.error('Error fetching improvements:', error)
    }
  }

  const fetchPatterns = async (nodeId) => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/insights/patterns/${nodeId}`)
      if (response.ok) {
        const data = await response.json()
        setPatterns(prev => ({ ...prev, [nodeId]: data }))
      }
    } catch (error) {
      console.error(`Error fetching patterns for ${nodeId}:`, error)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">AI Insights & Analytics</h1>
            <p className="mt-2 text-gray-600">AI-generated insights, patterns, and optimization suggestions</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl">
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">LLM Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Daily Summary</h2>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchDailySummary}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-600" />
            <p className="text-gray-500">Loading summary...</p>
          </div>
        ) : dailySummary ? (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{dailySummary.metrics?.total_revenue?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Control Actions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dailySummary.metrics?.control_actions || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Active Nodes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dailySummary.metrics?.nodes_active || 0}
                </p>
              </div>
            </div>

            {/* AI Summary */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border border-primary-200">
              <div className="flex items-start space-x-3 mb-3">
                <Sparkles className="w-5 h-5 text-primary-600 mt-1" />
                <h3 className="text-lg font-semibold text-gray-900">AI-Generated Summary</h3>
              </div>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {dailySummary.ai_summary || 'No summary available'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No summary available</p>
          </div>
        )}
      </div>

      {/* Improvement Suggestions */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Improvement Suggestions</h2>
          </div>
          <div className="flex items-center space-x-2">
            <select
              className="input"
              onChange={(e) => fetchImprovements(parseInt(e.target.value))}
              defaultValue="7"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => fetchImprovements(7)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
        {improvements ? (
          <div className="space-y-4">
            {/* Performance Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Period</p>
                  <p className="font-medium text-gray-900">{improvements.period_days} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Actions</p>
                  <p className="font-medium text-gray-900">{improvements.performance_summary?.total_actions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Action Breakdown</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(improvements.performance_summary?.action_breakdown || {}).map(([action, count]) => (
                      <span key={action} className="badge badge-info">
                        {action}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="flex items-start space-x-3 mb-3">
                <Lightbulb className="w-5 h-5 text-green-600 mt-1" />
                <h3 className="text-lg font-semibold text-gray-900">AI Suggestions</h3>
              </div>
              <div className="prose max-w-none">
                {typeof improvements.suggestions === 'string' ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{improvements.suggestions}</p>
                ) : (
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {Array.isArray(improvements.suggestions) ? (
                      improvements.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))
                    ) : (
                      <li>{JSON.stringify(improvements.suggestions)}</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No suggestions available</p>
          </div>
        )}
      </div>

      {/* Learned Patterns */}
      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Learned Usage Patterns</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Node</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., DC01"
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
            />
          </div>
          {selectedNode && patterns[selectedNode] ? (
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Patterns for {selectedNode}</h3>
              <div className="space-y-3">
                {Object.entries(patterns[selectedNode].patterns || {}).map(([key, value]) => (
                  <div key={key} className="p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-1">{key}</p>
                    <p className="text-sm text-gray-600">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedNode ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No patterns found for {selectedNode}</p>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">Enter a node ID to view learned patterns</p>
            </div>
          )}
        </div>
      </div>

      {/* Anomaly Explanation */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Anomaly Explanation</h2>
        </div>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Use this feature to get AI explanations for anomalous behavior in your system.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Anomaly Data (JSON)</label>
              <textarea
                className="input"
                rows="4"
                placeholder='{"node_id": "DC01", "metric": "power_output", "value": 500, "expected": 300}'
              />
            </div>
            <button className="btn btn-primary">
              <Brain className="w-4 h-4 mr-2" />
              Get AI Explanation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

