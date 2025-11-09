import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { vendorAuth } from '../services/auth'
import { 
  DollarSign, Plus, Edit, Trash2, CheckCircle, XCircle, Clock,
  TrendingUp, BarChart3, LogOut, Building2, Users
} from 'lucide-react'

export default function Marketplace() {
  const [contracts, setContracts] = useState([])
  const [bids, setBids] = useState([]) // Bids on my contracts
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showContractForm, setShowContractForm] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [selectedContract, setSelectedContract] = useState(null)
  const [contractForm, setContractForm] = useState({
    title: '',
    description: '',
    required_capacity_mw: '',
    max_price_per_mw: '',
    duration_minutes: '60',
    contract_type: 'energy_supply'
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
      
      const [contractsRes, transactionsRes] = await Promise.all([
        vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/contracts?limit=50`),
        vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/transactions?limit=50`)
      ])

      if (contractsRes.ok) {
        const contractsData = await contractsRes.json()
        setContracts(contractsData.data || [])
        
        // Fetch bids for all open contracts
        const openContracts = (contractsData.data || []).filter(c => c.status === 'open')
        const bidsPromises = openContracts.map(contract =>
          vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/contracts/${contract.contract_id}/bids`)
        )
        const bidsResponses = await Promise.all(bidsPromises)
        const allBids = []
        
        for (let idx = 0; idx < bidsResponses.length; idx++) {
          const response = bidsResponses[idx]
          if (response.ok) {
            const bidsData = await response.json()
            const contractBids = (bidsData.data || []).map(bid => ({
              ...bid,
              contract_id: openContracts[idx].contract_id,
              contract_title: openContracts[idx].title
            }))
            allBids.push(...contractBids)
          }
        }
        setBids(allBids)
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

  const handleCreateContract = async (e) => {
    e.preventDefault()
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractForm)
      })

      if (response.ok) {
        setShowContractForm(false)
        setContractForm({
          title: '',
          description: '',
          required_capacity_mw: '',
          max_price_per_mw: '',
          duration_minutes: '60',
          contract_type: 'energy_supply'
        })
        await fetchData()
        alert('Energy contract created successfully!')
      } else {
        const error = await response.json()
        alert('Failed to create contract: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error creating contract: ' + error.message)
    }
  }

  const handleUpdateContract = async (contractId) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/contracts/${contractId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: contractForm.title,
          description: contractForm.description,
          required_capacity_mw: contractForm.required_capacity_mw,
          max_price_per_mw: contractForm.max_price_per_mw,
          duration_minutes: contractForm.duration_minutes
        })
      })

      if (response.ok) {
        setEditingContract(null)
        setShowContractForm(false)
        await fetchData()
        alert('Contract updated successfully!')
      } else {
        const error = await response.json()
        alert('Failed to update contract: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error updating contract: ' + error.message)
    }
  }

  const handleDeleteContract = async (contractId) => {
    if (!confirm('Are you sure you want to delete this contract?')) return

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/contracts/${contractId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchData()
        alert('Contract deleted successfully!')
      } else {
        const error = await response.json()
        alert('Failed to delete contract: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error deleting contract: ' + error.message)
    }
  }

  const handleAcceptBid = async (bidId) => {
    if (!confirm('Accept this bid and create transaction?')) return

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await vendorAuth.makeApiCall(`${baseUrl}/api/marketplace/bids/${bidId}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        await fetchData()
        alert('Bid accepted! Transaction created.')
      } else {
        const error = await response.json()
        alert('Failed to accept bid: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error accepting bid: ' + error.message)
    }
  }

  const startEdit = (contract) => {
    setEditingContract(contract.contract_id)
    setContractForm({
      title: contract.title || '',
      description: contract.description || '',
      required_capacity_mw: contract.required_capacity_mw,
      max_price_per_mw: contract.max_price_per_mw,
      duration_minutes: contract.duration_minutes,
      contract_type: contract.contract_type || 'energy_supply'
    })
    setShowContractForm(true)
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

  const myContracts = contracts.filter(c => c.vendor_id === vendor?.email)
  const myTransactions = transactions.filter(t => t.vendor_id === vendor?.email)
  const openContracts = myContracts.filter(c => c.status === 'open')
  const myBidsOnContracts = bids.filter(b => {
    const contract = contracts.find(c => c.contract_id === b.contract_id)
    return contract && contract.vendor_id === vendor?.email
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Energy Contracts Marketplace</h1>
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
                <p className="text-sm text-gray-600">My Contracts</p>
                <p className="text-2xl font-bold text-gray-900">{myContracts.length}</p>
                <p className="text-xs text-gray-500 mt-1">{openContracts.length} open</p>
              </div>
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Bids</p>
                <p className="text-2xl font-bold text-gray-900">
                  {myBidsOnContracts.filter(b => b.status === 'pending').length}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
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

        {/* Create/Edit Contract Form */}
        {showContractForm && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingContract ? 'Edit Energy Contract' : 'Create New Energy Contract'}
            </h2>
            <form onSubmit={editingContract ? (e) => { e.preventDefault(); handleUpdateContract(editingContract) } : handleCreateContract} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contract Title</label>
                <input
                  type="text"
                  value={contractForm.title}
                  onChange={(e) => setContractForm({...contractForm, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Peak Demand Energy Supply"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={contractForm.duration_minutes}
                  onChange={(e) => setContractForm({...contractForm, duration_minutes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Required Capacity (MW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={contractForm.required_capacity_mw}
                  onChange={(e) => setContractForm({...contractForm, required_capacity_mw: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (₹/MW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={contractForm.max_price_per_mw}
                  onChange={(e) => setContractForm({...contractForm, max_price_per_mw: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={contractForm.description}
                  onChange={(e) => setContractForm({...contractForm, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  placeholder="Describe the energy contract requirements..."
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  {editingContract ? 'Update Contract' : 'Create Contract'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowContractForm(false)
                    setEditingContract(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Contracts */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Energy Contracts</h2>
            {!showContractForm && (
              <button
                onClick={() => setShowContractForm(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Contract
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {myContracts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No contracts yet</p>
                <button
                  onClick={() => setShowContractForm(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-700"
                >
                  Create your first contract
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bids</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myContracts.map((contract) => (
                      <tr key={contract.contract_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono">{contract.contract_id}</td>
                        <td className="px-6 py-4 text-sm">{contract.title || contract.contract_id}</td>
                        <td className="px-6 py-4 text-sm">{contract.required_capacity_mw?.toFixed(2)} MW</td>
                        <td className="px-6 py-4 text-sm">₹{contract.max_price_per_mw?.toFixed(2)}/MW</td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => setSelectedContract(selectedContract === contract.contract_id ? null : contract.contract_id)}
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            {contract.bid_count || 0} bids
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contract.status === 'open' ? 'bg-green-100 text-green-800' :
                            contract.status === 'awarded' ? 'bg-blue-100 text-blue-800' :
                            contract.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {contract.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {contract.created_at ? new Date(contract.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center space-x-2">
                            {contract.status === 'open' && (
                              <>
                                <button
                                  onClick={() => startEdit(contract)}
                                  className="p-1 text-indigo-600 hover:text-indigo-700"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteContract(contract.contract_id)}
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

        {/* Bids on My Contracts */}
        {selectedContract && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Bids on Contract: {contracts.find(c => c.contract_id === selectedContract)?.title || selectedContract}
            </h3>
            {myBidsOnContracts.filter(b => b.contract_id === selectedContract).length === 0 ? (
              <p className="text-gray-500">No bids yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Bid ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Operator</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Capacity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myBidsOnContracts
                      .filter(b => b.contract_id === selectedContract)
                      .map((bid) => (
                        <tr key={bid.bid_id}>
                          <td className="px-4 py-2 text-sm font-mono">{bid.bid_id}</td>
                          <td className="px-4 py-2 text-sm">{bid.operator_email}</td>
                          <td className="px-4 py-2 text-sm">{bid.capacity_mw?.toFixed(2)} MW</td>
                          <td className="px-4 py-2 text-sm">₹{bid.price_per_mw?.toFixed(2)}/MW</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              bid.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {bid.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {bid.status === 'pending' && (
                              <button
                                onClick={() => handleAcceptBid(bid.bid_id)}
                                className="text-green-600 hover:text-green-700"
                              >
                                Accept
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myTransactions.map((txn) => (
                      <tr key={txn.transaction_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono">{txn.transaction_id}</td>
                        <td className="px-6 py-4 text-sm">{txn.operator_email || 'N/A'}</td>
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
