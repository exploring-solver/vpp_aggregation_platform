import { getCollection } from '../database.js';
import { publishToNode } from '../mqtt.js';
import { publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import rlOptimizer from './rlOptimizer.js';
import dataAggregator from '../aggregation/dataAggregator.js';

/**
 * Dispatch Optimizer
 * Converts optimization outputs into actionable commands for each data center
 * Handles load deferral (via APIs) and battery control (via MQTT)
 */
export class DispatchOptimizer {
  constructor() {
    this.maxDispatchPowerMw = parseFloat(process.env.MAX_DISPATCH_POWER_MW || 100);
    this.socThresholdMin = parseFloat(process.env.SOC_THRESHOLD_MIN || 20);
    this.socThresholdMax = parseFloat(process.env.SOC_THRESHOLD_MAX || 90);
  }

  /**
   * Optimize and execute dispatch commands
   */
  async optimizeAndDispatch(autoExecute = false) {
    try {
      // Get RL optimization recommendation
      const optimization = await rlOptimizer.getOptimalAction();
      
      if (optimization.recommended_action === 'hold') {
        logger.info('RL optimizer recommends holding - no dispatch needed');
        return {
          success: true,
          action: 'hold',
          message: 'No dispatch required - maintaining current state'
        };
      }

      // Get current VPP state
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Determine target nodes
      const targetNodes = this.selectTargetNodes(
        optimization.recommended_action,
        optimization.action_params,
        vppState
      );

      if (targetNodes.length === 0) {
        logger.warn('No suitable nodes found for dispatch');
        return {
          success: false,
          action: optimization.recommended_action,
          message: 'No suitable nodes available for dispatch'
        };
      }

      // Create dispatch plan
      const dispatchPlan = this.createDispatchPlan(
        optimization,
        targetNodes,
        vppState
      );

      // Validate dispatch plan
      const validation = this.validateDispatchPlan(dispatchPlan, vppState);
      if (!validation.valid) {
        logger.warn(`Dispatch plan validation failed: ${validation.reason}`);
        return {
          success: false,
          action: optimization.recommended_action,
          message: validation.reason,
          plan: dispatchPlan
        };
      }

      // Execute dispatch if auto-execute is enabled
      if (autoExecute) {
        const result = await this.executeDispatch(dispatchPlan);
        return {
          success: true,
          action: optimization.recommended_action,
          plan: dispatchPlan,
          execution: result
        };
      }

      return {
        success: true,
        action: optimization.recommended_action,
        plan: dispatchPlan,
        ready: true
      };
    } catch (error) {
      logger.error('Error in dispatch optimization:', error);
      throw error;
    }
  }

  /**
   * Select target nodes based on action and constraints
   */
  selectTargetNodes(action, params, vppState) {
    const suitableNodes = [];

    for (const node of vppState.nodes) {
      const nodeState = node;
      
      // Check SOC constraints
      if (action === 'charge') {
        if (nodeState.soc >= this.socThresholdMax) {
          continue; // Skip nodes that are too full
        }
      } else if (action === 'discharge') {
        if (nodeState.soc <= this.socThresholdMin) {
          continue; // Skip nodes that are too empty
        }
      }

      // Check if node has capacity
      const nodeCapacityMw = nodeState.available_reserve_mw || 0;
      if (nodeCapacityMw < 0.1) { // At least 100 kW
        continue;
      }

      suitableNodes.push({
        dc_id: nodeState.dc_id,
        location: nodeState.location,
        available_capacity_mw: nodeCapacityMw,
        current_soc: nodeState.soc,
        current_power_kw: nodeState.power_kw
      });
    }

    // Sort by suitability (higher SOC for discharge, lower for charge)
    suitableNodes.sort((a, b) => {
      if (action === 'charge') {
        return a.current_soc - b.current_soc; // Prefer lower SOC
      } else {
        return b.current_soc - a.current_soc; // Prefer higher SOC
      }
    });

    // Select top nodes (up to 5 or until we have enough capacity)
    const requiredPowerMw = (params.power_kw || 0) / 1000;
    const selectedNodes = [];
    let totalCapacity = 0;

    for (const node of suitableNodes) {
      if (totalCapacity >= requiredPowerMw && selectedNodes.length >= 5) {
        break;
      }
      selectedNodes.push(node);
      totalCapacity += node.available_capacity_mw;
    }

    return selectedNodes;
  }

  /**
   * Create dispatch plan
   */
  createDispatchPlan(optimization, targetNodes, vppState) {
    const requiredPowerKw = optimization.action_params.power_kw || 0;
    const durationMinutes = optimization.action_params.duration_minutes || 15;
    const priority = optimization.action_params.priority || 'medium';

    // Distribute power across nodes
    const totalCapacity = targetNodes.reduce((sum, n) => sum + n.available_capacity_mw, 0);
    const dispatchCommands = [];

    for (const node of targetNodes) {
      // Proportional allocation
      const nodeShare = node.available_capacity_mw / totalCapacity;
      const nodePowerKw = Math.min(
        requiredPowerKw * nodeShare,
        node.available_capacity_mw * 1000
      );

      dispatchCommands.push({
        dc_id: node.dc_id,
        action: optimization.recommended_action,
        params: {
          power_kw: Math.round(nodePowerKw),
          duration_minutes: durationMinutes,
          priority: priority
        },
        expected_revenue: Math.round(optimization.expected_revenue * nodeShare),
        confidence: optimization.confidence
      });
    }

    return {
      timestamp: new Date().toISOString(),
      optimization_id: optimization.timestamp,
      action: optimization.recommended_action,
      total_power_kw: requiredPowerKw,
      duration_minutes: durationMinutes,
      priority: priority,
      expected_revenue: optimization.expected_revenue,
      commands: dispatchCommands,
      reasoning: optimization.reasoning
    };
  }

  /**
   * Validate dispatch plan
   */
  validateDispatchPlan(plan, vppState) {
    // Check total power doesn't exceed limits
    const totalPowerMw = plan.total_power_kw / 1000;
    if (totalPowerMw > this.maxDispatchPowerMw) {
      return {
        valid: false,
        reason: `Total dispatch power (${totalPowerMw.toFixed(2)} MW) exceeds maximum (${this.maxDispatchPowerMw} MW)`
      };
    }

    // Check if we have enough available reserve
    if (totalPowerMw > vppState.available_reserve_mw) {
      return {
        valid: false,
        reason: `Required power (${totalPowerMw.toFixed(2)} MW) exceeds available reserve (${vppState.available_reserve_mw.toFixed(2)} MW)`
      };
    }

    // Check each node's constraints
    for (const cmd of plan.commands) {
      const node = vppState.nodes.find(n => n.dc_id === cmd.dc_id);
      if (!node) {
        return {
          valid: false,
          reason: `Node ${cmd.dc_id} not found in VPP state`
        };
      }

      if (cmd.action === 'charge' && node.soc >= this.socThresholdMax) {
        return {
          valid: false,
          reason: `Node ${cmd.dc_id} SOC (${node.soc}%) too high for charging`
        };
      }

      if (cmd.action === 'discharge' && node.soc <= this.socThresholdMin) {
        return {
          valid: false,
          reason: `Node ${cmd.dc_id} SOC (${node.soc}%) too low for discharging`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Execute dispatch plan
   */
  async executeDispatch(plan) {
    try {
      const dispatchCollection = getCollection('dispatch_log');
      const timestamp = new Date();
      const results = [];

      // Execute each command
      for (const cmd of plan.commands) {
        try {
          // Send MQTT command
          await publishToNode(cmd.dc_id, cmd.action, cmd.params);

          // Log dispatch
          const dispatchLog = {
            dc_id: cmd.dc_id,
            action: cmd.action,
            params: cmd.params,
            issued_by: 'system',
            timestamp: timestamp,
            status: 'sent',
            optimization_id: plan.optimization_id,
            expected_revenue: cmd.expected_revenue
          };

          await dispatchCollection.insertOne(dispatchLog);
          results.push({ dc_id: cmd.dc_id, status: 'success' });

          logger.info(`Dispatch command sent to ${cmd.dc_id}: ${cmd.action} ${cmd.params.power_kw}kW`);
        } catch (error) {
          logger.error(`Failed to dispatch to ${cmd.dc_id}:`, error);
          results.push({ dc_id: cmd.dc_id, status: 'failed', error: error.message });
        }
      }

      // Publish update
      await publishMessage('dispatch:optimized', {
        plan_id: plan.optimization_id,
        action: plan.action,
        commands_count: plan.commands.length,
        success_count: results.filter(r => r.status === 'success').length,
        timestamp: timestamp
      });

      return {
        executed: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        results: results
      };
    } catch (error) {
      logger.error('Error executing dispatch:', error);
      throw error;
    }
  }
}

export default new DispatchOptimizer();

