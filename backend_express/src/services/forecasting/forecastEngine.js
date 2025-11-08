import { getCollection } from '../database.js';
import { cacheGet, cacheSet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import dataAggregator from '../aggregation/dataAggregator.js';

/**
 * Forecasting Engine
 * LSTM/Prophet models for predicting short-term load and grid stress
 * Output: Predicted grid stress score (0-1)
 */
export class ForecastEngine {
  constructor() {
    this.forecastHorizonHours = parseInt(process.env.FORECAST_HORIZON_HOURS || 24);
    this.updateInterval = parseInt(process.env.FORECAST_UPDATE_INTERVAL || 300); // 5 minutes
  }

  /**
   * Generate load forecast for next N hours
   */
  async generateLoadForecast(horizonHours = null) {
    try {
      const horizon = horizonHours || this.forecastHorizonHours;
      const cacheKey = `forecast:load:${horizon}h`;
      const cached = await cacheGet(cacheKey);
      
      if (cached && this.isForecastFresh(cached.timestamp)) {
        return cached;
      }

      // Get historical data (last 7 days)
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const historicalData = await dataAggregator.getHistoricalAggregation(
        startTime,
        endTime,
        15 // 15-minute intervals
      );

      if (historicalData.length < 10) {
        logger.warn('Insufficient historical data for forecasting');
        return this.generateSimpleForecast(horizon);
      }

      // For MVP: Use simple moving average and trend
      // TODO: Replace with LSTM/Prophet model
      const forecast = this.simpleLoadForecast(historicalData, horizon);
      
      const result = {
        timestamp: new Date().toISOString(),
        forecast_type: 'load',
        horizon_hours: horizon,
        predictions: forecast.predictions,
        confidence: forecast.confidence,
        model_version: 'simple-v1',
        metadata: {
          historical_points: historicalData.length,
          method: 'moving_average_trend'
        }
      };

      // Cache for 5 minutes
      await cacheSet(cacheKey, result, 300);
      
      // Publish update
      await publishMessage('forecast:load:update', result);
      
      logger.info(`Load forecast generated: ${forecast.predictions.length} predictions`);
      
      return result;
    } catch (error) {
      logger.error('Error generating load forecast:', error);
      throw error;
    }
  }

  /**
   * Generate grid stress score forecast
   */
  async generateGridStressForecast(horizonHours = null) {
    try {
      const horizon = horizonHours || this.forecastHorizonHours;
      const cacheKey = `forecast:grid_stress:${horizon}h`;
      const cached = await cacheGet(cacheKey);
      
      if (cached && this.isForecastFresh(cached.timestamp)) {
        return cached;
      }

      // Get current VPP state
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Get historical frequency data
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const historicalData = await dataAggregator.getHistoricalAggregation(
        startTime,
        endTime,
        15
      );

      // Calculate grid stress score (0-1)
      // Stress factors:
      // 1. Frequency deviation from 50 Hz
      // 2. Load vs capacity ratio
      // 3. SOC levels (low SOC = higher stress)
      
      const currentStress = this.calculateCurrentStress(vppState);
      const stressForecast = this.simpleStressForecast(historicalData, currentStress, horizon);
      
      const result = {
        timestamp: new Date().toISOString(),
        forecast_type: 'grid_stress',
        horizon_hours: horizon,
        current_stress_score: currentStress,
        predictions: stressForecast.predictions,
        confidence: stressForecast.confidence,
        model_version: 'simple-v1',
        metadata: {
          current_freq: vppState.avg_frequency,
          current_soc: vppState.avg_soc,
          load_ratio: vppState.total_power_kw / (vppState.total_capacity_mw * 1000)
        }
      };

      // Cache for 5 minutes
      await cacheSet(cacheKey, result, 300);
      
      // Publish update
      await publishMessage('forecast:grid_stress:update', result);
      
      logger.info(`Grid stress forecast generated: current=${currentStress.toFixed(2)}`);
      
      return result;
    } catch (error) {
      logger.error('Error generating grid stress forecast:', error);
      throw error;
    }
  }

  /**
   * Simple load forecast using moving average and trend
   */
  simpleLoadForecast(historicalData, horizonHours) {
    if (historicalData.length < 2) {
      return this.generateSimpleForecast(horizonHours);
    }

    // Calculate average load from recent data
    const recentData = historicalData.slice(-24); // Last 24 points (6 hours if 15-min intervals)
    const avgLoad = recentData.reduce((sum, d) => sum + (d.avg_power_kw || 0), 0) / recentData.length;
    
    // Calculate trend (simple linear regression)
    const n = recentData.length;
    const x = recentData.map((_, i) => i);
    const y = recentData.map(d => d.avg_power_kw || 0);
    
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }
    const trend = denominator !== 0 ? numerator / denominator : 0;
    
    // Generate predictions
    const predictions = [];
    const intervalsPerHour = 4; // 15-minute intervals
    const totalIntervals = horizonHours * intervalsPerHour;
    
    for (let i = 1; i <= totalIntervals; i++) {
      const hoursAhead = i / intervalsPerHour;
      const predictedLoad = avgLoad + (trend * i);
      
      // Add some daily pattern (simplified)
      const hourOfDay = (new Date().getHours() + hoursAhead) % 24;
      const dailyFactor = 1 + 0.2 * Math.sin((hourOfDay - 6) * Math.PI / 12); // Peak around noon
      
      predictions.push({
        time: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
        value: Math.max(0, predictedLoad * dailyFactor),
        confidence: Math.max(0.7, 1 - (hoursAhead / horizonHours) * 0.3) // Decreases with time
      });
    }
    
    return {
      predictions,
      confidence: 0.75
    };
  }

  /**
   * Simple grid stress forecast
   */
  simpleStressForecast(historicalData, currentStress, horizonHours) {
    const predictions = [];
    const intervalsPerHour = 4;
    const totalIntervals = horizonHours * intervalsPerHour;
    
    // Simple decay towards normal (0.3) with some variation
    for (let i = 1; i <= totalIntervals; i++) {
      const hoursAhead = i / intervalsPerHour;
      const decayFactor = Math.exp(-hoursAhead / 6); // Decay over 6 hours
      const baseStress = 0.3; // Normal stress level
      const predictedStress = baseStress + (currentStress - baseStress) * decayFactor;
      
      // Add some random variation
      const variation = (Math.random() - 0.5) * 0.1;
      
      predictions.push({
        time: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
        value: Math.max(0, Math.min(1, predictedStress + variation)),
        confidence: Math.max(0.7, 1 - (hoursAhead / horizonHours) * 0.3)
      });
    }
    
    return {
      predictions,
      confidence: 0.8
    };
  }

  /**
   * Calculate current grid stress score (0-1)
   */
  calculateCurrentStress(vppState) {
    let stress = 0;
    
    // Frequency deviation (0-0.4)
    const freqDeviation = Math.abs(vppState.avg_frequency - 50.0);
    stress += Math.min(0.4, freqDeviation * 10);
    
    // Load ratio (0-0.3)
    const loadRatio = vppState.total_capacity_mw > 0 
      ? (vppState.total_power_kw / 1000) / vppState.total_capacity_mw 
      : 0;
    stress += Math.min(0.3, loadRatio * 0.3);
    
    // SOC levels (0-0.3)
    const socStress = vppState.avg_soc < 30 ? 0.3 : 
                     vppState.avg_soc < 50 ? 0.15 : 0;
    stress += socStress;
    
    return Math.min(1, stress);
  }

  /**
   * Generate simple forecast when insufficient data
   */
  generateSimpleForecast(horizonHours) {
    const predictions = [];
    const intervalsPerHour = 4;
    const totalIntervals = horizonHours * intervalsPerHour;
    const baseLoad = 100; // Default base load
    
    for (let i = 1; i <= totalIntervals; i++) {
      const hoursAhead = i / intervalsPerHour;
      predictions.push({
        time: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
        value: baseLoad,
        confidence: 0.5
      });
    }
    
    return {
      predictions,
      confidence: 0.5
    };
  }

  /**
   * Check if forecast is still fresh (less than 5 minutes old)
   */
  isForecastFresh(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    return age < 5 * 60 * 1000; // 5 minutes
  }
}

export default new ForecastEngine();

