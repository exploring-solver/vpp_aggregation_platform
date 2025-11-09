import { getCollection } from '../database.js';
import { cacheGet, cacheSet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import forecastEngine from '../forecasting/forecastEngine.js';
import marketBidding from './marketBidding.js';

/**
 * RL Trading Agent for Energy Markets
 * Uses reinforcement learning (mock implementation) to optimize bidding strategies
 * for day-ahead, intraday, and balancing markets
 */
export class RLTradingAgent {
  constructor() {
    this.learningRate = 0.01;
    this.discountFactor = 0.95;
    this.explorationRate = 0.1;
    this.qTable = new Map(); // Q-value table (state -> action -> value)
    this.marketTypes = ['day_ahead', 'intraday', 'balancing'];
    this.actionSpace = ['buy', 'sell', 'hold'];
  }

  /**
   * Generate optimal bid strategy for a market type
   */
  async generateBidStrategy(marketType, systemState, forecast) {
    try {
      // Get current state representation
      const state = this.getStateRepresentation(systemState, forecast, marketType);
      
      // Use RL to select optimal action
      const action = await this.selectAction(state, marketType);
      
      // Calculate bid parameters based on action
      const bidParams = this.calculateBidParameters(action, systemState, forecast, marketType);
      
      // Calculate expected reward
      const expectedReward = this.calculateExpectedReward(state, action, bidParams, marketType);
      
      // Update Q-table (learning)
      await this.updateQTable(state, action, expectedReward, marketType);
      
      return {
        marketType,
        action: action.type,
        bidParams,
        expectedReward,
        confidence: action.confidence,
        reasoning: action.reasoning,
        state,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('RL Trading Agent error:', error);
      throw error;
    }
  }

  /**
   * Get state representation for RL
   */
  getStateRepresentation(systemState, forecast, marketType) {
    // Normalize state features for RL
    const features = {
      availableReserve: systemState.available_reserve_mw / Math.max(systemState.total_capacity_mw, 1),
      avgSOC: systemState.avg_soc / 100,
      gridStress: forecast?.gridStress?.current_stress_score || 0,
      priceTrend: this.getPriceTrend(marketType),
      timeOfDay: new Date().getHours() / 24,
      dayOfWeek: new Date().getDay() / 7,
      renewableForecast: forecast?.renewableForecast || 0.5,
      marketType: this.marketTypes.indexOf(marketType) / this.marketTypes.length
    };
    
    // Create state key (discretized)
    const stateKey = this.discretizeState(features);
    return { features, stateKey };
  }

  /**
   * Discretize continuous state features
   */
  discretizeState(features) {
    const reserveBin = Math.floor(features.availableReserve * 10);
    const socBin = Math.floor(features.avgSOC * 10);
    const stressBin = Math.floor(features.gridStress * 10);
    const priceBin = Math.floor(features.priceTrend * 10);
    
    return `${reserveBin}_${socBin}_${stressBin}_${priceBin}`;
  }

  /**
   * Select action using epsilon-greedy policy
   */
  async selectAction(state, marketType) {
    const stateKey = state.stateKey;
    const qKey = `${marketType}_${stateKey}`;
    
    // Get Q-values for this state
    let qValues = this.qTable.get(qKey) || {};
    
    // Initialize Q-values if not present
    if (Object.keys(qValues).length === 0) {
      qValues = {
        buy: 0,
        sell: 0,
        hold: 0
      };
      this.qTable.set(qKey, qValues);
    }
    
    // Epsilon-greedy: explore or exploit
    const shouldExplore = Math.random() < this.explorationRate;
    
    let actionType;
    if (shouldExplore) {
      // Explore: random action
      actionType = this.actionSpace[Math.floor(Math.random() * this.actionSpace.length)];
    } else {
      // Exploit: best action
      actionType = Object.keys(qValues).reduce((a, b) => 
        qValues[a] > qValues[b] ? a : b
      );
    }
    
    // Generate action details
    const action = await this.generateActionDetails(actionType, state, marketType);
    
    return {
      type: actionType,
      confidence: Math.min(0.95, 0.7 + (Math.max(...Object.values(qValues)) / 100)),
      reasoning: action.reasoning,
      qValue: qValues[actionType]
    };
  }

  /**
   * Generate action details
   */
  async generateActionDetails(actionType, state, marketType) {
    const { features } = state;
    let reasoning = '';
    let capacity = 0;
    let price = 0;
    
    if (actionType === 'buy') {
      // Buy electricity when:
      // - Low SOC and low price
      // - High grid stress predicted
      reasoning = `Buy: Low SOC (${(features.avgSOC * 100).toFixed(0)}%), favorable price trend`;
      capacity = Math.min(features.availableReserve * 100, 50); // MW
      price = this.getMarketPrice(marketType) * 0.95; // 5% below market
    } else if (actionType === 'sell') {
      // Sell electricity when:
      // - High SOC and high price
      // - Low grid stress
      reasoning = `Sell: High reserve (${(features.availableReserve * 100).toFixed(0)}%), good price opportunity`;
      capacity = Math.min(features.availableReserve * 100, 50); // MW
      price = this.getMarketPrice(marketType) * 1.05; // 5% above market
    } else {
      // Hold: wait for better opportunity
      reasoning = `Hold: Waiting for better market conditions`;
      capacity = 0;
      price = 0;
    }
    
    return {
      reasoning,
      capacity,
      price
    };
  }

  /**
   * Calculate bid parameters
   */
  calculateBidParameters(action, systemState, forecast, marketType) {
    const basePrice = this.getMarketPrice(marketType);
    
    return {
      capacity_mw: action.capacity,
      price_per_mw: action.price || basePrice,
      duration_minutes: this.getMarketDuration(marketType),
      service_type: this.getServiceType(marketType),
      strategy: action.type,
      confidence: action.confidence
    };
  }

  /**
   * Calculate expected reward
   */
  calculateExpectedReward(state, action, bidParams, marketType) {
    const { features } = state;
    let reward = 0;
    
    if (action.type === 'buy') {
      // Reward for buying at low prices
      const priceFactor = (1 - features.priceTrend) * 100; // Lower price = higher reward
      const socFactor = (1 - features.avgSOC) * 50; // Lower SOC = higher need
      reward = priceFactor + socFactor;
    } else if (action.type === 'sell') {
      // Reward for selling at high prices
      const priceFactor = features.priceTrend * 100; // Higher price = higher reward
      const reserveFactor = features.availableReserve * 50; // More reserve = can sell more
      reward = priceFactor + reserveFactor;
    } else {
      // Small negative reward for holding (opportunity cost)
      reward = -10;
    }
    
    // Adjust for market type
    const marketMultiplier = {
      'day_ahead': 1.0,
      'intraday': 0.8,
      'balancing': 1.2
    };
    
    return reward * (marketMultiplier[marketType] || 1.0);
  }

  /**
   * Update Q-table (learning)
   */
  async updateQTable(state, action, reward, marketType) {
    const stateKey = state.stateKey;
    const qKey = `${marketType}_${stateKey}`;
    
    let qValues = this.qTable.get(qKey) || {
      buy: 0,
      sell: 0,
      hold: 0
    };
    
    // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
    const currentQ = qValues[action.type] || 0;
    const maxFutureQ = Math.max(...Object.values(qValues));
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxFutureQ - currentQ);
    
    qValues[action.type] = newQ;
    this.qTable.set(qKey, qValues);
    
    // Persist to cache
    await cacheSet(`rl:qtable:${qKey}`, qValues, 86400); // 24 hours
  }

  /**
   * Get market price (simulated)
   */
  getMarketPrice(marketType) {
    // Simulate market prices based on time and market type
    const basePrice = 5.0; // ₹5/kWh base
    const hour = new Date().getHours();
    
    // Peak hours: 9-11 AM, 6-9 PM
    const isPeak = (hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 21);
    const peakMultiplier = isPeak ? 1.3 : 0.9;
    
    // Market type multipliers
    const marketMultipliers = {
      'day_ahead': 1.0,
      'intraday': 1.1,
      'balancing': 1.5
    };
    
    return basePrice * peakMultiplier * (marketMultipliers[marketType] || 1.0);
  }

  /**
   * Get price trend (simulated)
   */
  getPriceTrend(marketType) {
    // Simulate price trend: 0 = low, 1 = high
    const hour = new Date().getHours();
    const baseTrend = Math.sin((hour / 24) * 2 * Math.PI) * 0.5 + 0.5;
    return Math.min(1, Math.max(0, baseTrend + (Math.random() - 0.5) * 0.2));
  }

  /**
   * Get market duration
   */
  getMarketDuration(marketType) {
    const durations = {
      'day_ahead': 1440, // 24 hours
      'intraday': 60, // 1 hour
      'balancing': 15 // 15 minutes
    };
    return durations[marketType] || 60;
  }

  /**
   * Get service type for market
   */
  getServiceType(marketType) {
    const serviceTypes = {
      'day_ahead': 'SRAS',
      'intraday': 'TRAS',
      'balancing': 'DR'
    };
    return serviceTypes[marketType] || 'SRAS';
  }

  /**
   * Execute trading strategy for all markets
   */
  async executeTradingStrategy() {
    try {
      const systemState = await dataAggregator.getVirtualPlantState();
      const forecast = await forecastEngine.generateLoadForecast(24);
      const gridStress = await forecastEngine.generateGridStressForecast(6);
      
      const strategies = {};
      const bids = [];
      
      // Generate strategies for each market type
      for (const marketType of this.marketTypes) {
        const strategy = await this.generateBidStrategy(marketType, systemState, {
          ...forecast,
          gridStress
        });
        strategies[marketType] = strategy;
        
        // Create bid if action is not 'hold'
        if (strategy.action !== 'hold' && strategy.bidParams.capacity_mw > 0) {
          try {
            const bid = await marketBidding.prepareBid(
              strategy.bidParams.service_type,
              strategy.bidParams.capacity_mw,
              strategy.bidParams.price_per_mw,
              strategy.bidParams.duration_minutes
            );
            
            // Store bid with RL metadata
            const bidCollection = getCollection('market_bids');
            await bidCollection.updateOne(
              { bid_id: bid.bid_id },
              {
                $set: {
                  rl_strategy: strategy,
                  placed_by: 'rl_agent',
                  placed_at: new Date()
                }
              }
            );
            
            bids.push({
              bid_id: bid.bid_id,
              market_type: marketType,
              action: strategy.action,
              status: bid.status
            });
          } catch (error) {
            logger.error(`Error placing bid for ${marketType}:`, error);
          }
        }
      }
      
      // Store trading session
      const tradingCollection = getCollection('trading_sessions');
      await tradingCollection.insertOne({
        strategies,
        bids,
        systemState: {
          availableReserve: systemState.available_reserve_mw,
          avgSOC: systemState.avg_soc,
          totalCapacity: systemState.total_capacity_mw
        },
        timestamp: new Date(),
        placed_by: 'rl_agent'
      });
      
      // Publish trading event
      await publishMessage('trading:strategy', {
        strategies,
        bids,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        strategies,
        bids,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error executing trading strategy:', error);
      throw error;
    }
  }

  /**
   * Get trading history
   */
  async getTradingHistory(limit = 50) {
    try {
      const tradingCollection = getCollection('trading_sessions');
      const history = await tradingCollection.find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return history;
    } catch (error) {
      logger.error('Error fetching trading history:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const tradingCollection = getCollection('trading_sessions');
      const recentSessions = await tradingCollection.find({})
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();
      
      let totalReward = 0;
      let totalBids = 0;
      let successfulBids = 0;
      const marketStats = {};
      
      for (const session of recentSessions) {
        for (const [marketType, strategy] of Object.entries(session.strategies || {})) {
          if (!marketStats[marketType]) {
            marketStats[marketType] = {
              totalActions: 0,
              buyActions: 0,
              sellActions: 0,
              holdActions: 0,
              totalReward: 0
            };
          }
          
          marketStats[marketType].totalActions++;
          marketStats[marketType][`${strategy.action}Actions`]++;
          marketStats[marketType].totalReward += strategy.expectedReward || 0;
          totalReward += strategy.expectedReward || 0;
        }
        
        totalBids += session.bids?.length || 0;
        successfulBids += session.bids?.filter(b => b.status === 'accepted').length || 0;
      }
      
      return {
        totalReward,
        averageReward: recentSessions.length > 0 ? totalReward / recentSessions.length : 0,
        totalBids,
        successfulBids,
        successRate: totalBids > 0 ? successfulBids / totalBids : 0,
        marketStats,
        qTableSize: this.qTable.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error calculating performance metrics:', error);
      throw error;
    }
  }
}

export default new RLTradingAgent();

