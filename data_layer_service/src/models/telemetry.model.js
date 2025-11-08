// src/models/telemetry.model.js
import mongoose from "mongoose";

const TelemetrySchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    
    // Core metrics (from original TelemetryData.js)
    powerOutput: { type: Number, required: true }, // kW
    voltage: { type: Number, required: true }, // V
    current: { type: Number, required: true }, // A
    frequency: { type: Number, required: true }, // Hz
    temperature: Number,
    efficiency: Number,
    batteryLevel: Number,
    
    // Weather conditions for renewable sources
    weatherConditions: {
      solarIrradiance: Number,
      windSpeed: Number,
      ambientTemperature: Number,
      humidity: Number,
      cloudCover: Number,
      precipitation: Number
    },
    
    // Grid integration metrics
    gridMetrics: {
      gridFrequency: Number,
      gridVoltage: Number,
      powerFactor: Number,
      harmonicDistortion: Number,
      reactivePower: Number
    },
    
    // System health
    alarms: [{
      code: String,
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      description: String,
      acknowledged: { type: Boolean, default: false }
    }],
    
    // Performance metrics
    performance: {
      capacity: Number,
      availability: Number,
      reliability: Number,
      maintenanceStatus: { 
        type: String, 
        enum: ['operational', 'maintenance', 'fault', 'offline'] 
      }
    },
    
    // Data quality
    dataQuality: {
      completeness: { type: Number, min: 0, max: 1 },
      accuracy: { type: Number, min: 0, max: 1 },
      source: { type: String, enum: ['scada', 'sensor', 'estimated', 'manual'] },
      validated: { type: Boolean, default: false }
    },
    
    // Legacy support for your existing "metrics" object
    metrics: { type: Object },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

// Compound indexes
TelemetrySchema.index({ nodeId: 1, timestamp: -1 });
TelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

export default mongoose.models.Telemetry || mongoose.model("Telemetry", TelemetrySchema);