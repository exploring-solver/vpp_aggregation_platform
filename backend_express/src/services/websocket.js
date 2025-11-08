import { subscribeChannel } from './redis.js';
import logger from '../utils/logger.js';

const clients = new Set();

export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected');
    clients.add(ws);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug('WebSocket message received:', data);
        
        // Handle client messages (e.g., subscribe to specific nodes)
        if (data.type === 'subscribe') {
          ws.subscribedNodes = data.nodeIds || [];
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send initial connection success
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString()
    }));
  });

  // Subscribe to Redis channels and broadcast to WebSocket clients
  (async () => {
    try {
      await subscribeChannel('telemetry:new', (data) => {
        broadcastToClients({
          type: 'telemetry',
          data
        });
      });

      await subscribeChannel('dispatch:commands', (data) => {
        broadcastToClients({
          type: 'dispatch',
          data
        });
      });

      await subscribeChannel('vpp:state:update', (data) => {
        broadcastToClients({
          type: 'aggregate',
          data
        });
      });

      await subscribeChannel('dispatch:optimized', (data) => {
        broadcastToClients({
          type: 'dispatch',
          data
        });
      });

      logger.info('WebSocket server configured with Redis subscriptions');
    } catch (err) {
      logger.error('Failed to set up Redis subscriptions:', err);
    }
  })();
}

function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        // Filter by subscribed nodes if applicable
        if (message.type === 'telemetry' && client.subscribedNodes?.length > 0) {
          if (!client.subscribedNodes.includes(message.data.dc_id)) {
            return;
          }
        }
        
        client.send(messageStr);
      } catch (error) {
        logger.error('Error broadcasting to client:', error);
      }
    }
  });
}

export function broadcastMessage(message) {
  broadcastToClients(message);
}
