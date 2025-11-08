import { getCollection } from '../database.js';
import { cacheGet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import dispatchOptimizer from '../optimization/dispatchOptimizer.js';
import forecastEngine from '../forecasting/forecastEngine.js';
import { publishToNode } from '../mqtt.js';

/**
 * Multi-Agent System for Autonomous Grid Management
 * 
 * Agents:
 * 1. LoadForecastAgent - Predicts load and grid stress
 * 2. DemandResponseAgent - Coordinates demand response events
 * 3. OptimizationAgent - Optimizes dispatch and bidding
 * 4. MonitoringAgent - Monitors system health and performance
 */

export class MultiAgentSystem {
  constructor() {
    this.agents = {
      loadForecast: new LoadForecastAgent(),
      demandResponse: new DemandResponseAgent(),
      optimization: new OptimizationAgent(),
      monitoring: new MonitoringAgent()
    };
    this.communicationChannel = new AgentCommunicationChannel();
  }

  /**
   * Execute agent coordination cycle
   */
  async executeCycle() {
    try {
      logger.info('Starting multi-agent coordination cycle');
      
      // 1. Monitoring agent checks system state
      const systemState = await this.agents.monitoring.assess();
      
      // 2. Load forecast agent predicts future load
      const forecast = await this.agents.loadForecast.predict(systemState);
      
      // 3. Optimization agent decides actions
      const optimization = await this.agents.optimization.optimize(systemState, forecast);
      
      // 4. Demand response agent coordinates if needed
      const drAction = await this.agents.demandResponse.coordinate(systemState, optimization);
      
      // 5. Agents communicate and make collective decision
      const decision = await this.communicationChannel.consensus([
        this.agents.loadForecast,
        this.agents.demandResponse,
        this.agents.optimization,
        this.agents.monitoring
      ], {
        systemState,
        forecast,
        optimization,
        drAction
      });
      
      // 6. Execute if decision is approved
      if (decision.approved && decision.action) {
        await this.executeAction(decision.action);
      }
      
      logger.info(`Multi-agent cycle completed. Decision: ${decision.approved ? 'APPROVED' : 'DEFERRED'}`);
      
      return {
        success: true,
        decision,
        agents: {
          monitoring: systemState,
          forecast,
          optimization,
          demandResponse: drAction
        }
      };
    } catch (error) {
      logger.error('Error in multi-agent cycle:', error);
      throw error;
    }
  }

  /**
   * Execute action decided by agents
   */
  async executeAction(action) {
    try {
      if (action.type === 'dispatch') {
        const dispatchCollection = getCollection('dispatch_log');
        const timestamp = new Date();
        
        for (const cmd of action.commands) {
          try {
            await publishToNode(cmd.dc_id, cmd.action, cmd.params);
            
            await dispatchCollection.insertOne({
              dc_id: cmd.dc_id,
              action: cmd.action,
              params: cmd.params,
              issued_by: 'multi-agent-system',
              timestamp: timestamp,
              status: 'sent',
              agent_decision: action.reasoning
            });
            
            logger.info(`Agent dispatch: ${cmd.dc_id} -> ${cmd.action} ${cmd.params.power_kw}kW`);
          } catch (error) {
            logger.error(`Failed agent dispatch to ${cmd.dc_id}:`, error);
          }
        }
      }
      
      // Publish agent action
      await publishMessage('agent:action', {
        type: action.type,
        timestamp: new Date(),
        reasoning: action.reasoning
      });
    } catch (error) {
      logger.error('Error executing agent action:', error);
      throw error;
    }
  }

  /**
   * Get agent status and recommendations
   */
  async getAgentStatus() {
    const systemState = await this.agents.monitoring.assess();
    const forecast = await this.agents.loadForecast.predict(systemState);
    const optimization = await this.agents.optimization.optimize(systemState, forecast);
    
    return {
      agents: {
        monitoring: {
          status: systemState.status,
          activeNodes: systemState.activeNodes,
          totalCapacity: systemState.totalCapacity,
          availableReserve: systemState.availableReserve
        },
        forecast: {
          loadForecast: forecast.loadForecast,
          gridStress: forecast.gridStress,
          confidence: forecast.confidence
        },
        optimization: {
          recommendedAction: optimization.recommendedAction,
          expectedRevenue: optimization.expectedRevenue,
          confidence: optimization.confidence
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Load Forecast Agent
 */
class LoadForecastAgent {
  async predict(systemState) {
    try {
      const forecast = await forecastEngine.generateLoadForecast(24);
      const gridStress = await forecastEngine.generateGridStressForecast(6);
      
      return {
        loadForecast: forecast,
        gridStress: gridStress,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('LoadForecastAgent error:', error);
      return {
        loadForecast: null,
        gridStress: null,
        confidence: 0.0,
        error: error.message
      };
    }
  }
}

/**
 * Demand Response Agent
 */
class DemandResponseAgent {
  async coordinate(systemState, optimization) {
    try {
      // Check if demand response is needed
      const needsDR = systemState.gridFrequency < 49.8 || 
                     systemState.gridFrequency > 50.2 ||
                     optimization.recommendedAction === 'defer_load';
      
      if (!needsDR) {
        return {
          action: 'none',
          reason: 'Grid stable, no DR needed'
        };
      }
      
      // Calculate required load reduction
      const freqDeviation = Math.abs(systemState.gridFrequency - 50.0);
      const requiredReductionKw = freqDeviation * 1000; // 1kW per 0.001Hz deviation
      
      return {
        action: 'defer_load',
        requiredReductionKw: Math.min(requiredReductionKw, 500), // Cap at 500kW
        targetNodes: systemState.activeNodes.slice(0, 5), // Top 5 nodes
        durationMinutes: 30,
        priority: 'high'
      };
    } catch (error) {
      logger.error('DemandResponseAgent error:', error);
      return {
        action: 'none',
        error: error.message
      };
    }
  }
}

/**
 * Optimization Agent
 */
class OptimizationAgent {
  async optimize(systemState, forecast) {
    try {
      // Use dispatch optimizer to get recommendations
      const optimization = await dispatchOptimizer.optimizeAndDispatch(false);
      
      if (!optimization.success || optimization.action === 'hold') {
        return {
          recommendedAction: 'hold',
          expectedRevenue: 0,
          confidence: 0.7,
          reasoning: 'No optimization opportunity identified'
        };
      }
      
      return {
        recommendedAction: optimization.action,
        expectedRevenue: optimization.plan?.expected_revenue || 0,
        confidence: optimization.plan?.confidence || 0.75,
        reasoning: optimization.plan?.reasoning || 'RL optimization recommendation',
        plan: optimization.plan
      };
    } catch (error) {
      logger.error('OptimizationAgent error:', error);
      return {
        recommendedAction: 'hold',
        expectedRevenue: 0,
        confidence: 0.0,
        error: error.message
      };
    }
  }
}

/**
 * Monitoring Agent
 */
class MonitoringAgent {
  async assess() {
    try {
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Check node health
      const nodesCollection = getCollection('nodes');
      const allNodes = await nodesCollection.find({}).toArray();
      const activeNodes = [];
      
      for (const node of allNodes) {
        const lastState = await cacheGet(`node:${node.dc_id}:last_state`);
        if (lastState) {
          const age = Date.now() - new Date(lastState.timestamp).getTime();
          if (age < 60000) { // Active if last seen < 1 minute ago
            activeNodes.push({
              dc_id: node.dc_id,
              capacity_kw: node.capacity_kw || 0,
              battery_kwh: node.battery_kwh || 0,
              lastSeen: lastState.timestamp
            });
          }
        }
      }
      
      return {
        status: vppState.online_nodes > 0 ? 'healthy' : 'degraded',
        activeNodes: activeNodes,
        totalCapacity: vppState.total_capacity_mw,
        availableReserve: vppState.available_reserve_mw,
        committedReserve: vppState.committed_reserve_mw,
        gridFrequency: vppState.avg_frequency,
        onlineNodes: vppState.online_nodes,
        totalNodes: allNodes.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('MonitoringAgent error:', error);
      return {
        status: 'error',
        activeNodes: [],
        totalCapacity: 0,
        availableReserve: 0,
        error: error.message
      };
    }
  }
}

/**
 * Agent Communication Channel
 */
class AgentCommunicationChannel {
  async consensus(agents, context) {
    try {
      // Simple consensus: if 3+ agents agree, approve action
      const votes = [];
      
      // Load forecast agent votes based on grid stress
      if (context.forecast?.gridStress?.stress_score > 0.7) {
        votes.push({ agent: 'loadForecast', vote: 'approve', reason: 'High grid stress predicted' });
      } else {
        votes.push({ agent: 'loadForecast', vote: 'defer', reason: 'Grid stable' });
      }
      
      // Optimization agent votes
      if (context.optimization?.recommendedAction !== 'hold' && 
          context.optimization?.confidence > 0.7) {
        votes.push({ agent: 'optimization', vote: 'approve', reason: 'High confidence optimization' });
      } else {
        votes.push({ agent: 'optimization', vote: 'defer', reason: 'Low confidence or hold recommended' });
      }
      
      // Demand response agent votes
      if (context.drAction?.action !== 'none') {
        votes.push({ agent: 'demandResponse', vote: 'approve', reason: 'DR action needed' });
      } else {
        votes.push({ agent: 'demandResponse', vote: 'defer', reason: 'No DR needed' });
      }
      
      // Monitoring agent votes based on system health
      if (context.systemState?.status === 'healthy' && 
          context.systemState?.availableReserve > 10) {
        votes.push({ agent: 'monitoring', vote: 'approve', reason: 'System healthy with reserves' });
      } else {
        votes.push({ agent: 'monitoring', vote: 'defer', reason: 'System constraints' });
      }
      
      const approveCount = votes.filter(v => v.vote === 'approve').length;
      const approved = approveCount >= 3;
      
      // Determine action if approved
      let action = null;
      if (approved) {
        if (context.optimization?.plan) {
          action = {
            type: 'dispatch',
            commands: context.optimization.plan.commands || [],
            reasoning: `Multi-agent consensus: ${approveCount}/4 agents approved. ${votes.filter(v => v.vote === 'approve').map(v => v.reason).join('; ')}`
          };
        } else if (context.drAction?.action !== 'none') {
          // Create DR dispatch commands
          const drCommands = context.drAction.targetNodes.map(node => ({
            dc_id: node.dc_id,
            action: 'defer_load',
            params: {
              power_kw: context.drAction.requiredReductionKw / context.drAction.targetNodes.length,
              duration_minutes: context.drAction.durationMinutes
            }
          }));
          
          action = {
            type: 'dispatch',
            commands: drCommands,
            reasoning: `Demand response coordination: ${context.drAction.requiredReductionKw}kW reduction needed`
          };
        }
      }
      
      return {
        approved,
        votes,
        action,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('AgentCommunicationChannel error:', error);
      return {
        approved: false,
        votes: [],
        action: null,
        error: error.message
      };
    }
  }
}

export default new MultiAgentSystem();

