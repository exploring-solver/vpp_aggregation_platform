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
    
    // Calculate average load factor from nodes
    let loadSum = 0;
    let loadCount = 0;
    if (vppState.nodes && vppState.nodes.length > 0) {
      vppState.nodes.forEach(node => {
        if (node.load_factor !== undefined) {
          loadSum += node.load_factor;
          loadCount++;
        }
      });
      if (loadCount > 0) {
        aggregateData.avg_load_factor = loadSum / loadCount;
      }
    }
    
    // Calculate revenue and environmental impact (approximate)
    const pricePerKwh = parseFloat(process.env.PRICE_PER_KWH || '5'); // ₹5 per kWh default
    const hoursPerDay = 24;
    const co2PerKwh = parseFloat(process.env.CO2_PER_KWH || '0.82'); // kg CO2 per kWh default
    
    aggregateData.revenue_today = Math.round(aggregateData.total_power_kw * hoursPerDay * pricePerKwh);
    aggregateData.co2_saved = parseFloat((aggregateData.total_power_kw * hoursPerDay * co2PerKwh / 1000).toFixed(1)); // Convert to tonnes
    
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

