const express = require('express');
const router = express.Router();
const DataIngestionService = require('../services/DataIngestionService');
const AnalyticsEngine = require('../services/AnalyticsEngine');
const NodeMetadata = require('../models/NodeMetadata');
const TelemetryData = require('../models/TelemetryData');
const TransactionLog = require('../models/TransactionLog');

// Telemetry endpoints
router.post('/telemetry/:nodeId', async (req, res) => {
  try {
    const result = await DataIngestionService.ingestTelemetryData(req.params.nodeId, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/telemetry/batch', async (req, res) => {
  try {
    const result = await DataIngestionService.batchIngestTelemetry(req.body.batch);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/telemetry/:nodeId/latest', async (req, res) => {
  try {
    const telemetry = await DataIngestionService.getLatestTelemetry(req.params.nodeId);
    res.json(telemetry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/telemetry/:nodeId/historical', async (req, res) => {
  try {
    const { startDate, endDate, granularity = 'hour' } = req.query;
    const data = await DataIngestionService.getHistoricalTelemetry(
      req.params.nodeId,
      startDate,
      endDate,
      granularity
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transaction endpoints
router.post('/transactions', async (req, res) => {
  try {
    const result = await DataIngestionService.logTransaction(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/transactions/:nodeId', async (req, res) => {
  try {
    const { startDate, endDate, type, status } = req.query;
    const query = { nodeId: req.params.nodeId };
    
    if (startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (type) query.type = type;
    if (status) query.status = status;
    
    const transactions = await TransactionLog.find(query)
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoints
router.get('/analytics/:nodeId/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const analytics = await AnalyticsEngine.calculateDailyAnalytics(
      req.params.nodeId,
      date ? new Date(date) : new Date()
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:nodeId/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const analytics = await AnalyticsEngine.calculateMonthlyAnalytics(
      req.params.nodeId,
      parseInt(year),
      parseInt(month)
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:nodeId/benchmarks', async (req, res) => {
  try {
    const { period = 30 } = req.query;
    const benchmarks = await AnalyticsEngine.calculatePerformanceBenchmarks(
      req.params.nodeId,
      parseInt(period)
    );
    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/portfolio', async (req, res) => {
  try {
    const { nodeIds, startDate, endDate } = req.query;
    const nodeList = Array.isArray(nodeIds) ? nodeIds : nodeIds.split(',');
    const analytics = await AnalyticsEngine.calculatePortfolioAnalytics(
      nodeList,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Metadata endpoints
router.post('/metadata', async (req, res) => {
  try {
    const metadata = new NodeMetadata(req.body);
    await metadata.save();
    res.status(201).json(metadata);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/metadata/:nodeId', async (req, res) => {
  try {
    const metadata = await NodeMetadata.findOne({ nodeId: req.params.nodeId });
    if (!metadata) {
      return res.status(404).json({ error: 'Node metadata not found' });
    }
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/metadata/:nodeId', async (req, res) => {
  try {
    const metadata = await NodeMetadata.findOneAndUpdate(
      { nodeId: req.params.nodeId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!metadata) {
      return res.status(404).json({ error: 'Node metadata not found' });
    }
    res.json(metadata);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Query endpoints
router.get('/nodes/active', async (req, res) => {
  try {
    const nodes = await NodeMetadata.getActiveNodes();
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nodes/by-type/:type', async (req, res) => {
  try {
    const nodes = await NodeMetadata.getNodesByType(req.params.type);
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nodes/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    const nodes = await NodeMetadata.find({
      'location.coordinates': {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radius) / 6378.1]
        }
      },
      'operational.isActive': true
    });
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time aggregation endpoint
router.get('/realtime/portfolio', async (req, res) => {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });
    
    const aggregation = await redis.hgetall('realtime:portfolio:aggregation');
    res.json(aggregation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revenue reporting endpoints
router.get('/revenue/:nodeId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const revenue = await TransactionLog.getRevenueByPeriod(
      req.params.nodeId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Performance metrics endpoints
router.get('/performance/:nodeId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const performance = await TransactionLog.getPerformanceMetrics(
      req.params.nodeId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data quality endpoints
router.get('/data-quality/:nodeId', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const qualityMetrics = await TelemetryData.aggregate([
      {
        $match: {
          nodeId: req.params.nodeId,
          timestamp: { $gte: cutoff }
        }
      },
      {
        $group: {
          _id: null,
          avgCompleteness: { $avg: '$dataQuality.completeness' },
          avgAccuracy: { $avg: '$dataQuality.accuracy' },
          validatedCount: { $sum: { $cond: ['$dataQuality.validated', 1, 0] } },
          totalCount: { $sum: 1 },
          sources: { $addToSet: '$dataQuality.source' }
        }
      }
    ]);
    
    res.json(qualityMetrics[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });
    
    // Check MongoDB connection
    const mongoStatus = require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check Redis connection
    let redisStatus = 'disconnected';
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'error';
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
