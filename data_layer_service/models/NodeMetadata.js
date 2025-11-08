const mongoose = require('mongoose');

const NodeMetadataSchema = new mongoose.Schema({
  nodeId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  // Data center and location information
  dataCenterId: { 
    type: String, 
    required: true, 
    index: true 
  },
  location: {
    coordinates: { 
      type: [Number], 
      index: '2dsphere',
      validate: {
        validator: function(v) {
          return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges'
      }
    }, // [longitude, latitude]
    address: String,
    region: String,
    country: String,
    timezone: String,
    elevation: Number // meters above sea level
  },
  
  // Capacity and technical specifications
  capacity: {
    rated: { 
      type: Number, 
      required: true 
    }, // kW
    available: { 
      type: Number, 
      required: true 
    }, // kW
    reserve: { 
      type: Number, 
      default: 0 
    }, // kW
    storageCapacity: Number, // kWh for battery systems
    maxRampRate: Number, // kW/min
    minOperatingLevel: Number // kW
  },
  
  // Tariff and pricing information
  tariffs: {
    baseRate: { 
      type: Number, 
      required: true 
    }, // $/kWh
    peakRate: Number, // $/kWh
    offPeakRate: Number, // $/kWh
    demandCharge: Number, // $/kW
    timeOfUseRates: [{
      startTime: String, // HH:mm
      endTime: String, // HH:mm
      rate: Number, // $/kWh
      days: [String], // ['monday', 'tuesday', ...]
      season: { type: String, enum: ['summer', 'winter', 'all'] }
    }],
    ancillaryServiceRates: {
      regulation: Number, // $/MW
      spinning: Number, // $/MW
      nonSpinning: Number, // $/MW
      replacement: Number // $/MW
    }
  },
  
  // Technical specifications
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
    panelType: String, // for solar
    turbineModel: String, // for wind
    batteryTechnology: String, // for storage (lithium-ion, flow, etc.)
    fuelType: String, // for generators
    installationDate: Date,
    commissioningDate: Date,
    warrantyExpiry: Date,
    expectedLifespan: Number, // years
    maintenanceSchedule: {
      frequency: String, // 'monthly', 'quarterly', 'annual'
      lastMaintenance: Date,
      nextMaintenance: Date,
      maintenanceProvider: String
    }
  },
  
  // Grid connection details
  gridConnection: {
    interconnectionId: String,
    substationId: String,
    voltageLevel: Number, // kV
    connectionType: { 
      type: String, 
      enum: ['transmission', 'distribution', 'microgrid', 'behind-meter'] 
    },
    maxInjection: Number, // kW
    maxWithdrawal: Number, // kW
    gridCodes: [String], // applicable grid codes
    meteringPoint: String,
    transmissionLosses: Number // %
  },
  
  // Certifications and compliance
  certifications: [{
    type: String, // 'ISO', 'IEEE', 'UL', etc.
    number: String,
    issuedDate: Date,
    expiryDate: Date,
    issuingBody: String
  }],
  
  // Environmental data
  environmental: {
    carbonIntensity: Number, // gCO2/kWh
    renewableFraction: Number, // 0-1
    environmentalCertificates: [String], // RECs, GOOs, etc.
    emissionsFactor: Number // tons CO2/MWh
  },
  
  // Financial information
  financial: {
    capex: Number, // $
    opex: Number, // $/year
    lcoe: Number, // $/MWh (Levelized Cost of Energy)
    paybackPeriod: Number, // years
    irr: Number, // Internal Rate of Return %
    owner: String,
    operator: String,
    financingType: String
  },
  
  // Operational parameters
  operational: {
    isActive: { type: Boolean, default: true, index: true },
    operationalMode: { 
      type: String, 
      enum: ['automatic', 'manual', 'scheduled', 'maintenance'],
      default: 'automatic'
    },
    priority: { type: Number, default: 1, min: 1, max: 10 }, // dispatch priority
    curtailmentAllowed: { type: Boolean, default: true },
    blackStartCapable: { type: Boolean, default: false },
    demandResponseParticipant: { type: Boolean, default: false }
  },
  
  // Metadata management
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastValidated: Date,
  dataSource: String, // source system for this metadata
  version: { type: Number, default: 1 }
});

// Indexes for efficient querying
NodeMetadataSchema.index({ 'technicalSpecs.type': 1, 'operational.isActive': 1 });
NodeMetadataSchema.index({ dataCenterId: 1, 'operational.isActive': 1 });
NodeMetadataSchema.index({ 'capacity.rated': -1 });

// Pre-save middleware
NodeMetadataSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Methods
NodeMetadataSchema.methods.calculateLCOE = function() {
  const { capex, opex } = this.financial;
  const { rated } = this.capacity;
  const { expectedLifespan } = this.technicalSpecs;
  
  if (!capex || !rated || !expectedLifespan) return null;
  
  const annualGeneration = rated * 8760 * 0.3; // Assume 30% capacity factor
  const totalGeneration = annualGeneration * expectedLifespan;
  const totalCosts = capex + (opex * expectedLifespan);
  
  return totalCosts / totalGeneration; // $/MWh
};

NodeMetadataSchema.methods.isInMaintenance = function() {
  return this.operational.operationalMode === 'maintenance';
};

NodeMetadataSchema.methods.getAvailableCapacity = function() {
  return this.isInMaintenance() ? 0 : this.capacity.available;
};

// Static methods
NodeMetadataSchema.statics.getActiveNodes = function() {
  return this.find({ 'operational.isActive': true });
};

NodeMetadataSchema.statics.getNodesByType = function(type) {
  return this.find({ 
    'technicalSpecs.type': type, 
    'operational.isActive': true 
  });
};

NodeMetadataSchema.statics.getNodesInRegion = function(region) {
  return this.find({ 
    'location.region': region, 
    'operational.isActive': true 
  });
};

module.exports = mongoose.model('NodeMetadata', NodeMetadataSchema);
