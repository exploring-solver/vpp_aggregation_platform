/**
 * WebSocket client service for real-time data updates
 * Connects to backend WebSocket server for live telemetry, dispatch, and aggregate updates
 */

class WebSocketService {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 3000
    this.listeners = new Map()
    this.isConnected = false
    this.wsUrl = null
  }

  connect(wsUrl = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    this.wsUrl = wsUrl || `${import.meta.env.VITE_WS_URL || 'ws://localhost:3001'}`
    
    try {
      this.ws = new WebSocket(this.wsUrl)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit('connected', { timestamp: new Date().toISOString() })
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.emit('error', error)
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.isConnected = false
        this.emit('disconnected')
        this.attemptReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.attemptReconnect()
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect(this.wsUrl)
      }
    }, delay)
  }

  handleMessage(message) {
    const { type, data } = message
    
    // Emit to specific type listeners
    this.emit(type, data)
    
    // Emit to all listeners
    this.emit('*', { type, data })
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType).push(callback)
    
    return () => this.unsubscribe(eventType, callback)
  }

  unsubscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) return
    
    const callbacks = this.listeners.get(eventType)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  emit(eventType, data) {
    const callbacks = this.listeners.get(eventType) || []
    callbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in WebSocket callback for ${eventType}:`, error)
      }
    })
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  subscribeToNodes(nodeIds) {
    this.send({
      type: 'subscribe',
      nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds]
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
    this.isConnected = false
  }
}

// Export singleton instance
export default new WebSocketService()

