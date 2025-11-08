const mongoose = require('mongoose');

const TransactionLogSchema = new mongoose.Schema({
  // Core transaction information
  transactionId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  nodeId: { 
    type: String, 
    required: true, 
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  
  // Transaction type and category
  type: {
    type: String,
    required: true,
    enum: [
      'dispatch', 'bid', 'settlement', 'maintenance', 
      'alarm', 'forecast_update', 'curtailment', 
      'demand_response', 'ancillary_service'
    ],
    index: true
  },
  category: {
    type: String,
    enum: ['energy', 'capacity', 'reserve', 'regulation', 'reactive_power'],
    index: true
  },
  
  // Market and operational data
  marketData: {
    marketType: { 
      type: String, 
      enum: ['day_ahead', 'real_time', 'ancillary', 'bilateral', 'capacity'] 
    },
    tradingInterval: Date, // delivery period start
    intervalDuration: Number, // minutes
    bidId: String,
    auctionId: String,
    clearingPrice: Number, // $/MWh
    locationalPrice: Number // $/MWh (LMP)
  },
  
  // Dispatch and operation details
  operationalData: {
    dispatchAmount: Number, // kW
    actualOutput: Number, // kW
    duration: Number, // minutes
    rampRate: Number, // kW/min
    startTime: Date,
    endTime: Date,
    efficiency: Number, // %
    performanceRatio: Number // actual/expected
  },
  
  // Financial information
  financial: {
    bidPrice: Number, // $/MWh
    clearedPrice: Number, // $/MWh
    revenue: Number, // $
    costs: Number, // $
    profit: Number, // $
    penalties: Number, // $
    incentives: Number, // $
    currency: { type: String, default: 'USD' }
  },
  
  // Settlement and blockchain data
  settlement: {
    settlementId: String,
    settlementDate: Date,
    meterData: {
      startReading: Number, // kWh
      endReading: Number, // kWh
      netGeneration: Number // kWh
    },
    qualityAdjustments: Number, // $
    transmissionCharges: Number, // $
    ancillaryCharges: Number, // $
    taxes: Number // $
  },
  
  // Blockchain integration
  blockchain: {
    txHash: String,
    blockNumber: Number,
    gasUsed: Number,
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'failed'], 
      default: 'pending' 
    },
    smartContractAddress: String,
    eventLogs: [mongoose.Schema.Types.Mixed]
  },
  
  // Transaction status and lifecycle
  status: {
    type: String,
    enum: ['initiated', 'pending', 'executed', 'settled', 'failed', 'cancelled', 'disputed'],
    default: 'initiated',
    index: true
  },
  
  // Error handling and retry logic
  errors: [{
    timestamp: Date,
    code: String,
    message: String,
    severity: { type: String, enum: ['warning', 'error', 'critical'] },
    resolved: { type: Boolean, default: false }
  }],
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  
  // Forecast and prediction data
  forecast: {
    predictedOutput: Number, // kW
    forecastHorizon: Number, // minutes
    confidence: Number, // 0-1
    weatherForecast: {
      temperature: Number,
      cloudCover: Number,
      windSpeed: Number,
      precipitation: Number
    },
    marketForecast: {
      predictedPrice: Number, // $/MWh
      priceVolatility: Number // standard deviation
    }
  },
  
  // Compliance and regulatory
  compliance: {
    gridCode: String,
    regulatoryRequirements: [String],
    environmentalImpact: {
      co2Emissions: Number, // tons
      co2Avoided: Number, // tons
      renewableGeneration: Number // kWh
    }
  },
  
  // Additional metadata
  metadata: {
    source: String, // originating system
    correlationId: String, // for tracing related transactions
    tags: [String],
    notes: String,
    priority: { type: Number, default: 1, min: 1, max: 5 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for efficient querying
TransactionLogSchema.index({ nodeId: 1, timestamp: -1 });
TransactionLogSchema.index({ type: 1, status: 1, timestamp: -1 });
TransactionLogSchema.index({ 'marketData.tradingInterval': 1, type: 1 });
TransactionLogSchema.index({ 'settlement.settlementDate': 1 });
TransactionLogSchema.index({ 'blockchain.txHash': 1 });

// TTL index for data retention (2 years)
TransactionLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

// Pre-save middleware
TransactionLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate profit if revenue and costs are available
  if (this.financial.revenue !== undefined && this.financial.costs !== undefined) {
    this.financial.profit = this.financial.revenue - this.financial.costs;
  }
  
  // Auto-generate transaction ID if not provided
  if (!this.transactionId) {
    this.transactionId = `txn_${this.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  next();
});

// Methods for transaction lifecycle management
TransactionLogSchema.methods.markExecuted = function(actualData) {
  this.status = 'executed';
  this.operationalData.actualOutput = actualData.actualOutput;
  this.operationalData.efficiency = actualData.efficiency;
  this.updatedAt = new Date();
  return this.save();
};

TransactionLogSchema.methods.markSettled = function(settlementData) {
  this.status = 'settled';
  this.settlement = { ...this.settlement, ...settlementData };
  this.updatedAt = new Date();
  return this.save();
};

TransactionLogSchema.methods.addError = function(error) {
  this.errors.push({
    timestamp: new Date(),
    ...error
  });
  this.updatedAt = new Date();
  return this.save();
};

// Static methods for analytics and reporting
TransactionLogSchema.statics.getRevenueByPeriod = function(nodeId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        nodeId,
        timestamp: { $gte: startDate, $lte: endDate },
        status: 'settled',
        type: { $in: ['dispatch', 'settlement'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        totalRevenue: { $sum: '$financial.revenue' },
        totalCosts: { $sum: '$financial.costs' },
        totalProfit: { $sum: '$financial.profit' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

TransactionLogSchema.statics.getPerformanceMetrics = function(nodeId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        nodeId,
        timestamp: { $gte: startDate, $lte: endDate },
        type: 'dispatch',
        status: { $in: ['executed', 'settled'] }
      }
    },
    {
      $group: {
        _id: null,
        avgPerformanceRatio: { $avg: '$operationalData.performanceRatio' },
        totalDispatched: { $sum: '$operationalData.dispatchAmount' },
        totalActual: { $sum: '$operationalData.actualOutput' },
        avgEfficiency: { $avg: '$operationalData.efficiency' },
        dispatchCount: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('TransactionLog', TransactionLogSchema);
