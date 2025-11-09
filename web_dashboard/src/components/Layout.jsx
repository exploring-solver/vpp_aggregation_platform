import { Outlet, NavLink } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { LayoutDashboard, Server, Send, TrendingUp, LogOut, Grid3x3, Database, Zap, Settings, Brain, Target, Lightbulb, Power, DollarSign } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth0()

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Nodes', to: '/nodes', icon: Server },
    { name: 'Dispatch', to: '/dispatch', icon: Send },
    { name: 'Forecasts', to: '/forecasts', icon: TrendingUp },
    { name: 'AI Agents', to: '/agents', icon: Brain },
    { name: 'Trading', to: '/trading', icon: DollarSign },
    { name: 'DGrid Operator', to: '/dgrid-operator', icon: Grid3x3 },
    { name: 'Data Center Operator', to: '/data-center-operator', icon: Database },
    { name: 'ML Training', to: '/ml-training', icon: Brain },
    { name: 'ML Optimization', to: '/ml-optimization', icon: Target },
    { name: 'ML Insights', to: '/ml-insights', icon: Lightbulb },
    { name: 'ML Control', to: '/ml-control', icon: Power },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white/95 backdrop-blur-sm shadow-2xl border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vusio</h1>
                <p className="text-xs text-primary-100">Grid Flexibility Aggregation</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link ${
                    isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200 bg-gray-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img
                    src={user?.picture || '/default-avatar.png'}
                    alt="User"
                    className="w-12 h-12 rounded-xl ring-2 ring-primary-200"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-grid-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                className="px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 hover:border-red-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-72">
        <main className="min-h-screen p-6 md:p-8 max-w-[1920px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
