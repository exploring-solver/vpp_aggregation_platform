// src/models/metadata.model.js
import mongoose from "mongoose";

const MetadataSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, unique: true, index: true }, // Primary identifier
    dataCenterId: { type: String, required: true, index: true },
    
    location: {
      coordinates: { 
        type: [Number], 
        index: '2dsphere' // [longitude, latitude]
      },
      address: String,
      region: String,
      country: String,
      timezone: String,
      elevation: Number
    },
    
    capacity: {
      rated: { type: Number, required: true },
      available: { type: Number, required: true },
      reserve: { type: Number, default: 0 },
      storageCapacity: Number,
      maxRampRate: Number,
      minOperatingLevel: Number
    },
    
    tariffs: {
      baseRate: { type: Number, required: true },
      peakRate: Number,
      offPeakRate: Number,
      demandCharge: Number,
      timeOfUseRates: [{
        startTime: String,
        endTime: String,
        rate: Number,
        days: [String],
        season: { type: String, enum: ['summer', 'winter', 'all'] }
      }]
    },
    
    technicalSpecs: {
      type: { 
        type: String, 
        required: true, 
        enum: ['solar', 'wind', 'battery', 'generator', 'load', 'hybrid'],
        index: true
      },
      manufacturer: String,
      model: String,
      inverterType: String,
      installationDate: Date,
      expectedLifespan: Number
    },
    
    operational: {
      isActive: { type: Boolean, default: true, index: true },
      operationalMode: { 
        type: String, 
        enum: ['automatic', 'manual', 'scheduled', 'maintenance'],
        default: 'automatic'
      },
      priority: { type: Number, default: 1, min: 1, max: 10 }
    },
    
    // Legacy fields for backward compatibility
    name: { type: String },
    properties: { type: Object }
  },
  { timestamps: true }
);

MetadataSchema.index({ 'technicalSpecs.type': 1, 'operational.isActive': 1 });
MetadataSchema.index({ dataCenterId: 1, 'operational.isActive': 1 });

export default mongoose.models.Metadata || mongoose.model("Metadata", MetadataSchema);