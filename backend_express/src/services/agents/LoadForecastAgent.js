import { BaseAgent } from './BaseAgent.js';
import forecastEngine from '../forecasting/forecastEngine.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import logger from '../../utils/logger.js';

/**
 * Load Forecast Agent
 * Predicts future load and grid stress using LSTM models
 */
export class LoadForecastAgent extends BaseAgent {
  constructor() {
    super('LoadForecastAgent', {
      updateInterval: 60, // Run every minute
      forecastHorizon: 24 // 24 hours
    });
  }

  async execute(context) {
    try {
      // Get current VPP state
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Generate load forecast
      const loadForecast = await forecastEngine.generateLoadForecast(this.config.forecastHorizon);
      
      // Generate grid stress forecast
      const gridStressForecast = await forecastEngine.generateGridStressForecast(this.config.forecastHorizon);
      
      // Analyze forecast and provide recommendations
      const recommendations = this.analyzeForecast(loadForecast, gridStressForecast, vppState);
      
      const result = {
        timestamp: new Date().toISOString(),
        loadForecast,
        gridStressForecast,
        recommendations,
        currentState: {
          totalPowerKw: vppState.total_power_kw,
          avgSOC: vppState.avg_soc,
          avgFrequency: vppState.avg_frequency,
          onlineNodes: vppState.online_nodes
        }
      };

      // Cache result
      await this.setCached(`agent:${this.name}:result`, result, 120);
      
      return {
        success: true,
        agent: this.name,
        ...result
      };
    } catch (error) {
      logger.error('LoadForecastAgent error:', error);
      throw error;
    }
  }

  analyzeForecast(loadForecast, gridStressForecast, vppState) {
    const recommendations = [];
    
    // Check for peak load periods
    const maxLoad = Math.max(...loadForecast.predictions.map(p => p.value));
    const currentLoad = vppState.total_power_kw;
    
    if (maxLoad > currentLoad * 1.2) {
      recommendations.push({
        type: 'peak_load_warning',
        severity: 'high',
        message: `Peak load of ${maxLoad.toFixed(2)} kW predicted (${((maxLoad/currentLoad - 1) * 100).toFixed(1)}% increase)`,
        action: 'prepare_reserve',
        timeframe: 'next_24h'
      });
    }
    
    // Check for grid stress
    const maxStress = Math.max(...gridStressForecast.predictions.map(p => p.value));
    if (maxStress > 0.7) {
      recommendations.push({
        type: 'grid_stress_warning',
        severity: 'high',
        message: `High grid stress (${maxStress.toFixed(2)}) predicted`,
        action: 'increase_reserve',
        timeframe: 'next_6h'
      });
    }
    
    // Check for low stress periods (charging opportunity)
    const minStress = Math.min(...gridStressForecast.predictions.map(p => p.value));
    if (minStress < 0.3 && vppState.avg_soc < 70) {
      recommendations.push({
        type: 'charging_opportunity',
        severity: 'low',
        message: `Low grid stress period detected - good time to charge batteries`,
        action: 'charge',
        timeframe: 'next_12h'
      });
    }
    
    return recommendations;
  }
}

export default new LoadForecastAgent();

