const TelemetryData = require('../models/TelemetryData');
const TransactionLog = require('../models/TransactionLog');
const AnalyticsEngine = require('./AnalyticsEngine');
const Redis = require('ioredis');
const Queue = require('bull');

class DataIngestionService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    // Initialize processing queues
    this.telemetryQueue = new Queue('telemetry processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });

    this.transactionQueue = new Queue('transaction processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });

    this.setupQueueProcessors();
    this.setupBatchProcessing();
  }

  // High-frequency telemetry data ingestion
  async ingestTelemetryData(nodeId, telemetryData) {
    try {
      // Validate incoming data
      const validatedData = this.validateTelemetryData(nodeId, telemetryData);
      
      // Store in time-series collection
      const telemetryDoc = new TelemetryData(validatedData);
      await telemetryDoc.save();

      // Cache latest reading for real-time access
      await this.cacheLatestTelemetry(nodeId, validatedData);

      // Queue for batch processing and analytics
      await this.telemetryQueue.add('process-telemetry', {
        nodeId,
        telemetryId: telemetryDoc._id,
        timestamp: validatedData.timestamp
      }, {
        delay: 1000, // 1 second delay for batch processing
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });

      return {
        success: true,
        telemetryId: telemetryDoc._id,
        timestamp: validatedData.timestamp
      };
    } catch (error) {
      console.error('Error ingesting telemetry data:', error);
      throw error;
    }
  }

  // Batch telemetry ingestion for high-throughput scenarios
  async batchIngestTelemetry(telemetryBatch) {
    try {
      const validatedBatch = telemetryBatch.map(item => 
        this.validateTelemetryData(item.nodeId, item.data));

      // Use bulk insert for better performance
      const insertedDocs = await TelemetryData.insertMany(validatedBatch, {
        ordered: false, // Continue on individual failures
        rawResult: true
      });

      // Update cache for all nodes
      const cachePromises = telemetryBatch.map(item => 
        this.cacheLatestTelemetry(item.nodeId, item.data));
      await Promise.allSettled(cachePromises);

      // Queue for portfolio aggregation update
      await AnalyticsEngine.updatePortfolioAggregation(
        telemetryBatch.map(item => ({
          nodeId: item.nodeId,
          telemetryData: item.data
        }))
      );

      return {
        success: true,
        inserted: insertedDocs.insertedCount,
        errors: insertedDocs.writeErrors || []
      };
    } catch (error) {
      console.error('Error in batch telemetry ingestion:', error);
      throw error;
    }
  }

  // Transaction logging with blockchain integration
  async logTransaction(transactionData) {
    try {
      // Validate transaction data
      const validatedData = this.validateTransactionData(transactionData);
      
      // Create transaction log entry
      const transaction = new TransactionLog(validatedData);
      await transaction.save();

      // Cache for real-time access
      await this.cacheLatestTransaction(validatedData.nodeId, validatedData);

      // Queue for blockchain settlement if applicable
      if (validatedData.type === 'settlement') {
        await this.transactionQueue.add('blockchain-settlement', {
          transactionId: transaction.transactionId,
          nodeId: validatedData.nodeId,
          settlementData: validatedData.settlement
        }, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 }
        });
      }

      // Update revenue analytics if it's a revenue transaction
      if (validatedData.financial?.revenue) {
        await this.updateRevenueCache(validatedData.nodeId, validatedData.financial.revenue);
      }

      return {
        success: true,
        transactionId: transaction.transactionId,
        timestamp: transaction.timestamp
      };
    } catch (error) {
      console.error('Error logging transaction:', error);
      throw error;
    }
  }

  // Real-time data streaming
  async streamTelemetryData(nodeId, callback) {
    const streamKey = `telemetry:stream:${nodeId}`;
    
    // Subscribe to Redis stream for real-time updates
    const subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    subscriber.subscribe(streamKey, (err, count) => {
      if (err) {
        console.error('Error subscribing to telemetry stream:', err);
        return;
      }
      console.log(`Subscribed to ${count} channels`);
    });

    subscriber.on('message', (channel, message) => {
      try {
        const telemetryData = JSON.parse(message);
        callback(null, telemetryData);
      } catch (error) {
        callback(error, null);
      }
    });

    return subscriber;
  }

  // Data validation methods
  validateTelemetryData(nodeId, data) {
    const validated = {
      nodeId,
      timestamp: data.timestamp || new Date(),
      powerOutput: this.validateNumber(data.powerOutput, 'powerOutput'),
      voltage: this.validateNumber(data.voltage, 'voltage'),
      current: this.validateNumber(data.current, 'current'),
      frequency: this.validateNumber(data.frequency, 'frequency'),
      temperature: data.temperature,
      efficiency: data.efficiency,
      batteryLevel: data.batteryLevel,
      weatherConditions: data.weatherConditions || {},
      gridMetrics: data.gridMetrics || {},
      alarms: Array.isArray(data.alarms) ? data.alarms : [],
      performance: data.performance || {},
      dataQuality: {
        completeness: this.calculateCompleteness(data),
        accuracy: data.dataQuality?.accuracy || 1.0,
        source: data.dataQuality?.source || 'sensor',
        validated: false
      }
    };

    return validated;
  }

  validateTransactionData(data) {
    return {
      transactionId: data.transactionId || this.generateTransactionId(data.nodeId),
      nodeId: data.nodeId,
      timestamp: data.timestamp || new Date(),
      type: data.type,
      category: data.category,
      marketData: data.marketData || {},
      operationalData: data.operationalData || {},
      financial: data.financial || {},
      settlement: data.settlement || {},
      blockchain: data.blockchain || { status: 'pending' },
      status: data.status || 'initiated',
      forecast: data.forecast || {},
      compliance: data.compliance || {},
      metadata: data.metadata || {}
    };
  }

  validateNumber(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Invalid ${fieldName}: ${value}`);
    }
    return num;
  }

  calculateCompleteness(data) {
    const requiredFields = ['powerOutput', 'voltage', 'current', 'frequency'];
    const presentFields = requiredFields.filter(field => 
      data[field] !== undefined && data[field] !== null);
    return presentFields.length / requiredFields.length;
  }

  // Caching methods
  async cacheLatestTelemetry(nodeId, telemetryData) {
    const cacheKey = `telemetry:latest:${nodeId}`;
    const cacheData = {
      ...telemetryData,
      cachedAt: Date.now()
    };
    
    await this.redis.setex(cacheKey, 300, JSON.stringify(cacheData)); // 5 minute cache
    
    // Also publish to stream for real-time subscribers
    await this.redis.publish(`telemetry:stream:${nodeId}`, JSON.stringify(cacheData));
  }

  async cacheLatestTransaction(nodeId, transactionData) {
    const cacheKey = `transaction:latest:${nodeId}`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify({
      ...transactionData,
      cachedAt: Date.now()
    })); // 1 hour cache
  }

  async updateRevenueCache(nodeId, revenue) {
    const today = new Date().toISOString().split('T')[0];
    const revenueKey = `revenue:daily:${nodeId}:${today}`;
    
    const currentRevenue = await this.redis.get(revenueKey);
    const totalRevenue = (parseFloat(currentRevenue) || 0) + revenue;
    
    await this.redis.setex(revenueKey, 86400, totalRevenue.toString()); // 24 hour cache
  }

  // Queue processors
  setupQueueProcessors() {
    // Telemetry processing
    this.telemetryQueue.process('process-telemetry', async (job) => {
      const { nodeId, telemetryId, timestamp } = job.data;
      
      try {
        // Trigger analytics calculations if needed
        const shouldCalculate = await this.shouldTriggerAnalytics(nodeId, timestamp);
        if (shouldCalculate) {
          await AnalyticsEngine.calculateDailyAnalytics(nodeId, new Date(timestamp));
        }
        
        return { processed: true, telemetryId };
      } catch (error) {
        console.error('Error processing telemetry:', error);
        throw error;
      }
    });

    // Transaction processing
    this.transactionQueue.process('blockchain-settlement', async (job) => {
      const { transactionId, nodeId, settlementData } = job.data;
      
      try {
        // Simulate blockchain settlement
        const txHash = await this.submitToBlockchain(settlementData);
        
        // Update transaction with blockchain info
        await TransactionLog.findOneAndUpdate(
          { transactionId },
          {
            'blockchain.txHash': txHash,
            'blockchain.status': 'confirmed',
            status: 'settled'
          }
        );
        
        return { settled: true, txHash };
      } catch (error) {
        console.error('Error processing blockchain settlement:', error);
        throw error;
      }
    });
  }

  setupBatchProcessing() {
    // Process batched analytics every 5 minutes
    setInterval(async () => {
      try {
        await this.processBatchedAnalytics();
      } catch (error) {
        console.error('Error in batch analytics processing:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async processBatchedAnalytics() {
    // Get nodes that need analytics updates
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const recentNodes = await TelemetryData.distinct('nodeId', {
      timestamp: { $gte: cutoffTime }
    });

    // Process analytics for each node
    const promises = recentNodes.map(nodeId => 
      AnalyticsEngine.calculateDailyAnalytics(nodeId).catch(error => {
        console.error(`Error calculating analytics for node ${nodeId}:`, error);
      })
    );

    await Promise.allSettled(promises);
    console.log(`Processed batch analytics for ${recentNodes.length} nodes`);
  }

  async shouldTriggerAnalytics(nodeId, timestamp) {
    const lastCalculated = await this.redis.get(`analytics:last:${nodeId}`);
    if (!lastCalculated) return true;
    
    const timeDiff = new Date(timestamp) - new Date(lastCalculated);
    return timeDiff > 15 * 60 * 1000; // 15 minutes
  }

  async submitToBlockchain(settlementData) {
    // Simulate blockchain submission
    // In real implementation, this would interact with smart contracts
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  generateTransactionId(nodeId) {
    return `txn_${nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods for data retrieval
  async getLatestTelemetry(nodeId) {
    const cacheKey = `telemetry:latest:${nodeId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fallback to database
    const latest = await TelemetryData.findOne({ nodeId }).sort({ timestamp: -1 });
    if (latest) {
      await this.cacheLatestTelemetry(nodeId, latest.toObject());
    }
    
    return latest;
  }

  async getHistoricalTelemetry(nodeId, startDate, endDate, granularity = 'hour') {
    const cacheKey = `historical:${nodeId}:${startDate}:${endDate}:${granularity}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const data = await TelemetryData.getAggregatedData(nodeId, granularity, 
      new Date(startDate), new Date(endDate));
    
    // Cache for 1 hour
    await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
    
    return data;
  }
}

module.exports = new DataIngestionService();
