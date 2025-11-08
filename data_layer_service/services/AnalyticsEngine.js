const TelemetryData = require('../models/TelemetryData');
const NodeMetadata = require('../models/NodeMetadata');
const TransactionLog = require('../models/TransactionLog');
const Redis = require('ioredis');

class AnalyticsEngine {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  // Daily analytics calculation
  async calculateDailyAnalytics(nodeId, date = new Date()) {
    const cacheKey = `analytics:daily:${nodeId}:${date.toISOString().split('T')[0]}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      // Get telemetry data for the day
      const telemetryData = await TelemetryData.find({
        nodeId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      }).sort({ timestamp: 1 });

      // Get transaction data for revenue calculation
      const transactions = await TransactionLog.find({
        nodeId,
        timestamp: { $gte: startOfDay, $lte: endOfDay },
        status: 'settled'
      });

      // Calculate metrics
      const analytics = await this.computeDailyMetrics(telemetryData, transactions);
      
      // Cache for 4 hours
      await this.redis.setex(cacheKey, 14400, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Error calculating daily analytics:', error);
      throw error;
    }
  }

  // Monthly analytics aggregation
  async calculateMonthlyAnalytics(nodeId, year, month) {
    const cacheKey = `analytics:monthly:${nodeId}:${year}:${month}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    try {
      const [telemetryAgg, revenueAgg, performanceAgg] = await Promise.all([
        this.aggregateTelemetryByMonth(nodeId, startOfMonth, endOfMonth),
        this.aggregateRevenueByMonth(nodeId, startOfMonth, endOfMonth),
        this.aggregatePerformanceByMonth(nodeId, startOfMonth, endOfMonth)
      ]);

      const analytics = {
        period: { year, month },
        generation: telemetryAgg,
        revenue: revenueAgg,
        performance: performanceAgg,
        calculatedAt: new Date()
      };

      // Cache for 24 hours
      await this.redis.setex(cacheKey, 86400, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Error calculating monthly analytics:', error);
      throw error;
    }
  }

  // Real-time portfolio aggregation
  async updatePortfolioAggregation(nodeUpdates) {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const { nodeId, telemetryData } of nodeUpdates) {
        // Update individual node metrics
        const nodeKey = `realtime:node:${nodeId}`;
        pipeline.hset(nodeKey, {
          powerOutput: telemetryData.powerOutput,
          efficiency: telemetryData.efficiency || 0,
          timestamp: Date.now(),
          status: 'online'
        });
        pipeline.expire(nodeKey, 300); // 5 minute expiry
      }

      // Calculate portfolio totals
      const totalPower = nodeUpdates.reduce((sum, update) => 
        sum + update.telemetryData.powerOutput, 0);
      const avgEfficiency = nodeUpdates.reduce((sum, update) => 
        sum + (update.telemetryData.efficiency || 0), 0) / nodeUpdates.length;

      // Update portfolio aggregation
      const portfolioKey = 'realtime:portfolio:aggregation';
      pipeline.hset(portfolioKey, {
        totalPower,
        avgEfficiency,
        nodeCount: nodeUpdates.length,
        lastUpdated: Date.now()
      });
      pipeline.expire(portfolioKey, 300);

      await pipeline.exec();
      
      return {
        totalPower,
        avgEfficiency,
        nodeCount: nodeUpdates.length,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error updating portfolio aggregation:', error);
      throw error;
    }
  }

  // Performance benchmarking
  async calculatePerformanceBenchmarks(nodeId, benchmarkPeriod = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (benchmarkPeriod * 24 * 60 * 60 * 1000));

    try {
      const [telemetryStats, revenueStats, performanceStats] = await Promise.all([
        this.getTelemetryStatistics(nodeId, startDate, endDate),
        this.getRevenueStatistics(nodeId, startDate, endDate),
        this.getPerformanceStatistics(nodeId, startDate, endDate)
      ]);

      // Get node metadata for capacity calculations
      const metadata = await NodeMetadata.findOne({ nodeId });
      
      const benchmarks = {
        capacity: {
          rated: metadata?.capacity.rated || 0,
          utilizationRate: telemetryStats.avgPower / (metadata?.capacity.rated || 1),
          peakUtilization: telemetryStats.maxPower / (metadata?.capacity.rated || 1)
        },
        performance: {
          availability: performanceStats.availability,
          efficiency: telemetryStats.avgEfficiency,
          reliability: performanceStats.reliability
        },
        financial: {
          totalRevenue: revenueStats.totalRevenue,
          avgRevenuePerMWh: revenueStats.avgRevenuePerMWh,
          profitMargin: revenueStats.profitMargin
        },
        benchmarkPeriod,
        calculatedAt: new Date()
      };

      return benchmarks;
    } catch (error) {
      console.error('Error calculating performance benchmarks:', error);
      throw error;
    }
  }

  // Portfolio-wide analytics
  async calculatePortfolioAnalytics(nodeIds, startDate, endDate) {
    try {
      const portfolioData = await Promise.all(
        nodeIds.map(async (nodeId) => {
          const [telemetry, transactions, metadata] = await Promise.all([
            TelemetryData.find({
              nodeId,
              timestamp: { $gte: startDate, $lte: endDate }
            }),
            TransactionLog.find({
              nodeId,
              timestamp: { $gte: startDate, $lte: endDate },
              status: 'settled'
            }),
            NodeMetadata.findOne({ nodeId })
          ]);

          return { nodeId, telemetry, transactions, metadata };
        })
      );

      // Aggregate portfolio metrics
      const portfolioMetrics = {
        totalCapacity: portfolioData.reduce((sum, node) => 
          sum + (node.metadata?.capacity.rated || 0), 0),
        totalGeneration: portfolioData.reduce((sum, node) => 
          sum + this.calculateTotalGeneration(node.telemetry), 0),
        totalRevenue: portfolioData.reduce((sum, node) => 
          sum + this.calculateTotalRevenue(node.transactions), 0),
        avgEfficiency: portfolioData.reduce((sum, node) => 
          sum + this.calculateAvgEfficiency(node.telemetry), 0) / portfolioData.length,
        nodeCount: portfolioData.length,
        capacityFactor: 0, // Will be calculated below
        diversificationIndex: this.calculateDiversificationIndex(portfolioData)
      };

      // Calculate portfolio capacity factor
      const totalPossibleGeneration = portfolioMetrics.totalCapacity * 
        ((endDate - startDate) / (1000 * 60 * 60)); // Convert to hours
      portfolioMetrics.capacityFactor = portfolioMetrics.totalGeneration / 
        totalPossibleGeneration;

      return portfolioMetrics;
    } catch (error) {
      console.error('Error calculating portfolio analytics:', error);
      throw error;
    }
  }

  // Helper methods
  async computeDailyMetrics(telemetryData, transactions) {
    if (telemetryData.length === 0) {
      return {
        totalGeneration: 0,
        avgEfficiency: 0,
        uptime: 0,
        totalRevenue: 0,
        avgPower: 0,
        maxPower: 0,
        minPower: 0,
        dataPoints: 0
      };
    }

    const totalGeneration = telemetryData.reduce((sum, point) => 
      sum + (point.powerOutput * (1/60)), 0); // Convert to kWh
    
    const avgEfficiency = telemetryData.reduce((sum, point) => 
      sum + (point.efficiency || 0), 0) / telemetryData.length;
    
    const uptime = (telemetryData.length / (24 * 60)) * 100; // Assuming 1-minute intervals
    
    const totalRevenue = transactions.reduce((sum, txn) => 
      sum + (txn.financial?.revenue || 0), 0);
    
    const powers = telemetryData.map(point => point.powerOutput);
    const avgPower = powers.reduce((sum, power) => sum + power, 0) / powers.length;
    const maxPower = Math.max(...powers);
    const minPower = Math.min(...powers);

    return {
      totalGeneration,
      avgEfficiency,
      uptime,
      totalRevenue,
      avgPower,
      maxPower,
      minPower,
      dataPoints: telemetryData.length
    };
  }

  async aggregateTelemetryByMonth(nodeId, startDate, endDate) {
    return await TelemetryData.aggregate([
      {
        $match: {
          nodeId,
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalGeneration: { 
            $sum: { $multiply: ['$powerOutput', 1/60] } 
          }, // kWh
          avgPower: { $avg: '$powerOutput' },
          maxPower: { $max: '$powerOutput' },
          minPower: { $min: '$powerOutput' },
          avgEfficiency: { $avg: '$efficiency' },
          dataPoints: { $sum: 1 }
        }
      }
    ]);
  }

  async aggregateRevenueByMonth(nodeId, startDate, endDate) {
    return await TransactionLog.aggregate([
      {
        $match: {
          nodeId,
          timestamp: { $gte: startDate, $lte: endDate },
          status: 'settled'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$financial.revenue' },
          totalCosts: { $sum: '$financial.costs' },
          totalProfit: { $sum: '$financial.profit' },
          transactionCount: { $sum: 1 },
          avgRevenue: { $avg: '$financial.revenue' }
        }
      }
    ]);
  }

  async aggregatePerformanceByMonth(nodeId, startDate, endDate) {
    const totalMinutes = (endDate - startDate) / (1000 * 60);
    const dataPoints = await TelemetryData.countDocuments({
      nodeId,
      timestamp: { $gte: startDate, $lte: endDate }
    });

    const availability = (dataPoints / totalMinutes) * 100;
    
    return {
      availability,
      reliability: availability > 95 ? 100 : availability,
      dataPoints,
      totalMinutes
    };
  }

  calculateTotalGeneration(telemetryData) {
    return telemetryData.reduce((sum, point) => 
      sum + (point.powerOutput * (1/60)), 0);
  }

  calculateTotalRevenue(transactions) {
    return transactions.reduce((sum, txn) => 
      sum + (txn.financial?.revenue || 0), 0);
  }

  calculateAvgEfficiency(telemetryData) {
    if (telemetryData.length === 0) return 0;
    return telemetryData.reduce((sum, point) => 
      sum + (point.efficiency || 0), 0) / telemetryData.length;
  }

  calculateDiversificationIndex(portfolioData) {
    // Simple diversification index based on technology types
    const typeCount = new Set(portfolioData.map(node => 
      node.metadata?.technicalSpecs?.type)).size;
    return typeCount / portfolioData.length;
  }

  async getTelemetryStatistics(nodeId, startDate, endDate) {
    const result = await TelemetryData.aggregate([
      {
        $match: {
          nodeId,
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          avgPower: { $avg: '$powerOutput' },
          maxPower: { $max: '$powerOutput' },
          minPower: { $min: '$powerOutput' },
          avgEfficiency: { $avg: '$efficiency' },
          dataPoints: { $sum: 1 }
        }
      }
    ]);

    return result[0] || {};
  }

  async getRevenueStatistics(nodeId, startDate, endDate) {
    const result = await TransactionLog.aggregate([
      {
        $match: {
          nodeId,
          timestamp: { $gte: startDate, $lte: endDate },
          status: 'settled'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$financial.revenue' },
          totalCosts: { $sum: '$financial.costs' },
          avgRevenue: { $avg: '$financial.revenue' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const stats = result[0] || {};
    stats.avgRevenuePerMWh = stats.avgRevenue || 0;
    stats.profitMargin = stats.totalRevenue ? 
      ((stats.totalRevenue - stats.totalCosts) / stats.totalRevenue) * 100 : 0;
    
    return stats;
  }

  async getPerformanceStatistics(nodeId, startDate, endDate) {
    const totalMinutes = (endDate - startDate) / (1000 * 60);
    const dataPoints = await TelemetryData.countDocuments({
      nodeId,
      timestamp: { $gte: startDate, $lte: endDate }
    });

    return {
      availability: (dataPoints / totalMinutes) * 100,
      reliability: dataPoints > 0 ? 95 + (dataPoints / totalMinutes) * 5 : 0,
      dataPoints,
      totalMinutes
    };
  }
}

module.exports = new AnalyticsEngine();
