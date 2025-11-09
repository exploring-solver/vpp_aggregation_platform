import express from 'express';
import { getCollection } from '../services/database.js';
import { publishToNode } from '../services/mqtt.js';
import { publishMessage } from '../services/redis.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/dispatch - Dispatch command to edge nodes (public)
router.post('/', async (req, res) => {
  try {
    const { targets, action, params = {} } = req.body;
    
    if (!targets || !action) {
      return res.status(400).json({ error: 'targets and action are required' });
    }
    
    const allowedActions = ['charge', 'discharge', 'defer_load', 'hold'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get target node IDs
    let nodeIds = [];
    if (targets === 'all') {
      const nodesCollection = getCollection('nodes');
      const nodes = await nodesCollection.find({}).toArray();
      nodeIds = nodes.map(n => n.dc_id);
    } else if (Array.isArray(targets)) {
      nodeIds = targets;
    } else {
      nodeIds = [targets];
    }
    
    // Create dispatch log entries
    const dispatchCollection = getCollection('dispatch_log');
    const timestamp = new Date();
    const dispatchEntries = nodeIds.map(dcId => ({
      dc_id: dcId,
      action,
      params,
      issued_by: 'system',
      operator_email: 'amansharma12607@gmail.com', // Placeholder for data center operator
      timestamp,
      status: 'sent',
      result: {}
    }));
    
    await dispatchCollection.insertMany(dispatchEntries);
    
    // Send commands via MQTT
    const results = await Promise.allSettled(
      nodeIds.map(dcId => publishToNode(dcId, action, params))
    );
    
    // Publish to Redis for real-time updates
    const dispatchData = {
      targets: nodeIds,
      action,
      params,
      timestamp
    };
    await publishMessage('dispatch:commands', dispatchData);
    // Trigger callbacks directly (Redis pub/sub disabled)
    const { triggerChannelCallbacks } = await import('../services/redis.js');
    triggerChannelCallbacks('dispatch:commands', dispatchData);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    
    res.json({
      success: true,
      dispatched: nodeIds.length,
      succeeded: successCount,
      failed: failureCount,
      timestamp
    });
  } catch (error) {
    logger.error('Error dispatching command:', error);
    res.status(500).json({ error: 'Failed to dispatch command' });
  }
});

// GET /api/dispatch/logs - Get dispatch history (public read)
router.get('/logs', async (req, res) => {
  try {
    const { dc_id, limit = 50, status } = req.query;
    const collection = getCollection('dispatch_log');
    
    const query = {};
    if (dc_id) query.dc_id = dc_id;
    if (status) query.status = status;
    
    const logs = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    logger.error('Error fetching dispatch logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
