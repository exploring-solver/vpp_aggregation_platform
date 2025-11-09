import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { vendorAuth } from '../services/auth'
import { 
  DollarSign, Plus, Edit, Trash2, CheckCircle, XCircle, Clock,
  TrendingUp, BarChart3, LogOut, Building2
} from 'lucide-react'

export default function Marketplace() {
  const [bids, setBids] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBidForm, setShowBidForm] = useState(false)
  const [editingBid, setEditingBid] = useState(null)
  const [bidForm, setBidForm] = useState({
    service_type: 'SRAS',
    capacity_mw: '',
    price_per_mw: '',
    duration_minutes: '60',
    market_type: 'intraday'
  })
  const navigate = useNavigate()
  const vendor = vendorAuth.getCurrentVendor()

  useEffect(() => {
    if (!vendorAuth.isAuthenticated()) {
      navigate('/login')
      return
    }
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const [bidsRes, transactionsRes] = await Promise.all([
        vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/bids?limit=50`),
        vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/transactions?limit=50`)
      ])

      if (bidsRes.ok) {
        const bidsData = await bidsRes.json()
        setBids(bidsData.data || [])
      }

      if (transactionsRes.ok) {
        const txnData = await transactionsRes.json()
        setTransactions(txnData.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBid = async (e) => {
    e.preventDefault()
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/bids`, {
        method: 'POST',
        body: JSON.stringify(bidForm)
      })

      if (response.ok) {
        setShowBidForm(false)
        setBidForm({
          service_type: 'SRAS',
          capacity_mw: '',
          price_per_mw: '',
          duration_minutes: '60',
          market_type: 'intraday'
        })
        await fetchData()
        alert('Bid created successfully!')
      } else {
        const error = await response.json()
        alert('Failed to create bid: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error creating bid: ' + error.message)
    }
  }

  const handleUpdateBid = async (bidId) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/bids/${bidId}`, {
        method: 'PUT',
        body: JSON.stringify({
          capacity_mw: bidForm.capacity_mw,
          price_per_mw: bidForm.price_per_mw,
          duration_minutes: bidForm.duration_minutes
        })
      })

      if (response.ok) {
        setEditingBid(null)
        setShowBidForm(false)
        await fetchData()
        alert('Bid updated successfully!')
      } else {
        const error = await response.json()
        alert('Failed to update bid: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error updating bid: ' + error.message)
    }
  }

  const handleDeleteBid = async (bidId) => {
    if (!confirm('Are you sure you want to delete this bid?')) return

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/bids/${bidId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchData()
        alert('Bid deleted successfully!')
      } else {
        const error = await response.json()
        alert('Failed to delete bid: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error deleting bid: ' + error.message)
    }
  }

  const startEdit = (bid) => {
    setEditingBid(bid.bid_id)
    setBidForm({
      service_type: bid.service_type,
      capacity_mw: bid.capacity_mw,
      price_per_mw: bid.price_per_mw,
      duration_minutes: bid.duration_minutes,
      market_type: bid.market_type || 'intraday'
    })
    setShowBidForm(true)
  }

  const handleLogout = () => {
    vendorAuth.logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const myBids = bids.filter(b => b.vendor_id === vendor?.email)
  const myTransactions = transactions.filter(t => t.vendor_id === vendor?.email)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vendor Marketplace</h1>
              <p className="text-sm text-gray-600">{vendor?.companyName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-gray-700 hover:text-red-600 border border-gray-300 rounded-lg hover:border-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">My Bids</p>
                <p className="text-2xl font-bold text-gray-900">{myBids.length}</p>
              </div>
              <DollarSign className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {myTransactions.filter(t => t.status === 'active' || t.status === 'pending').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{myTransactions
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + (t.total_amount || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Create/Edit Bid Form */}
        {showBidForm && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingBid ? 'Edit Bid' : 'Create New Bid'}
            </h2>
            <form onSubmit={editingBid ? (e) => { e.preventDefault(); handleUpdateBid(editingBid) } : handleCreateBid} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
                <select
                  value={bidForm.service_type}
                  onChange={(e) => setBidForm({...bidForm, service_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="SRAS">SRAS</option>
                  <option value="TRAS">TRAS</option>
                  <option value="DR">Demand Response</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Market Type</label>
                <select
                  value={bidForm.market_type}
                  onChange={(e) => setBidForm({...bidForm, market_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="day_ahead">Day Ahead</option>
                  <option value="intraday">Intraday</option>
                  <option value="balancing">Balancing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (MW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={bidForm.capacity_mw}
                  onChange={(e) => setBidForm({...bidForm, capacity_mw: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹/MW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={bidForm.price_per_mw}
                  onChange={(e) => setBidForm({...bidForm, price_per_mw: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={bidForm.duration_minutes}
                  onChange={(e) => setBidForm({...bidForm, duration_minutes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="1"
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  {editingBid ? 'Update Bid' : 'Create Bid'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBidForm(false)
                    setEditingBid(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Bids */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Bids</h2>
            {!showBidForm && (
              <button
                onClick={() => setShowBidForm(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Bid
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {myBids.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No bids yet</p>
                <button
                  onClick={() => setShowBidForm(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-700"
                >
                  Create your first bid
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bid ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myBids.map((bid) => (
                      <tr key={bid.bid_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono">{bid.bid_id}</td>
                        <td className="px-6 py-4 text-sm capitalize">{bid.market_type || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm">{bid.service_type}</td>
                        <td className="px-6 py-4 text-sm">{bid.capacity_mw?.toFixed(2)} MW</td>
                        <td className="px-6 py-4 text-sm">₹{bid.price_per_mw?.toFixed(2)}/MW</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            bid.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            bid.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {bid.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {bid.created_at ? new Date(bid.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center space-x-2">
                            {bid.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => startEdit(bid)}
                                  className="p-1 text-indigo-600 hover:text-indigo-700"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBid(bid.bid_id)}
                                  className="p-1 text-red-600 hover:text-red-700"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* My Transactions */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">My Transactions</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {myTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myTransactions.map((txn) => (
                      <tr key={txn.transaction_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono">{txn.transaction_id}</td>
                        <td className="px-6 py-4 text-sm">{txn.capacity_mw?.toFixed(2)} MW</td>
                        <td className="px-6 py-4 text-sm">₹{txn.price_per_mw?.toFixed(2)}/MW</td>
                        <td className="px-6 py-4 text-sm font-semibold">₹{txn.total_amount?.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            txn.status === 'completed' ? 'bg-green-100 text-green-800' :
                            txn.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {txn.completed_at && txn.started_at ? (
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {Math.round((new Date(txn.completed_at) - new Date(txn.started_at)) / 60000)} min
                            </span>
                          ) : (
                            `${txn.duration_minutes || 0} min`
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
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
      </div>
    </div>
  )
}

