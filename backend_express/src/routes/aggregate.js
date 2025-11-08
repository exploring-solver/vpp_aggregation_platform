import express from 'express';
import dataAggregator from '../services/aggregation/dataAggregator.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/aggregate - Get aggregated virtual plant statistics
router.get('/', async (req, res) => {
  try {
    const { region, nodeIds } = req.query;
    
    // Use enhanced Data Aggregator
    const nodeIdsArray = nodeIds ? (Array.isArray(nodeIds) ? nodeIds : nodeIds.split(',')) : null;
    const vppState = await dataAggregator.getVirtualPlantState(region, nodeIdsArray);
    
    // Convert to legacy format for backward compatibility
    const aggregateData = {
      timestamp: vppState.timestamp,
      node_count: vppState.node_count,
      total_capacity_kw: vppState.total_capacity_mw * 1000,
      total_battery_kwh: vppState.total_battery_kwh,
      total_power_kw: vppState.total_power_kw,
      avg_soc: vppState.avg_soc,
      avg_freq: vppState.avg_frequency,
      online_nodes: vppState.online_nodes,
      freq_status: vppState.freq_status,
      // Enhanced fields
      available_reserve_mw: vppState.available_reserve_mw,
      committed_reserve_mw: vppState.committed_reserve_mw,
      location_flexibility: vppState.location_flexibility,
      nodes: vppState.nodes
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

// GET /api/aggregate/vpp-state - Get full Virtual Plant State (enhanced)
router.get('/vpp-state', async (req, res) => {
  try {
    const { region, nodeIds } = req.query;
    const nodeIdsArray = nodeIds ? (Array.isArray(nodeIds) ? nodeIds : nodeIds.split(',')) : null;
    
    const vppState = await dataAggregator.getVirtualPlantState(region, nodeIdsArray);
    res.json({ success: true, data: vppState });
  } catch (error) {
    logger.error('Error getting VPP state:', error);
    res.status(500).json({ error: 'Failed to get VPP state' });
  }
});

export default router;
