import { BaseAgent } from './BaseAgent.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import { getCollection } from '../database.js';
import { publishToNode } from '../mqtt.js';
import { publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';

/**
 * Demand Response Agent
 * Coordinates demand response events and load deferral
 */
export class DemandResponseAgent extends BaseAgent {
  constructor() {
    super('DemandResponseAgent', {
      updateInterval: 30, // Run every 30 seconds
      drThreshold: 0.75, // Trigger DR if grid stress > 0.75
      minReserveMw: 5 // Minimum reserve required for DR
    });
  }

  async execute(context) {
    try {
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Check for active DR events
      const activeDREvents = await this.getActiveDREvents();
      
      // Monitor grid conditions for DR triggers
      const drRecommendations = await this.analyzeDRConditions(vppState);
      
      // Execute DR actions if needed
      const drActions = [];
      if (drRecommendations.shouldTriggerDR) {
        const action = await this.triggerDREvent(drRecommendations);
        if (action) {
          drActions.push(action);
        }
      }
      
      const result = {
        timestamp: new Date().toISOString(),
        activeDREvents: activeDREvents.length,
        drRecommendations,
        drActions,
        availableCapacityMw: vppState.available_reserve_mw,
        committedReserveMw: vppState.committed_reserve_mw
      };
      
      await this.setCached(`agent:${this.name}:result`, result, 60);
      
      return {
        success: true,
        agent: this.name,
        ...result
      };
    } catch (error) {
      logger.error('DemandResponseAgent error:', error);
      throw error;
    }
  }

  async analyzeDRConditions(vppState) {
    const recommendations = {
      shouldTriggerDR: false,
      reason: '',
      severity: 'low',
      suggestedAction: null
    };
    
    // Check grid frequency
    if (vppState.avg_frequency < 49.8) {
      recommendations.shouldTriggerDR = true;
      recommendations.reason = `Low grid frequency (${vppState.avg_frequency.toFixed(2)} Hz) - need demand response`;
      recommendations.severity = 'high';
      recommendations.suggestedAction = {
        type: 'defer_load',
        targetMw: Math.min(vppState.available_reserve_mw * 0.3, 10),
        durationMinutes: 30
      };
      return recommendations;
    }
    
    // Check if we have enough reserve for DR
    if (vppState.available_reserve_mw < this.config.minReserveMw) {
      recommendations.reason = `Insufficient reserve (${vppState.available_reserve_mw.toFixed(2)} MW) for DR`;
      return recommendations;
    }
    
    // Check grid stress from forecast (if available in context)
    if (context.gridStressForecast) {
      const currentStress = context.gridStressForecast.current_stress_score || 0;
      if (currentStress > this.config.drThreshold) {
        recommendations.shouldTriggerDR = true;
        recommendations.reason = `High grid stress (${currentStress.toFixed(2)}) - proactive DR recommended`;
        recommendations.severity = 'medium';
        recommendations.suggestedAction = {
          type: 'defer_load',
          targetMw: Math.min(vppState.available_reserve_mw * 0.2, 5),
          durationMinutes: 15
        };
      }
    }
    
    return recommendations;
  }

  async triggerDREvent(recommendations) {
    if (!recommendations.shouldTriggerDR || !recommendations.suggestedAction) {
      return null;
    }
    
    try {
      const vppState = await dataAggregator.getVirtualPlantState();
      const targetNodes = this.selectDRNodes(vppState, recommendations.suggestedAction.targetMw);
      
      if (targetNodes.length === 0) {
        logger.warn('No suitable nodes for DR event');
        return null;
      }
      
      // Execute DR commands
      const dispatchCollection = getCollection('dispatch_log');
      const timestamp = new Date();
      const results = [];
      
      for (const node of targetNodes) {
        try {
          await publishToNode(node.dc_id, 'defer_load', {
            percent: 10, // Defer 10% of load
            duration_minutes: recommendations.suggestedAction.durationMinutes
          });
          
          await dispatchCollection.insertOne({
            dc_id: node.dc_id,
            action: 'defer_load',
            params: {
              percent: 10,
              duration_minutes: recommendations.suggestedAction.durationMinutes
            },
            issued_by: `agent:${this.name}`,
            timestamp: timestamp,
            status: 'sent',
            dr_event: true
          });
          
          results.push({ dc_id: node.dc_id, status: 'success' });
        } catch (error) {
          logger.error(`DR command failed for ${node.dc_id}:`, error);
          results.push({ dc_id: node.dc_id, status: 'failed', error: error.message });
        }
      }
      
      await publishMessage('dr:event:triggered', {
        agent: this.name,
        timestamp: timestamp,
        targetNodes: targetNodes.length,
        results: results
      });
      
      return {
        eventId: timestamp.toISOString(),
        nodes: targetNodes.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length
      };
    } catch (error) {
      logger.error('Error triggering DR event:', error);
      return null;
    }
  }

  selectDRNodes(vppState, targetMw) {
    // Select nodes with high load factor (can defer more)
    const suitableNodes = vppState.nodes
      .filter(node => node.load_factor > 0.7 && node.soc > 30)
      .sort((a, b) => b.load_factor - a.load_factor)
      .slice(0, 5); // Top 5 nodes
    
    return suitableNodes;
  }

  async getActiveDREvents() {
    const dispatchCollection = getCollection('dispatch_log');
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    return await dispatchCollection.find({
      dr_event: true,
      status: { $in: ['sent', 'active'] },
      timestamp: { $gte: oneHourAgo }
    }).toArray();
  }
}

export default new DemandResponseAgent();

