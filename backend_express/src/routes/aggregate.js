import express from 'express';
import { getCollection } from '../services/database.js';
import { cacheGet, cacheSet, publishMessage } from '../services/redis.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/aggregate - Get aggregated virtual plant statistics
router.get('/', async (req, res) => {
  try {
    const { region, nodeIds } = req.query;
    
    // Check cache first
    const cacheKey = `aggregate:${region || 'all'}:${nodeIds || 'all'}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }
    
    // Get all nodes
    const nodesCollection = getCollection('nodes');
    let query = {};
    
    if (nodeIds) {
      const ids = Array.isArray(nodeIds) ? nodeIds : nodeIds.split(',');
      query.dc_id = { $in: ids };
    }
    
    const nodes = await nodesCollection.find(query).toArray();
    
    // Get latest telemetry for each node
    const aggregateData = {
      timestamp: new Date().toISOString(),
      node_count: nodes.length,
      total_capacity_kw: 0,
      total_battery_kwh: 0,
      total_power_kw: 0,
      avg_soc: 0,
      avg_freq: 0,
      avg_load_factor: 0,
      online_nodes: 0,
      nodes: []
    };
    
    let socSum = 0;
    let freqSum = 0;
    let loadSum = 0;
    let validNodes = 0;
    
    for (const node of nodes) {
      const lastState = await cacheGet(`node:${node.dc_id}:last_state`);
      
      aggregateData.total_capacity_kw += node.capacity_kw || 0;
      aggregateData.total_battery_kwh += node.battery_kwh || 0;
      
      if (lastState) {
        aggregateData.online_nodes++;
        aggregateData.total_power_kw += lastState.power_kw || 0;
        
        if (lastState.soc !== undefined) {
          socSum += lastState.soc;
          validNodes++;
        }
        if (lastState.freq !== undefined) {
          freqSum += lastState.freq;
        }
        if (lastState.load_factor !== undefined) {
          loadSum += lastState.load_factor;
        }
        
        aggregateData.nodes.push({
          dc_id: node.dc_id,
          location: node.location,
          power_kw: lastState.power_kw,
          soc: lastState.soc,
          freq: lastState.freq,
          timestamp: lastState.timestamp
        });
      }
    }
    
    if (validNodes > 0) {
      aggregateData.avg_soc = socSum / validNodes;
      aggregateData.avg_freq = freqSum / validNodes;
      aggregateData.avg_load_factor = loadSum / validNodes;
    }
    
    // Frequency status
    aggregateData.freq_status = 
      aggregateData.avg_freq < 49.8 ? 'low' :
      aggregateData.avg_freq > 50.2 ? 'high' : 'normal';
    
    // Calculate revenue and environmental impact (approximate)
    const pricePerKwh = 5; // ₹5 per kWh
    const hoursPerDay = 24;
    const co2PerKwh = 0.82; // kg CO2 per kWh
    
    aggregateData.revenue_today = Math.round(aggregateData.total_power_kw * hoursPerDay * pricePerKwh);
    aggregateData.co2_saved = parseFloat((aggregateData.total_power_kw * hoursPerDay * co2PerKwh / 1000).toFixed(1)); // Convert to tonnes
    
    // Cache result for 10 seconds
    await cacheSet(cacheKey, aggregateData, 10);
    
    // Publish update to Redis
    await publishMessage('aggregate:update', aggregateData);
    
    res.json({ success: true, cached: false, data: aggregateData });
  } catch (error) {
    logger.error('Error computing aggregate:', error);
    res.status(500).json({ error: 'Failed to compute aggregate' });
  }
});

export default router;
