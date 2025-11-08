import logger from '../../utils/logger.js';
import { publishMessage, cacheSet, cacheGet } from '../redis.js';
import loadForecastAgent from './LoadForecastAgent.js';
import demandResponseAgent from './DemandResponseAgent.js';
import gridOptimizationAgent from './GridOptimizationAgent.js';
import dataAggregator from '../aggregation/dataAggregator.js';

/**
 * Agent Coordinator
 * Manages multi-agent collaboration and collective decision-making
 */
export class AgentCoordinator {
  constructor() {
    this.agents = {
      LoadForecastAgent: loadForecastAgent,
      DemandResponseAgent: demandResponseAgent,
      GridOptimizationAgent: gridOptimizationAgent
    };
    this.coordinationInterval = 30; // seconds
    this.lastCoordination = null;
    this.decisionHistory = [];
  }

  /**
   * Coordinate all agents and make collective decisions
   */
  async coordinate() {
    try {
      this.lastCoordination = new Date();
      logger.info('Starting agent coordination...');
      
      // Get shared context
      const context = await this.buildSharedContext();
      
      // Run all agents in parallel
      const agentResults = await Promise.allSettled(
        Object.entries(this.agents).map(async ([name, agent]) => {
          try {
            return {
              agent: name,
              result: await agent.run(context)
            };
          } catch (error) {
            logger.error(`Agent ${name} failed:`, error);
            return {
              agent: name,
              error: error.message
            };
          }
        })
      );
      
      // Process results
      const results = {};
      agentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[result.value.agent] = result.value.result || result.value;
        } else {
          const agentName = Object.keys(this.agents)[index];
          results[agentName] = { error: result.reason?.message || 'Unknown error' };
        }
      });
      
      // Make collective decision
      const decision = await this.makeCollectiveDecision(context, results);
      
      // Execute decision if auto-execute is enabled
      if (decision.shouldExecute && process.env.AGENT_AUTO_EXECUTE === 'true') {
        await this.executeDecision(decision);
      }
      
      // Store decision history
      this.decisionHistory.push({
        timestamp: new Date().toISOString(),
        context,
        results,
        decision
      });
      
      // Keep only last 100 decisions
      if (this.decisionHistory.length > 100) {
        this.decisionHistory.shift();
      }
      
      // Publish coordination update
      await publishMessage('agent:coordination:update', {
        timestamp: this.lastCoordination.toISOString(),
        agents: Object.keys(this.agents),
        decision,
        results: Object.keys(results)
      });
      
      // Cache coordination result
      await cacheSet('agent:coordination:latest', {
        timestamp: this.lastCoordination.toISOString(),
        decision,
        agentStatus: Object.fromEntries(
          Object.entries(this.agents).map(([name, agent]) => [name, agent.getStatus()])
        )
      }, 60);
      
      logger.info(`Agent coordination completed. Decision: ${decision.action || 'none'}`);
      
      return {
        success: true,
        timestamp: this.lastCoordination.toISOString(),
        context,
        results,
        decision
      };
    } catch (error) {
      logger.error('Agent coordination error:', error);
      throw error;
    }
  }

  /**
   * Build shared context for all agents
   * Public method for external access
   */
  async buildSharedContext() {
    const vppState = await dataAggregator.getVirtualPlantState();
    
    // Get latest forecasts if available
    const loadForecast = await cacheGet('agent:LoadForecastAgent:result');
    const gridStressForecast = loadForecast?.gridStressForecast || null;
    
    return {
      vppState,
      gridStressForecast,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Make collective decision based on all agent recommendations
   */
  async makeCollectiveDecision(context, agentResults) {
    const decision = {
      action: null,
      priority: 'low',
      confidence: 0,
      reasoning: [],
      shouldExecute: false
    };
    
    // Analyze LoadForecastAgent recommendations
    const loadForecast = agentResults.LoadForecastAgent;
    if (loadForecast?.recommendations) {
      const highPriorityRecs = loadForecast.recommendations.filter(r => r.severity === 'high');
      if (highPriorityRecs.length > 0) {
        decision.priority = 'high';
        decision.reasoning.push('Load forecast indicates high priority action needed');
        decision.confidence += 0.3;
      }
    }
    
    // Analyze DemandResponseAgent recommendations
    const drAgent = agentResults.DemandResponseAgent;
    if (drAgent?.drRecommendations?.shouldTriggerDR) {
      decision.action = 'trigger_dr';
      decision.priority = drAgent.drRecommendations.severity === 'high' ? 'high' : 'medium';
      decision.reasoning.push(drAgent.drRecommendations.reason);
      decision.confidence += 0.4;
      decision.shouldExecute = true;
    }
    
    // Analyze GridOptimizationAgent recommendations
    const gridOpt = agentResults.GridOptimizationAgent;
    if (gridOpt?.improvements?.totalGain > 0.10) {
      // Only if efficiency gain > 10%
      if (!decision.action || decision.priority === 'low') {
        decision.action = 'optimize_grid';
        decision.priority = 'medium';
        decision.reasoning.push(`Grid optimization can improve efficiency by ${(gridOpt.improvements.totalGain * 100).toFixed(1)}%`);
        decision.confidence += 0.3;
      }
    }
    
    // Final decision logic
    if (decision.confidence > 0.5 && decision.action) {
      decision.shouldExecute = true;
    }
    
    return decision;
  }

  /**
   * Execute collective decision
   */
  async executeDecision(decision) {
    try {
      logger.info(`Executing collective decision: ${decision.action}`);
      
      if (decision.action === 'trigger_dr') {
        // Trigger DR event via DemandResponseAgent
        const drAgent = this.agents.DemandResponseAgent;
        const context = await this.buildSharedContext();
        const drRecommendations = await drAgent.analyzeDRConditions(context.vppState);
        if (drRecommendations.shouldTriggerDR) {
          await drAgent.triggerDREvent(drRecommendations);
        }
      } else if (decision.action === 'optimize_grid') {
        // Execute grid optimization
        const gridOptAgent = this.agents.GridOptimizationAgent;
        const context = await this.buildSharedContext();
        const result = await gridOptAgent.execute(context);
        if (result.optimizationPlan?.plan && result.optimizationPlan.plan.action !== 'hold') {
          // Execute the optimization plan
          // This would call dispatchOptimizer with autoExecute=true
          logger.info('Grid optimization plan ready for execution');
        }
      }
      
      await publishMessage('agent:decision:executed', {
        timestamp: new Date().toISOString(),
        decision
      });
    } catch (error) {
      logger.error('Error executing decision:', error);
      throw error;
    }
  }

  /**
   * Get coordination status
   */
  getStatus() {
    return {
      lastCoordination: this.lastCoordination,
      agents: Object.fromEntries(
        Object.entries(this.agents).map(([name, agent]) => [name, agent.getStatus()])
      ),
      recentDecisions: this.decisionHistory.slice(-10)
    };
  }
}

export default new AgentCoordinator();

