import { cacheGet, cacheSet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import forecastEngine from '../forecasting/forecastEngine.js';

/**
 * RL Bidding Optimizer
 * Reinforcement Learning agent for optimal bidding strategies
 * Action space: {charge, discharge, hold, defer workloads}
 * Reward: Maximize revenue, maintain SOC thresholds, support frequency
 * 
 * For MVP: Simplified rule-based optimizer
 * TODO: Implement true RL (Q-learning/PPO)
 */
export class RLOptimizer {
  constructor() {
    this.learningRate = parseFloat(process.env.RL_LEARNING_RATE || 0.01);
    this.discountFactor = parseFloat(process.env.RL_DISCOUNT_FACTOR || 0.95);
    this.explorationRate = parseFloat(process.env.RL_EXPLORATION_RATE || 0.1);
    this.updateInterval = parseInt(process.env.RL_UPDATE_INTERVAL || 60); // 1 minute
  }

  /**
   * Get optimal action recommendation
   */
  async getOptimalAction() {
    try {
      const cacheKey = 'rl:optimal_action';
      const cached = await cacheGet(cacheKey);
      
      if (cached && this.isRecommendationFresh(cached.timestamp)) {
        return cached;
      }

      // Get current state
      const vppState = await dataAggregator.getVirtualPlantState();
      const gridStressForecast = await forecastEngine.generateGridStressForecast(6); // 6-hour forecast
      
      // Calculate optimal action using rule-based logic
      // TODO: Replace with true RL agent
      const recommendation = this.ruleBasedOptimization(vppState, gridStressForecast);
      
      const result = {
        timestamp: new Date().toISOString(),
        recommended_action: recommendation.action,
        action_params: recommendation.params,
        expected_revenue: recommendation.expectedRevenue,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        state: {
          avg_soc: vppState.avg_soc,
          avg_freq: vppState.avg_frequency,
          available_reserve_mw: vppState.available_reserve_mw,
          grid_stress: gridStressForecast.current_stress_score
        },
        model_version: 'rule-based-v1'
      };

      // Cache for 1 minute
      await cacheSet(cacheKey, result, 60);
      
      // Publish update
      await publishMessage('rl:optimization:update', result);
      
      logger.info(`RL optimization completed: action=${recommendation.action}, revenue=${recommendation.expectedRevenue}`);
      
      return result;
    } catch (error) {
      logger.error('Error in RL optimization:', error);
      throw error;
    }
  }

  /**
   * Rule-based optimization (MVP)
   * TODO: Replace with true RL agent
   */
  ruleBasedOptimization(vppState, gridStressForecast) {
    const avgSOC = vppState.avg_soc;
    const avgFreq = vppState.avg_frequency;
    const availableReserve = vppState.available_reserve_mw;
    const gridStress = gridStressForecast.current_stress_score;
    const nextHourStress = gridStressForecast.predictions[0]?.value || gridStress;

    let action = 'hold';
    let params = {};
    let expectedRevenue = 0;
    let confidence = 0.7;
    let reasoning = '';

    // Decision logic:
    // 1. If frequency is low (< 49.8 Hz) and SOC is high (> 50%) -> Discharge
    // 2. If frequency is high (> 50.2 Hz) and SOC is low (< 80%) -> Charge
    // 3. If grid stress is high (> 0.7) and SOC is high -> Discharge
    // 4. If grid stress is low (< 0.3) and SOC is low -> Charge
    // 5. If SOC is very low (< 20%) -> Charge (safety)
    // 6. If SOC is very high (> 90%) -> Discharge (safety)
    // 7. Otherwise -> Hold

    if (avgFreq < 49.8 && avgSOC > 50) {
      // Low frequency - discharge to support grid
      action = 'discharge';
      const powerMw = Math.min(availableReserve * 0.5, 10); // Max 10 MW or 50% of available
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 15,
        priority: 'high'
      };
      expectedRevenue = this.calculateRevenue('discharge', powerMw, gridStress);
      confidence = 0.85;
      reasoning = `Low frequency (${avgFreq.toFixed(2)} Hz) detected. Discharging to support grid stability.`;
    } else if (avgFreq > 50.2 && avgSOC < 80) {
      // High frequency - charge to absorb excess
      action = 'charge';
      const powerMw = Math.min(availableReserve * 0.3, 5); // Max 5 MW
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 30,
        priority: 'medium'
      };
      expectedRevenue = this.calculateRevenue('charge', powerMw, gridStress);
      confidence = 0.8;
      reasoning = `High frequency (${avgFreq.toFixed(2)} Hz) detected. Charging to absorb excess power.`;
    } else if (gridStress > 0.7 && avgSOC > 50) {
      // High grid stress - discharge to help
      action = 'discharge';
      const powerMw = Math.min(availableReserve * 0.4, 8);
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 20,
        priority: 'high'
      };
      expectedRevenue = this.calculateRevenue('discharge', powerMw, gridStress);
      confidence = 0.75;
      reasoning = `High grid stress (${gridStress.toFixed(2)}) predicted. Discharging to provide support.`;
    } else if (gridStress < 0.3 && avgSOC < 70) {
      // Low grid stress - charge when cheap
      action = 'charge';
      const powerMw = Math.min(availableReserve * 0.2, 3);
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 60,
        priority: 'low'
      };
      expectedRevenue = this.calculateRevenue('charge', powerMw, gridStress);
      confidence = 0.7;
      reasoning = `Low grid stress (${gridStress.toFixed(2)}). Charging during low-demand period.`;
    } else if (avgSOC < 20) {
      // Safety: Very low SOC - charge
      action = 'charge';
      const powerMw = Math.min(availableReserve * 0.5, 5);
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 45,
        priority: 'high'
      };
      expectedRevenue = 0; // Safety action, no revenue
      confidence = 0.95;
      reasoning = `Critical SOC level (${avgSOC.toFixed(1)}%). Charging for safety.`;
    } else if (avgSOC > 90) {
      // Safety: Very high SOC - discharge
      action = 'discharge';
      const powerMw = Math.min(availableReserve * 0.3, 5);
      params = {
        power_kw: powerMw * 1000,
        duration_minutes: 30,
        priority: 'medium'
      };
      expectedRevenue = this.calculateRevenue('discharge', powerMw, gridStress);
      confidence = 0.9;
      reasoning = `High SOC level (${avgSOC.toFixed(1)}%). Discharging to prevent overcharge.`;
    } else {
      // Hold - maintain current state
      action = 'hold';
      params = {};
      expectedRevenue = 0;
      confidence = 0.6;
      reasoning = `Stable conditions. Maintaining current state (SOC: ${avgSOC.toFixed(1)}%, Freq: ${avgFreq.toFixed(2)} Hz).`;
    }

    return {
      action,
      params,
      expectedRevenue,
      confidence,
      reasoning
    };
  }

  /**
   * Calculate expected revenue for an action
   */
  calculateRevenue(action, powerMw, gridStress) {
    // Simplified revenue calculation
    // Revenue = power * price * duration_factor
    // Price depends on grid stress (higher stress = higher price)
    
    const basePricePerMw = 2500; // ₹2500/MW base price
    const stressMultiplier = 1 + (gridStress * 0.5); // Up to 50% premium
    const pricePerMw = basePricePerMw * stressMultiplier;
    
    // Duration factor (longer duration = better utilization)
    const durationFactor = action === 'charge' ? 0.8 : 1.0; // Charging pays less
    
    // Revenue calculation
    const revenue = powerMw * pricePerMw * durationFactor;
    
    return Math.round(revenue);
  }

  /**
   * Check if recommendation is fresh (less than 1 minute old)
   */
  isRecommendationFresh(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    return age < 60 * 1000; // 1 minute
  }
}

export default new RLOptimizer();

