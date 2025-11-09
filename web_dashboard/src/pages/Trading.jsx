import { useEffect, useState } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, XCircle, 
  Activity, BarChart3, Zap, Brain, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function Trading() {
  const [tradingStrategy, setTradingStrategy] = useState(null)
  const [tradingHistory, setTradingHistory] = useState([])
  const [performance, setPerformance] = useState(null)
  const [bids, setBids] = useState([])
  const [transactions, setTransactions] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const { makeApiCall } = useAuthToken() || {}

  useEffect(() => {
    fetchTradingData()
    const interval = setInterval(() => {
      fetchTradingData()
    }, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchTradingData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Fetch all data in parallel
      const [strategyRes, historyRes, performanceRes, bidsRes, transactionsRes, vendorsRes] = await Promise.all([
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/trading-strategy`) : fetch(`${baseUrl}/api/marketplace/trading-strategy`),
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/trading-history?limit=10`) : fetch(`${baseUrl}/api/marketplace/trading-history?limit=10`),
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/performance`) : fetch(`${baseUrl}/api/marketplace/performance`),
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/bids?limit=20`) : fetch(`${baseUrl}/api/marketplace/bids?limit=20`),
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/transactions?limit=20`) : fetch(`${baseUrl}/api/marketplace/transactions?limit=20`),
        makeApiCall ? makeApiCall(`${baseUrl}/api/marketplace/vendors`) : fetch(`${baseUrl}/api/marketplace/vendors`)
      ])

      if (strategyRes.ok) {
        const strategyData = await strategyRes.json()
        setTradingStrategy(strategyData.data)
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setTradingHistory(historyData.data || [])
      }

      if (performanceRes.ok) {
        const perfData = await performanceRes.json()
        setPerformance(perfData.data)
      }

      if (bidsRes.ok) {
        const bidsData = await bidsRes.json()
        setBids(bidsData.data || [])
      }

      if (transactionsRes.ok) {
        const txnData = await transactionsRes.json()
        setTransactions(txnData.data || [])
      }

      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json()
        setVendors(vendorsData.data || [])
      }
    } catch (error) {
      console.error('Error fetching trading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const executeStrategy = async () => {
    try {
      setExecuting(true)
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await makeApiCall 
        ? makeApiCall(`${baseUrl}/api/marketplace/trading-strategy`, { method: 'POST' })
        : fetch(`${baseUrl}/api/marketplace/trading-strategy`, { 
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })
      
      if (response.ok) {
        const result = await response.json()
        setTradingStrategy(result.data)
        await fetchTradingData()
        alert('Trading strategy executed successfully!')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute strategy')
      }
    } catch (error) {
      console.error('Error executing strategy:', error)
      alert('Failed to execute trading strategy: ' + error.message)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const marketTypes = ['day_ahead', 'intraday', 'balancing']
  const strategies = tradingStrategy?.strategies || {}

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center">
              <Brain className="w-8 h-8 mr-3 text-primary-600" />
              Algorithmic Trading System
            </h1>
            <p className="mt-2 text-gray-600">
              RL-based energy market trading with optimal bidding strategies
            </p>
          </div>
          <button
            onClick={executeStrategy}
            disabled={executing}
            className={`btn ${executing ? 'btn-secondary' : 'btn-primary'} flex items-center`}
          >
            {executing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Execute Trading Strategy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
            RL Agent Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-green-50 to-green-100">
              <p className="text-sm font-medium text-green-800 mb-1">Total Reward</p>
              <p className="text-3xl font-bold text-green-900">
                ₹{typeof performance.totalReward === 'number' ? performance.totalReward.toFixed(0) : 0}
              </p>
              <p className="text-xs text-green-600 mt-1">Cumulative</p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
              <p className="text-sm font-medium text-blue-800 mb-1">Success Rate</p>
              <p className="text-3xl font-bold text-blue-900">
                {typeof performance.successRate === 'number' ? (performance.successRate * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-blue-600 mt-1">Bid acceptance</p>
            </div>
            <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
              <p className="text-sm font-medium text-purple-800 mb-1">Total Bids</p>
              <p className="text-3xl font-bold text-purple-900">
                {performance.totalBids || 0}
              </p>
              <p className="text-xs text-purple-600 mt-1">Placed by agent</p>
            </div>
            <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
              <p className="text-sm font-medium text-orange-800 mb-1">Q-Table Size</p>
              <p className="text-3xl font-bold text-orange-900">
                {performance.qTableSize || 0}
              </p>
              <p className="text-xs text-orange-600 mt-1">Learned states</p>
            </div>
          </div>
        </div>
      )}

      {/* Market Strategies */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary-600" />
          Current Trading Strategies
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {marketTypes.map(marketType => {
            const strategy = strategies[marketType]
            if (!strategy) return null

            return (
              <div key={marketType} className="card border-l-4 border-indigo-500">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {marketType.replace('_', ' ')} Market
                    </h3>
                    <p className="text-sm text-gray-600">RL-based bidding strategy</p>
                  </div>
                  <span className={`badge ${
                    strategy.action === 'buy' ? 'badge-success' :
                    strategy.action === 'sell' ? 'badge-warning' : 'badge-secondary'
                  }`}>
                    {strategy.action?.toUpperCase() || 'HOLD'}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Recommended Action</p>
                    <p className="text-lg font-bold text-gray-900 capitalize">
                      {strategy.action || 'hold'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{strategy.reasoning}</p>
                  </div>
                  {strategy.bidParams && strategy.bidParams.capacity_mw > 0 && (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Capacity</p>
                        <p className="text-xl font-bold text-gray-900">
                          {strategy.bidParams.capacity_mw.toFixed(2)} MW
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Price</p>
                        <p className="text-xl font-bold text-gray-900">
                          ₹{strategy.bidParams.price_per_mw.toFixed(2)}/MW
                        </p>
                      </div>
                    </>
                  )}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Expected Reward</p>
                    <p className="text-xl font-bold text-green-600">
                      ₹{typeof strategy.expectedReward === 'number' ? strategy.expectedReward.toFixed(2) : 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {(strategy.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Bids */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-primary-600" />
          Active Bids
        </h2>
        <div className="card">
          {bids.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active bids</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Bid ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Market</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Capacity</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Placed By</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono">{bid.bid_id}</td>
                      <td className="py-3 px-4 text-sm capitalize">{bid.market_type || bid.rl_strategy?.marketType || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`badge ${
                          bid.rl_strategy?.action === 'buy' ? 'badge-success' :
                          bid.rl_strategy?.action === 'sell' ? 'badge-warning' : 'badge-secondary'
                        }`}>
                          {bid.rl_strategy?.action?.toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{bid.capacity_mw?.toFixed(2) || 0} MW</td>
                      <td className="py-3 px-4 text-sm">₹{bid.price_per_mw?.toFixed(2) || 0}/MW</td>
                      <td className="py-3 px-4 text-sm">
                        {bid.placed_by === 'rl_agent' ? (
                          <span className="flex items-center">
                            <Brain className="w-4 h-4 mr-1 text-indigo-600" />
                            RL Agent
                          </span>
                        ) : (
                          bid.vendor_name || bid.placed_by || 'System'
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`badge ${
                          bid.status === 'accepted' ? 'badge-success' :
                          bid.status === 'pending' ? 'badge-warning' :
                          bid.status === 'rejected' ? 'badge-danger' : 'badge-secondary'
                        }`}>
                          {bid.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {bid.created_at ? new Date(bid.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-primary-600" />
          Recent Transactions
        </h2>
        <div className="card">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Transaction ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vendor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Capacity</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono">{txn.transaction_id}</td>
                      <td className="py-3 px-4 text-sm">{txn.vendor_id || 'System'}</td>
                      <td className="py-3 px-4 text-sm">{txn.capacity_mw?.toFixed(2) || 0} MW</td>
                      <td className="py-3 px-4 text-sm">₹{txn.price_per_mw?.toFixed(2) || 0}/MW</td>
                      <td className="py-3 px-4 text-sm font-semibold">₹{txn.total_amount?.toFixed(2) || 0}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`badge ${
                          txn.status === 'completed' ? 'badge-success' :
                          txn.status === 'active' ? 'badge-info' :
                          txn.status === 'pending' ? 'badge-warning' : 'badge-secondary'
                        }`}>
                          {txn.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {txn.completed_at && txn.started_at ? (
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {Math.round((new Date(txn.completed_at) - new Date(txn.started_at)) / 60000)} min
                          </span>
                        ) : (
                          `${txn.duration_minutes || 0} min`
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Vendors */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-primary-600" />
          Active Vendors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vendors.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vendors registered</p>
            </div>
          ) : (
            vendors.map((vendor, idx) => (
              <div key={idx} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{vendor.companyName}</h3>
                    <p className="text-sm text-gray-600">{vendor.contactName}</p>
                    <p className="text-xs text-gray-500 mt-1">{vendor.email}</p>
                  </div>
                  <span className="badge badge-success">Active</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

