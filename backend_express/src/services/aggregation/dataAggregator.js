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
        
        // Get node capacity (use defaults if missing)
        const nodeCapacityKw = node.capacity_kw || 150; // Default 150kW
        const nodeBatteryKwh = node.battery_kwh || 200; // Default 200kWh
        
        // Add to totals
        vppState.total_capacity_mw += nodeCapacityKw / 1000;
        vppState.total_battery_kwh += nodeBatteryKwh;
        
        if (lastState) {
          vppState.online_nodes++;
          const powerKw = lastState.power_kw || 0;
          vppState.total_power_kw += powerKw;
          
          // Calculate available reserve (based on SOC and capacity)
          const nodeCapacityMw = nodeCapacityKw / 1000;
          const soc = lastState.soc || 50; // Default 50% if missing
          
          // Available reserve calculation:
          // - For discharge: based on SOC and remaining capacity
          // - For charge: based on available battery space
          // Use the minimum of discharge capacity and charge capacity
          const dischargeCapacityMw = nodeCapacityMw * 0.6 * (soc / 100); // 60% of capacity, scaled by SOC
          const chargeCapacityMw = nodeCapacityMw * 0.4 * ((100 - soc) / 100); // 40% of capacity, scaled by available space
          const availableMw = Math.max(dischargeCapacityMw, chargeCapacityMw);
          
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
      // Trigger callbacks directly (Redis pub/sub disabled)
      const { triggerChannelCallbacks } = await import('../redis.js');
      triggerChannelCallbacks('vpp:state:update', vppState);
      
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

