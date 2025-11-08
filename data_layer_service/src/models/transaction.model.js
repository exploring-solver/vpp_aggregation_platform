// src/models/transaction.model.js
import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    nodeId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    
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
    
    marketData: {
      marketType: { 
        type: String, 
        enum: ['day_ahead', 'real_time', 'ancillary', 'bilateral', 'capacity'] 
      },
      tradingInterval: Date,
      intervalDuration: Number,
      bidId: String,
      clearingPrice: Number,
      locationalPrice: Number
    },
    
    operationalData: {
      dispatchAmount: Number,
      actualOutput: Number,
      duration: Number,
      rampRate: Number,
      startTime: Date,
      endTime: Date,
      efficiency: Number,
      performanceRatio: Number
    },
    
    financial: {
      bidPrice: Number,
      clearedPrice: Number,
      revenue: Number,
      costs: Number,
      profit: Number,
      penalties: Number,
      incentives: Number,
      currency: { type: String, default: 'USD' }
    },
    
    settlement: {
      settlementId: String,
      settlementDate: Date,
      meterData: {
        startReading: Number,
        endReading: Number,
        netGeneration: Number
      }
    },
    
    blockchain: {
      txHash: String,
      blockNumber: Number,
      status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'failed'], 
        default: 'pending' 
      }
    },
    
    status: {
      type: String,
      enum: ['initiated', 'pending', 'executed', 'settled', 'failed', 'cancelled', 'disputed'],
      default: 'initiated',
      index: true
    },
    
    // Legacy support
    amount: { type: Number },
    currency: { type: String, default: "USD" },
    details: { type: Object }
  },
  { timestamps: true }
);

TransactionSchema.index({ nodeId: 1, timestamp: -1 });
TransactionSchema.index({ type: 1, status: 1, timestamp: -1 });
TransactionSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years TTL

// Auto-generate transactionId
TransactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `txn_${this.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Calculate profit
  if (this.financial?.revenue !== undefined && this.financial?.costs !== undefined) {
    this.financial.profit = this.financial.revenue - this.financial.costs;
  }
  
  next();
});

export default mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);