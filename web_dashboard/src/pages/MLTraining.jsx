import { useState, useEffect } from 'react'
import { 
  Brain, Activity, CheckCircle2, XCircle, Clock, 
  TrendingUp, AlertCircle, RefreshCw, Play, FileText
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:5000'

export default function MLTraining() {
  const [models, setModels] = useState([])
  const [driftStatus, setDriftStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)
  const [selectedNode, setSelectedNode] = useState('')
  const [trainingParams, setTrainingParams] = useState({
    epochs: 100,
    lookback: 24,
    forecast_horizon: 6
  })
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchModels()
    fetchDriftStatus()
    const interval = setInterval(() => {
      fetchModels()
      fetchDriftStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchModels = async () => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/training/models/list`)
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error('Error fetching models:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDriftStatus = async () => {
    try {
      // Fetch drift status for all LSTM models
      const lstmModels = models.filter(m => m.model_type === 'lstm')
      const driftPromises = lstmModels.map(async (model) => {
        try {
          const response = await makeApiCall(
            `${ML_SERVICE_URL}/training/drift/${model.model_type}/${model.node_id}`
          )
          if (response.ok) {
            const data = await response.json()
            return { node_id: model.node_id, ...data }
          }
        } catch (error) {
          console.error(`Error fetching drift for ${model.node_id}:`, error)
        }
        return null
      })
      const driftResults = await Promise.all(driftPromises)
      const driftMap = {}
      driftResults.forEach(result => {
        if (result) {
          driftMap[result.node_id] = result
        }
      })
      setDriftStatus(driftMap)
    } catch (error) {
      console.error('Error fetching drift status:', error)
    }
  }

  const handleTrainLSTM = async () => {
    if (!selectedNode) {
      alert('Please select a node')
      return
    }

    setTraining(true)
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/training/lstm/train`, {
        method: 'POST',
        body: JSON.stringify({
          node_id: selectedNode,
          epochs: trainingParams.epochs,
          lookback: trainingParams.lookback,
          forecast_horizon: trainingParams.forecast_horizon
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Training job queued: ${data.job_id}`)
        // Refresh models after a delay
        setTimeout(fetchModels, 2000)
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to start training'}`)
      }
    } catch (error) {
      console.error('Error starting training:', error)
      alert('Failed to start training job')
    } finally {
      setTraining(false)
    }
  }

  const handleTrainRL = async () => {
    setTraining(true)
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/training/rl/train`, {
        method: 'POST',
        body: JSON.stringify({
          algorithm: 'PPO',
          total_timesteps: 100000
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`RL training job queued: ${data.job_id}`)
        setTimeout(fetchModels, 2000)
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to start training'}`)
      }
    } catch (error) {
      console.error('Error starting RL training:', error)
      alert('Failed to start RL training job')
    } finally {
      setTraining(false)
    }
  }

  const handleRetrainDrifted = async () => {
    setTraining(true)
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/training/retrain-all-drifted`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Retraining ${data.retraining_jobs} drifted models`)
        setTimeout(fetchModels, 2000)
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to retrain'}`)
      }
    } catch (error) {
      console.error('Error retraining drifted models:', error)
      alert('Failed to retrain drifted models')
    } finally {
      setTraining(false)
    }
  }

  const lstmModels = models.filter(m => m.model_type === 'lstm')
  const rlModels = models.filter(m => m.model_type === 'rl')

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">ML Model Training & Management</h1>
            <p className="mt-2 text-gray-600">Train, monitor, and manage ML models for forecasting and optimization</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
              <Brain className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">AI/ML Pipeline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Training Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">LSTM Forecasting Model</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Node ID</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DC01"
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Epochs</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="500"
                  value={trainingParams.epochs}
                  onChange={(e) => setTrainingParams({ ...trainingParams, epochs: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lookback (h)</label>
                <input
                  type="number"
                  className="input"
                  min="6"
                  max="168"
                  value={trainingParams.lookback}
                  onChange={(e) => setTrainingParams({ ...trainingParams, lookback: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horizon (h)</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="24"
                  value={trainingParams.forecast_horizon}
                  onChange={(e) => setTrainingParams({ ...trainingParams, forecast_horizon: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleTrainLSTM}
              disabled={training || !selectedNode}
            >
              {training ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Train LSTM Model
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">RL Optimization Model</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Algorithm: PPO (Proximal Policy Optimization)</p>
              <p className="text-sm text-gray-600 mb-2">Timesteps: 100,000</p>
              <p className="text-xs text-gray-500">Trains on historical decision data to optimize bidding strategies</p>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleTrainRL}
              disabled={training}
            >
              {training ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Train RL Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Model Drift Detection */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Model Drift Detection</h2>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleRetrainDrifted}
            disabled={training}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retrain All Drifted
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(driftStatus).map(([nodeId, status]) => (
            <div key={nodeId} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{nodeId}</span>
                {status.needs_retraining ? (
                  <span className="badge badge-warning">Drift Detected</span>
                ) : (
                  <span className="badge badge-success">Healthy</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Last checked: {new Date(status.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Registry */}
      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Model Registry</h2>
        </div>

        {/* LSTM Models */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">LSTM Forecasting Models ({lstmModels.length})</h3>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-600" />
              <p className="text-gray-500">Loading models...</p>
            </div>
          ) : lstmModels.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Brain className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No LSTM models found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Node ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Version</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metrics</th>
                  </tr>
                </thead>
                <tbody>
                  {lstmModels.map((model, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{model.node_id || 'N/A'}</td>
                      <td className="py-3 px-4">
                        {model.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-info">Inactive</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{model.version || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {model.created_at ? new Date(model.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {model.metrics ? `MAE: ${model.metrics.mae?.toFixed(2) || 'N/A'}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RL Models */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">RL Optimization Models ({rlModels.length})</h3>
          {rlModels.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No RL models found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Algorithm</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Version</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {rlModels.map((model, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{model.algorithm || 'PPO'}</td>
                      <td className="py-3 px-4">
                        {model.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-info">Inactive</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{model.version || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {model.created_at ? new Date(model.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {model.metrics ? `Reward: ${model.metrics.avg_reward?.toFixed(2) || 'N/A'}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

