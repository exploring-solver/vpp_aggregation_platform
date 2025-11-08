import { useState, useEffect, useRef } from 'react'
import { Terminal, Send, XCircle, CheckCircle2, Loader } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function SSHTerminal({ dcId }) {
  const [output, setOutput] = useState('')
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputEndRef = useRef(null)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    setOutput('$ ')
    testConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId])

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  const testConnection = async () => {
    setLoading(true)
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/test`
      const response = await makeApiCall(apiUrl, { method: 'POST' })
      
      if (!response.ok) {
        // Try to parse error response
        let errorMsg = 'Connection test failed'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || errorMsg
        } catch {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`
        }
        
        setOutput(prev => prev + `\n❌ SSH connection failed: ${errorMsg}\n$ `)
        if (errorMsg.includes('SSH configuration') || errorMsg.includes('not have SSH')) {
          setOutput(prev => prev + `💡 Tip: Configure SSH access in the "SSH Config" tab first.\n$ `)
        }
        setConnected(false)
        return
      }
      
      const data = await response.json()
      const isConnected = data.success && data.data?.success
      setConnected(isConnected)
      
      if (isConnected) {
        setOutput(prev => prev + `\n✅ SSH connection established to ${dcId}\n$ `)
      } else {
        const errorMsg = data.data?.error || data.data?.message || 'Unknown error'
        setOutput(prev => prev + `\n❌ SSH connection failed: ${errorMsg}\n$ `)
        if (errorMsg.includes('SSH configuration') || errorMsg.includes('not have SSH')) {
          setOutput(prev => prev + `💡 Tip: Configure SSH access in the "SSH Config" tab first.\n$ `)
        }
      }
    } catch (error) {
      // Handle Auth0 errors specifically
      if (error.message?.includes('Refresh Token') || error.message?.includes('missing_refresh_token')) {
        setOutput(prev => prev + `\n❌ Authentication error: Please refresh the page and try again.\n$ `)
      } else {
        setOutput(prev => prev + `\n❌ Connection test error: ${error.message}\n$ `)
        setOutput(prev => prev + `💡 Tip: Make sure SSH configuration is set up for this node.\n$ `)
      }
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const executeCommand = async () => {
    if (!command.trim()) return

    setLoading(true)
    const cmd = command.trim()
    setCommand('')
    
    // Add command to history
    setHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    
    // Display command in output
    setOutput(prev => prev + `$ ${cmd}\n`)

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/command`
      const response = await makeApiCall(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          command: cmd,
          cwd: '~',
          pty: true
        })
      })

      const data = await response.json()
      
      if (data.success && data.data?.success) {
        setOutput(prev => prev + (data.data.stdout || '') + '\n')
        if (data.data.stderr) {
          setOutput(prev => prev + `[stderr] ${data.data.stderr}\n`)
        }
      } else {
        setOutput(prev => prev + `[Error] ${data.data?.stderr || data.data?.error || 'Command failed'}\n`)
      }
    } catch (error) {
      setOutput(prev => prev + `[Error] ${error.message}\n`)
    } finally {
      setLoading(false)
      setOutput(prev => prev + '$ ')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommand(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1
        if (newIndex >= history.length) {
          setHistoryIndex(-1)
          setCommand('')
        } else {
          setHistoryIndex(newIndex)
          setCommand(history[newIndex])
        }
      }
    }
  }

  const clearTerminal = () => {
    setOutput('$ ')
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">SSH Terminal</h3>
            <div className="flex items-center space-x-2 mt-1">
              {connected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={testConnection}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Test Connection
          </button>
          <button
            onClick={clearTerminal}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 min-h-[400px] max-h-[600px] overflow-y-auto">
        <pre className="whitespace-pre-wrap break-words">{output}</pre>
        <div ref={outputEndRef} />
      </div>

      <div className="mt-4 flex items-center space-x-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter command..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white font-mono text-sm"
          disabled={loading}
        />
        <button
          onClick={executeCommand}
          disabled={loading || !connected}
          className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Execute</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <p>💡 Tip: Use ↑/↓ arrow keys to navigate command history</p>
        {!connected && (
          <p className="text-amber-600">
            ⚠️ Not connected. Configure SSH access in the "SSH Config" tab first.
          </p>
        )}
      </div>
    </div>
  )
}

