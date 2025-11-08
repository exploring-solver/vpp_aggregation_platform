import { useEffect, useState } from 'react'
import { Activity, Battery, Zap, Server } from 'lucide-react'

export default function Dashboard() {
  const [aggregateData, setAggregateData] = useState(null)
  const [loading, setLoading] = useState(true)

  // TODO: Connect to WebSocket for real-time updates
  // TODO: Fetch aggregate data from API

  useEffect(() => {
    // Placeholder - implement API call
    setTimeout(() => {
      setAggregateData({
        total_power_kw: 245.8,
        avg_soc: 78.5,
        avg_freq: 49.98,
        node_count: 2,
        online_nodes: 2,
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  const stats = [
    {
      name: 'Total Power',
      value: `${aggregateData.total_power_kw} kW`,
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Average SOC',
      value: `${aggregateData.avg_soc}%`,
      icon: Battery,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Grid Frequency',
      value: `${aggregateData.avg_freq} Hz`,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Online Nodes',
      value: `${aggregateData.online_nodes}/${aggregateData.node_count}`,
      icon: Server,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Virtual Plant Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Power Output (24h)</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            Chart placeholder - implement with Recharts
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">SOC Levels</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            Chart placeholder - implement with Recharts
          </div>
        </div>
      </div>
    </div>
  )
}
