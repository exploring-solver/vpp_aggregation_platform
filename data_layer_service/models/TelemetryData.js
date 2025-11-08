const mongoose = require('mongoose');

const TelemetryDataSchema = new mongoose.Schema({
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
  powerOutput: { 
    type: Number, 
    required: true 
  }, // kW
  voltage: { 
    type: Number, 
    required: true 
  }, // V
  current: { 
    type: Number, 
    required: true 
  }, // A
  frequency: { 
    type: Number, 
    required: true 
  }, // Hz
  temperature: Number, // °C
  efficiency: Number, // %
  batteryLevel: Number, // % for storage systems
  
  // Weather conditions for renewable sources
  weatherConditions: {
    solarIrradiance: Number, // W/m²
    windSpeed: Number, // m/s
    ambientTemperature: Number, // °C
    humidity: Number, // %
    cloudCover: Number, // %
    precipitation: Number // mm/h
  },
  
  // Grid integration metrics
  gridMetrics: {
    gridFrequency: Number,
    gridVoltage: Number,
    powerFactor: Number,
    harmonicDistortion: Number,
    reactivePower: Number,
  },
  
  // System health indicators
  alarms: [{
    code: String,
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'] 
    },
    description: String,
    acknowledged: { type: Boolean, default: false }
  }],
  
  // Performance metrics
  performance: {
    capacity: Number, // kW
    availability: Number, // %
    reliability: Number, // %
    maintenanceStatus: { 
      type: String, 
      enum: ['operational', 'maintenance', 'fault', 'offline'] 
    }
  },
  
  // Data quality indicators
  dataQuality: {
    completeness: { type: Number, min: 0, max: 1 }, // 0-1
    accuracy: { type: Number, min: 0, max: 1 }, // 0-1
    source: { type: String, enum: ['scada', 'sensor', 'estimated', 'manual'] },
    validated: { type: Boolean, default: false }
  }
});

// Compound indexes for efficient time-series queries
TelemetryDataSchema.index({ nodeId: 1, timestamp: -1 });
TelemetryDataSchema.index({ timestamp: -1, 'performance.maintenanceStatus': 1 });
TelemetryDataSchema.index({ 'alarms.severity': 1, timestamp: -1 });

// TTL index for automatic data cleanup (30 days)
TelemetryDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Static methods for aggregation queries
TelemetryDataSchema.statics.getNodeTelemetry = function(nodeId, startDate, endDate) {
  return this.find({
    nodeId,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: 1 });
};

TelemetryDataSchema.statics.getAggregatedData = function(nodeId, granularity = 'hour', startDate, endDate) {
  const matchStage = {
    nodeId,
    timestamp: { $gte: startDate, $lte: endDate }
  };

  let groupId;
  switch (granularity) {
    case 'minute':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' },
        minute: { $minute: '$timestamp' }
      };
      break;
    case 'hour':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };
      break;
    case 'day':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
      break;
    default:
      groupId = '$timestamp';
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupId,
        avgPowerOutput: { $avg: '$powerOutput' },
        maxPowerOutput: { $max: '$powerOutput' },
        minPowerOutput: { $min: '$powerOutput' },
        avgEfficiency: { $avg: '$efficiency' },
        avgTemperature: { $avg: '$temperature' },
        totalGeneration: { $sum: { $multiply: ['$powerOutput', 1/60] } }, // kWh assuming minute intervals
        dataPoints: { $sum: 1 },
        timestamp: { $first: '$timestamp' }
      }
    },
    { $sort: { timestamp: 1 } }
  ]);
};

module.exports = mongoose.model('TelemetryData', TelemetryDataSchema);
