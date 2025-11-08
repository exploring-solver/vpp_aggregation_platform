import { getCollection } from '../database.js';
import { cacheGet, cacheSet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';

/**
 * Enhanced Data Aggregation Layer
 * Aggregates power availability, SOC, and grid frequency across sites
 * Maintains real-time Virtual Plant State
 */
export class DataAggregator {
  constructor() {
    this.updateInterval = 5000; // 5 seconds
    this.cacheTTL = 10; // 10 seconds
  }

  /**
   * Get aggregated Virtual Plant State
   */
  async getVirtualPlantState(region = null, nodeIds = null) {
    try {
      const cacheKey = `vpp:state:${region || 'all'}:${nodeIds ? nodeIds.join(',') : 'all'}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return cached;
      }

      const nodesCollection = getCollection('nodes');
      let query = {};
      
      if (nodeIds) {
        const ids = Array.isArray(nodeIds) ? nodeIds : nodeIds.split(',');
        query.dc_id = { $in: ids };
      }
      
      if (region) {
        query.region = region;
      }

      const nodes = await nodesCollection.find(query).toArray();
      
      const vppState = {
        timestamp: new Date().toISOString(),
        total_capacity_mw: 0,
        total_battery_kwh: 0,
        available_reserve_mw: 0,
        committed_reserve_mw: 0,
        total_power_kw: 0,
        avg_soc: 0,
        avg_frequency: 49.98,
        node_count: nodes.length,
        online_nodes: 0,
        location_flexibility: {},
        nodes: []
      };

      let socSum = 0;
      let freqSum = 0;
      let validNodes = 0;

      // Aggregate data from each node
      for (const node of nodes) {
        const lastState = await cacheGet(`node:${node.dc_id}:last_state`);
        
        // Add to totals - use node capacity or calculate from power if missing
        const nodeCapacityKw = node.capacity_kw || (lastState?.power_kw ? lastState.power_kw * 1.5 : 150);
        const nodeBatteryKwh = node.battery_kwh || (lastState?.meta?.battery_kwh || 200);
        
        vppState.total_capacity_mw += nodeCapacityKw / 1000;
        vppState.total_battery_kwh += nodeBatteryKwh;
        
        if (lastState) {
          vppState.online_nodes++;
          const powerKw = lastState.power_kw || 0;
          vppState.total_power_kw += powerKw;
          
          // Calculate available reserve (based on SOC and capacity)
          const nodeCapacityMw = (node.capacity_kw || 0) / 1000;
          const soc = lastState.soc || 0;
          
          // Available reserve = capacity * (1 - current_load_ratio)
          // Simplified: assume 50% of capacity can be used for reserves
          const availableMw = nodeCapacityMw * 0.5 * (soc / 100);
          vppState.available_reserve_mw += availableMw;
          
          // Location-based flexibility
          const location = node.location || 'unknown';
          if (!vppState.location_flexibility[location]) {
            vppState.location_flexibility[location] = {
              capacity_mw: 0,
              available_mw: 0,
              node_count: 0
            };
          }
          vppState.location_flexibility[location].capacity_mw += nodeCapacityMw;
          vppState.location_flexibility[location].available_mw += availableMw;
          vppState.location_flexibility[location].node_count++;
          
          // Calculate averages
          if (lastState.soc !== undefined) {
            socSum += lastState.soc;
            validNodes++;
          }
          if (lastState.freq !== undefined) {
            freqSum += lastState.freq;
          }
          
          vppState.nodes.push({
            dc_id: node.dc_id,
            location: node.location,
            power_kw: powerKw,
            soc: lastState.soc,
            freq: lastState.freq,
            available_reserve_mw: availableMw,
            timestamp: lastState.timestamp
          });
        }
      }

      // Calculate averages
      if (validNodes > 0) {
        vppState.avg_soc = socSum / validNodes;
        vppState.avg_frequency = freqSum / validNodes;
      }

      // Calculate committed reserve (from active dispatch commands)
      const dispatchCollection = getCollection('dispatch_log');
      const activeDispatches = await dispatchCollection.find({
        status: 'active',
        timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
      }).toArray();
      
      vppState.committed_reserve_mw = activeDispatches.reduce((sum, dispatch) => {
        return sum + ((dispatch.params?.power_kw || 0) / 1000);
      }, 0);

      // Frequency status
      vppState.freq_status = 
        vppState.avg_frequency < 49.8 ? 'low' :
        vppState.avg_frequency > 50.2 ? 'high' : 'normal';

      // Cache result
      await cacheSet(cacheKey, vppState, this.cacheTTL);
      
      // Publish update
      await publishMessage('vpp:state:update', vppState);
      
      logger.debug(`Virtual Plant State computed: ${vppState.online_nodes}/${vppState.node_count} nodes, ${vppState.total_power_kw.toFixed(2)} kW`);
      
      return vppState;
    } catch (error) {
      logger.error('Error computing Virtual Plant State:', error);
      throw error;
    }
  }

  /**
   * Get historical aggregation for ML training
   */
  async getHistoricalAggregation(startTime, endTime, intervalMinutes = 15) {
    try {
      const telemetryCollection = getCollection('telemetry');
      
      const pipeline = [
        {
          $match: {
            timestamp: {
              $gte: startTime,
              $lte: endTime
            }
          }
        },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: '$timestamp',
                unit: 'minute',
                binSize: intervalMinutes
              }
            },
            avg_power_kw: { $avg: '$power_kw' },
            avg_soc: { $avg: '$soc' },
            avg_freq: { $avg: '$freq' },
            node_count: { $addToSet: '$dc_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            timestamp: '$_id',
            avg_power_kw: 1,
            avg_soc: 1,
            avg_freq: 1,
            node_count: { $size: '$node_count' },
            count: 1
          }
        },
        {
          $sort: { timestamp: 1 }
        }
      ];

      const results = await telemetryCollection.aggregate(pipeline).toArray();
      
      return results;
    } catch (error) {
      logger.error('Error getting historical aggregation:', error);
      throw error;
    }
  }
}

export default new DataAggregator();

