import { useState, useEffect } from 'react'
import { Settings, Key, Upload, CheckCircle2, XCircle, Eye, EyeOff, Loader } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function SSHConfig({ dcId, onConfigUpdated }) {
  const [config, setConfig] = useState({
    host: '',
    port: 22,
    username: '',
    password: '',
    usePrivateKey: false,
    privateKey: '',
    passphrase: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [pemFile, setPemFile] = useState(null)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/config`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const data = await response.json()
        if (data.data) {
          setConfig(prev => ({
            ...prev,
            host: data.data.host || '',
            port: data.data.port || 22,
            username: data.data.username || '',
            password: data.data.has_password ? '••••••••' : '',
            usePrivateKey: data.data.has_private_key || false
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching SSH config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePemFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPemFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setConfig(prev => ({
          ...prev,
          privateKey: event.target.result,
          usePrivateKey: true
        }))
      }
      reader.readAsText(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    // Validate required fields
    if (!config.host || !config.username) {
      setError('Host and Username are required')
      setSaving(false)
      return
    }

    // Validate authentication method
    if (!config.usePrivateKey && !config.password) {
      setError('Either password or private key must be provided')
      setSaving(false)
      return
    }

    if (config.usePrivateKey && !config.privateKey) {
      setError('Please upload a PEM file or provide a private key')
      setSaving(false)
      return
    }

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/config`
      const payload = {
        ssh_config: {
          host: config.host.trim(),
          port: parseInt(config.port) || 22,
          username: config.username.trim(),
          usePrivateKey: config.usePrivateKey
        }
      }

      // Add password if provided and not masked
      if (!config.usePrivateKey && config.password && config.password !== '••••••••') {
        payload.ssh_config.password = config.password
      }

      // Add private key if using key authentication
      if (config.usePrivateKey && config.privateKey) {
        payload.ssh_config.private_key = config.privateKey.trim()
        if (config.passphrase && config.passphrase.trim()) {
          payload.ssh_config.passphrase = config.passphrase
        }
      }

      const response = await makeApiCall(apiUrl, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(true)
        setError(null)
        
        // Update local config state to reflect saved state
        if (data.data) {
          setConfig(prev => ({
            ...prev,
            host: data.data.host || prev.host,
            port: data.data.port || prev.port,
            username: data.data.username || prev.username,
            usePrivateKey: data.data.has_private_key || prev.usePrivateKey,
            password: data.data.has_password ? '••••••••' : prev.password
          }))
        }
        
        if (onConfigUpdated) {
          onConfigUpdated()
        }
        setTimeout(() => setSuccess(false), 3000)
        
        // Refresh the config to show updated state
        await fetchConfig()
      } else {
        let errorMsg = 'Failed to save configuration'
        try {
          const data = await response.json()
          errorMsg = data.error || data.message || errorMsg
          console.error('SSH config save error:', data)
        } catch (parseError) {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`
          console.error('SSH config save error (unparseable):', response)
        }
        setError(errorMsg)
      }
    } catch (error) {
      // Handle Auth0 errors specifically
      if (error.message?.includes('Refresh Token') || error.message?.includes('missing_refresh_token')) {
        setError('Authentication error: Please refresh the page and try again.')
      } else {
        setError(error.message || 'Failed to save configuration')
      }
      console.error('SSH config save exception:', error)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/test`
      const response = await makeApiCall(apiUrl, { method: 'POST' })
      const data = await response.json()
      
      if (data.success && data.data?.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.data?.error || 'Connection test failed')
      }
    } catch (error) {
      setError(error.message || 'Connection test failed')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !config.host) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">SSH Configuration</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 rounded-lg flex items-start">
          <XCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-400 rounded-lg flex items-start">
          <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Success</p>
            <p className="text-xs text-green-600 mt-1">Configuration saved successfully!</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host / IP Address *
            </label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
              placeholder="192.168.1.100"
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port *
            </label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))}
              placeholder="22"
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username *
          </label>
          <input
            type="text"
            value={config.username}
            onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
            placeholder="pi or ubuntu"
            className="input"
            required
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="usePrivateKey"
              checked={config.usePrivateKey}
              onChange={(e) => setConfig(prev => ({ ...prev, usePrivateKey: e.target.checked }))}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="usePrivateKey" className="text-sm font-medium text-gray-700">
              Use SSH Private Key (PEM file)
            </label>
          </div>

          {config.usePrivateKey ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload PEM File
                </label>
                <div className="flex items-center space-x-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept=".pem,.key"
                      onChange={handlePemFileUpload}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors">
                      <Upload className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        {pemFile ? pemFile.name : 'Click to upload PEM file'}
                      </span>
                    </div>
                  </label>
                </div>
                {config.privateKey && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    ✓ PEM file loaded ({config.privateKey.split('\n').length} lines)
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passphrase (if key is encrypted)
                </label>
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={config.passphrase}
                    onChange={(e) => setConfig(prev => ({ ...prev, passphrase: e.target.value }))}
                    placeholder="Enter passphrase if required"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={loading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Test Connection</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

