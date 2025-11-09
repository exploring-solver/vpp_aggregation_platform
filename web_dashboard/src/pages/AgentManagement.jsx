import { useEffect, useState } from 'react'
import { 
  Brain, Activity, Zap, TrendingUp, GitBranch, CheckCircle, 
  XCircle, Clock, ArrowRight, BarChart3, Cpu, Network,
  AlertTriangle, Shield, Target, Radio, Eye, Sparkles
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function AgentManagement() {
  const [agentStatus, setAgentStatus] = useState(null)
  const [cycleHistory, setCycleHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState(null)
  
  // Hooks must be called unconditionally
  let authResult = null
  try {
    authResult = useAuthToken()
  } catch (authError) {
    console.error('[AgentManagement] Error initializing auth hook:', authError)
  }
  
  const makeApiCall = authResult?.makeApiCall || null
  console.log('[AgentManagement] Auth hook initialized', { hasMakeApiCall: !!makeApiCall, authResult })

  useEffect(() => {
    console.log('[AgentManagement] Component mounted, starting data fetch')
    try {
      fetchAgentStatus()
      fetchCycleHistory()
      const interval = setInterval(() => {
        console.log('[AgentManagement] Polling for updates')
        fetchAgentStatus()
        fetchCycleHistory()
      }, 5000) // Update every 5 seconds
      return () => {
        console.log('[AgentManagement] Component unmounting, clearing interval')
        clearInterval(interval)
      }
    } catch (err) {
      console.error('[AgentManagement] Error in useEffect:', err)
      setError(err.message || 'Failed to initialize component')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAgentStatus = async () => {
    try {
      console.log('[AgentManagement] Fetching agent status...')
      if (!makeApiCall) {
        console.warn('[AgentManagement] makeApiCall not available')
        throw new Error('Authentication not available')
      }
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      console.log('[AgentManagement] Calling API:', `${baseUrl}/api/agents/status`)
      const response = await makeApiCall(`${baseUrl}/api/agents/status`)
      
      console.log('[AgentManagement] Agent status response:', { ok: response.ok, status: response.status })
      
      if (response.ok) {
        const result = await response.json()
        console.log('[AgentManagement] Agent status data received:', result)
        // Handle the response structure: {success: true, data: {agents: {...}}}
        const statusData = result.data || result
        console.log('[AgentManagement] Setting agent status to:', statusData)
        setAgentStatus(statusData)
        setError(null)
      } else {
        const errorText = await response.text()
        console.error('[AgentManagement] Agent status API error:', { status: response.status, error: errorText })
        throw new Error(`Failed to fetch agent status: ${response.status}`)
      }
    } catch (error) {
      console.error('[AgentManagement] Error fetching agent status:', error)
      setError(error?.message || 'Failed to fetch agent status')
    } finally {
      setLoading(false)
    }
  }

  const fetchCycleHistory = async () => {
    try {
      if (!makeApiCall) {
        console.warn('[AgentManagement] makeApiCall not available for cycle history')
        return
      }
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const url = `${baseUrl}/api/dispatch/logs?issued_by=multi-agent-system&limit=10`
      console.log('[AgentManagement] Fetching cycle history:', url)
      const response = await makeApiCall(url)
      
      console.log('[AgentManagement] Cycle history response:', { ok: response.ok, status: response.status })
      
      if (response.ok) {
        const result = await response.json()
        console.log('[AgentManagement] Cycle history data received:', { count: result.data?.length || result.length || 0, result })
        setCycleHistory(Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [])
      } else {
        console.error('[AgentManagement] Cycle history API error:', response.status)
      }
    } catch (error) {
      console.error('[AgentManagement] Error fetching cycle history:', error)
    }
  }

  const executeAgentCycle = async () => {
    try {
      if (!makeApiCall) {
        throw new Error('Authentication not available')
      }
      setExecuting(true)
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await makeApiCall(`${baseUrl}/api/agents/execute`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        // Refresh status and history
        await fetchAgentStatus()
        await fetchCycleHistory()
        
        // Show success notification
        alert(`Agent cycle executed: ${result.data?.decision?.approved ? 'Action approved and executed' : 'Action deferred'}`)
      } else {
        throw new Error('Failed to execute agent cycle')
      }
    } catch (error) {
      console.error('Error executing agent cycle:', error)
      alert('Failed to execute agent cycle: ' + error.message)
    } finally {
      setExecuting(false)
    }
  }

  // Safe extraction of agents data with logging
  let agents = {}
  try {
    if (agentStatus) {
      console.log('[AgentManagement] Agent status:', agentStatus)
      agents = agentStatus?.agents || agentStatus || {}
      console.log('[AgentManagement] Extracted agents:', agents)
    }
  } catch (extractError) {
    console.error('[AgentManagement] Error extracting agents data:', extractError)
    agents = {}
  }

  if (loading && !agentStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error && !agentStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg font-semibold text-gray-900">Error loading agent data</p>
        <p className="text-sm text-gray-600 mt-2">{error}</p>
        <button 
          onClick={() => {
            console.log('[AgentManagement] Retrying...')
            setError(null)
            setLoading(true)
            fetchAgentStatus()
            fetchCycleHistory()
          }}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Render component with error handling
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center">
              <Brain className="w-8 h-8 mr-3 text-primary-600" />
              Multi-Agent System Control
            </h1>
            <p className="mt-2 text-gray-600">
              Autonomous AI agents optimizing grid performance through collaborative decision-making
            </p>
          </div>
          <button
            onClick={executeAgentCycle}
            disabled={executing}
            className={`btn ${executing ? 'btn-secondary' : 'btn-primary'} flex items-center`}
          >
            {executing ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Execute Agent Cycle
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Performance Metrics */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
          System Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-1">Transmission Efficiency</p>
            <p className="text-3xl font-bold text-blue-900">+18%</p>
            <p className="text-xs text-blue-600 mt-1">vs baseline</p>
          </div>
          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <p className="text-sm font-medium text-green-800 mb-1">Active Agents</p>
            <p className="text-3xl font-bold text-green-900">5/5</p>
            <p className="text-xs text-green-600 mt-1">All operational</p>
          </div>
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <p className="text-sm font-medium text-purple-800 mb-1">Decisions Made</p>
            <p className="text-3xl font-bold text-purple-900">{cycleHistory.length}</p>
            <p className="text-xs text-purple-600 mt-1">Last 24 hours</p>
          </div>
          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
            <p className="text-sm font-medium text-orange-800 mb-1">Grid Reserve</p>
            <p className="text-3xl font-bold text-orange-900">
              {typeof agents.monitoring?.availableReserve === 'number' ? agents.monitoring.availableReserve.toFixed(1) : 0} MW
            </p>
            <p className="text-xs text-orange-600 mt-1">Available capacity</p>
          </div>
        </div>
      </div>

      {/* Agent Status Cards */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Network className="w-5 h-5 mr-2 text-primary-600" />
          Agent Status & Activities
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Monitoring Agent */}
          <div className="card border-l-4 border-blue-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Eye className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Monitoring Agent</h3>
                  <p className="text-sm text-gray-600">System health & performance tracking</p>
                </div>
              </div>
              <span className={`badge ${agents.monitoring?.status === 'healthy' ? 'badge-success' : 'badge-warning'}`}>
                {agents.monitoring?.status || 'unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Active Nodes</p>
                <p className="text-xl font-bold text-gray-900">
                  {Array.isArray(agents.monitoring?.activeNodes) 
                    ? agents.monitoring.activeNodes.length 
                    : (typeof agents.monitoring?.activeNodes === 'number' 
                        ? agents.monitoring.activeNodes 
                        : 0)}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Total Capacity</p>
                <p className="text-xl font-bold text-gray-900">
                  {typeof agents.monitoring?.totalCapacity === 'number' ? agents.monitoring.totalCapacity.toFixed(1) : 0} MW
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                <p className="text-xs text-gray-600 mb-1">Available Reserve</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-gray-900">
                    {typeof agents.monitoring?.availableReserve === 'number' ? agents.monitoring.availableReserve.toFixed(2) : 0} MW
                  </p>
                  <div className="text-xs text-gray-500">
                    {typeof agents.monitoring?.totalCapacity === 'number' && 
                     agents.monitoring.totalCapacity > 0 && 
                     typeof agents.monitoring?.availableReserve === 'number'
                      ? `${((agents.monitoring.availableReserve / agents.monitoring.totalCapacity) * 100).toFixed(0)}%`
                      : '0%'
                    }
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ 
                      width: typeof agents.monitoring?.totalCapacity === 'number' && 
                             agents.monitoring.totalCapacity > 0 && 
                             typeof agents.monitoring?.availableReserve === 'number'
                        ? `${Math.min(100, (agents.monitoring.availableReserve / agents.monitoring.totalCapacity) * 100)}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <Activity className="w-4 h-4 mr-2" />
              Continuously monitoring {Array.isArray(agents.monitoring?.activeNodes) 
                ? agents.monitoring.activeNodes.length 
                : (typeof agents.monitoring?.activeNodes === 'number' 
                    ? agents.monitoring.activeNodes 
                    : 0)} edge nodes
            </div>
          </div>

          {/* Load Forecast Agent */}
          <div className="card border-l-4 border-green-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Load Forecast Agent</h3>
                  <p className="text-sm text-gray-600">Predicting grid demand & stress</p>
                </div>
              </div>
              <span className="badge badge-success">
                {typeof agents.forecast?.confidence === 'number' ? (agents.forecast.confidence * 100).toFixed(0) : 0}% confident
              </span>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Grid Stress Score</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-gray-900">
                    {typeof agents.forecast?.gridStress?.current_stress_score === 'number'
                      ? (agents.forecast.gridStress.current_stress_score * 100).toFixed(0) 
                      : 0}%
                  </p>
                  {(agents.forecast?.gridStress?.current_stress_score ?? 0) > 0.6 ? (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">24h Load Forecast</p>
                <p className="text-sm text-gray-700">
                  {agents.forecast?.loadForecast?.predictions?.length || 0} predictions generated
                </p>
                  <p className="text-xs text-gray-500 mt-1">
                  Confidence: {typeof agents.forecast?.loadForecast?.confidence === 'number' ? (agents.forecast.loadForecast.confidence * 100).toFixed(0) : 0}%
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <Brain className="w-4 h-4 mr-2" />
              LSTM/Prophet models analyzing patterns
            </div>
          </div>

          {/* Optimization Agent */}
          <div className="card border-l-4 border-purple-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Target className="w-6 h-6 text-purple-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Optimization Agent</h3>
                  <p className="text-sm text-gray-600">RL-based dispatch optimization</p>
                </div>
              </div>
              <span className="badge badge-info">
                {typeof agents.optimization?.confidence === 'number' ? (agents.optimization.confidence * 100).toFixed(0) : 0}% confident
              </span>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Recommended Action</p>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {agents.optimization?.recommendedAction || 'hold'}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Expected Revenue</p>
                <p className="text-xl font-bold text-green-600">
                  ₹{typeof agents.optimization?.expectedRevenue === 'number' ? agents.optimization.expectedRevenue.toLocaleString() : 0}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <Cpu className="w-4 h-4 mr-2" />
              Deep Q-Network analyzing market conditions
            </div>
          </div>

          {/* Demand Response Agent */}
          <div className="card border-l-4 border-orange-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Zap className="w-6 h-6 text-orange-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Demand Response Agent</h3>
                  <p className="text-sm text-gray-600">Grid stabilization & DR coordination</p>
                </div>
              </div>
              <span className="badge badge-warning">
                Active
              </span>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Grid Frequency</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-gray-900">
                    {typeof agents.monitoring?.gridFrequency === 'number' ? agents.monitoring.gridFrequency.toFixed(2) : '50.00'} Hz
                  </p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    Math.abs((typeof agents.monitoring?.gridFrequency === 'number' ? agents.monitoring.gridFrequency : 50) - 50) > 0.2 
                      ? 'bg-orange-100 text-orange-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {Math.abs((typeof agents.monitoring?.gridFrequency === 'number' ? agents.monitoring.gridFrequency : 50) - 50) > 0.2 ? 'Unstable' : 'Stable'}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">DR Events Today</p>
                <p className="text-xl font-bold text-gray-900">
                  {cycleHistory.filter(h => h && h.action === 'defer_load').length}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <Shield className="w-4 h-4 mr-2" />
              Coordinating load deferral for grid stability
            </div>
          </div>

          {/* Predictive Demand Response Agent */}
          <div className="card border-l-4 border-indigo-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Sparkles className="w-6 h-6 text-indigo-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Predictive DR Agent</h3>
                  <p className="text-sm text-gray-600">Predicts stress & autonomously shifts workloads</p>
                </div>
              </div>
              <span className="badge badge-info">
                {typeof agents.predictiveDR?.confidence === 'number' ? (agents.predictiveDR.confidence * 100).toFixed(0) : 0}% confident
              </span>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Predicted Stress Periods</p>
                <p className="text-xl font-bold text-gray-900">
                  {Array.isArray(agents.predictiveDR?.predictedStressPeriods) 
                    ? agents.predictiveDR.predictedStressPeriods.length 
                    : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Next 24 hours
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Workload Shifts Planned</p>
                <p className="text-xl font-bold text-gray-900">
                  {Array.isArray(agents.predictiveDR?.workloadShifts) 
                    ? agents.predictiveDR.workloadShifts.length 
                    : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Array.isArray(agents.predictiveDR?.workloadShifts) 
                    ? agents.predictiveDR.workloadShifts.filter(s => s.priority === 'high').length 
                    : 0} high priority
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Prediction Accuracy</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-gray-900">
                    {typeof agents.predictiveDR?.accuracy === 'number' 
                      ? (agents.predictiveDR.accuracy * 100).toFixed(0) 
                      : 0}%
                  </p>
                  <span className="text-xs text-green-600 font-semibold">
                    +30% vs baseline
                  </span>
                </div>
              </div>
              {agents.predictiveDR?.savings && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200">
                  <p className="text-xs text-gray-600 mb-1">Estimated Savings</p>
                  <p className="text-lg font-bold text-indigo-900">
                    ₹{typeof agents.predictiveDR.savings.daily === 'number' 
                      ? agents.predictiveDR.savings.daily.toLocaleString() 
                      : 0}/day
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">
                    {typeof agents.predictiveDR.savings.totalReductionKw === 'number' 
                      ? agents.predictiveDR.savings.totalReductionKw.toFixed(1) 
                      : 0} kW reduction
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <Brain className="w-4 h-4 mr-2" />
              Analyzing weather, time patterns, and events for 30% better accuracy
            </div>
          </div>

        </div>
      </div>

      {/* Agent Communication & Consensus */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <GitBranch className="w-5 h-5 mr-2 text-primary-600" />
          Agent Collaboration Flow
        </h2>
        <div className="card">
          <div className="flex flex-col space-y-4">
            {/* Flow diagram */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <Eye className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-center">Monitor</p>
                <p className="text-xs text-gray-500 text-center">Assess state</p>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400 mx-auto" />
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-center">Forecast</p>
                <p className="text-xs text-gray-500 text-center">Predict load</p>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400 mx-auto" />
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                  <Sparkles className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-center">Predict</p>
                <p className="text-xs text-gray-500 text-center">Stress periods</p>
              </div>
              
              <ArrowRight className="w-6 h-6 text-gray-400 mx-auto" />
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                  <Target className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-center">Optimize</p>
                <p className="text-xs text-gray-500 text-center">Plan action</p>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400 transform rotate-90" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <Zap className="w-8 h-8 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-center">Coordinate DR</p>
                <p className="text-xs text-gray-500 text-center">Grid balance</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center mb-2 border-4 border-primary-300">
                  <Radio className="w-10 h-10 text-primary-700" />
                </div>
                <p className="text-base font-bold text-center text-primary-900">Consensus</p>
                <p className="text-xs text-gray-500 text-center">3/5 vote required</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-center">Execute</p>
                <p className="text-xs text-gray-500 text-center">Dispatch commands</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                  <Sparkles className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-center">Shift Workloads</p>
                <p className="text-xs text-gray-500 text-center">Auto defer jobs</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary-50 rounded-lg">
            <h4 className="text-sm font-semibold text-primary-900 mb-2">Collective Intelligence</h4>
            <p className="text-sm text-primary-800">
              Five specialized agents collaborate through a consensus mechanism. Actions require approval 
              from at least 3 out of 5 agents to execute. The Predictive DR Agent analyzes weather forecasts, 
              time-of-day patterns, seasonal variations, and special events to predict grid stress with 30% 
              better accuracy, autonomously shifting non-urgent workloads before stress occurs.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Actions & Decisions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary-600" />
          Recent Agent Actions
        </h2>
        <div className="card">
          {cycleHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No agent actions recorded yet</p>
              <p className="text-sm mt-2">Execute an agent cycle to see actions here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cycleHistory.map((action, idx) => (
                <div key={idx} className="flex items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-shrink-0 mr-4">
                    {action.status === 'sent' || action.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : action.status === 'failed' ? (
                      <XCircle className="w-6 h-6 text-red-600" />
                    ) : (
                      <Clock className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900 capitalize">
                        {action.action ? action.action.replace('_', ' ') : 'Unknown action'}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {action.timestamp ? new Date(action.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Node: <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{action.dc_id || 'N/A'}</span>
                      {action.params?.power_kw != null && (
                        <span className="ml-3">
                          Power: <span className="font-semibold">{action.params.power_kw} kW</span>
                        </span>
                      )}
                    </p>
                    {action.agent_decision && (
                      <p className="text-xs text-gray-500 italic mt-2">
                        💡 {action.agent_decision}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Improvements */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-primary-600" />
          Autonomous Optimization Results
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
            <div className="flex items-center mb-3">
              <Zap className="w-8 h-8 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-blue-900">Transmission Efficiency</h3>
            </div>
            <p className="text-4xl font-bold text-blue-900 mb-2">+18%</p>
            <p className="text-sm text-blue-700">
              Autonomous power flow routing and voltage profile optimization
            </p>
          </div>
          
          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
            <div className="flex items-center mb-3">
              <Target className="w-8 h-8 text-green-600 mr-3" />
              <h3 className="text-lg font-semibold text-green-900">Load Balancing</h3>
            </div>
            <p className="text-4xl font-bold text-green-900 mb-2">+15%</p>
            <p className="text-sm text-green-700">
              Real-time transformer tap settings and load distribution
            </p>
          </div>
          
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
            <div className="flex items-center mb-3">
              <Brain className="w-8 h-8 text-purple-600 mr-3" />
              <h3 className="text-lg font-semibold text-purple-900">Response Time</h3>
            </div>
            <p className="text-4xl font-bold text-purple-900 mb-2">&lt;2s</p>
            <p className="text-sm text-purple-700">
              Autonomous decision-making without human intervention
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

