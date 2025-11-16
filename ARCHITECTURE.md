# VPP Aggregation Platform - Layered Architecture

## Overview
This platform implements a complete Battery Energy Storage System (BESS) Virtual Power Plant (VPP) with proper IEEE 2030.5 smart grid layering.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: Market & Compliance                                   │
│  ├── market_gateway/          (IEX/PXIL integration)           │
│  └── compliance_engine/       (CERC/IEGC rules)                │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Grid Integration & Regional Aggregation              │
│  ├── scada_interface/        (POSOCO/SLDC connection)          │
│  ├── frequency_response/     (PMU data, droop control)         │
│  └── regional_aggregator/    (Geographic aggregation)          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Campus/Location Aggregation                          │
│  ├── campus_controller/      (Site-level coordination)         │
│  └── local_optimizer/        (Campus-level optimization)       │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Field Devices                                        │
│  ├── bess_controller/        (Real BESS hardware interface)    │
│  │   ├── modbus_interface/   (Modbus TCP/RTU)                  │
│  │   ├── bms_integration/    (Battery Management System)       │
│  │   ├── inverter_control/   (SunSpec protocol)                │
│  │   └── safety_manager/     (Safety interlocks)               │
│  └── edge_simulator/         (Simulation mode - existing)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CORE SERVICES (Supporting Infrastructure)                     │
│  ├── aggregator_backend/     (Express.js API)                  │
│  ├── ml_pipeline/            (Forecasting & RL agents)         │
│  └── data_layer/             (Time-series storage)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  USER INTERFACES                                                │
│  ├── web_dashboard/          (VPP operator UI)                 │
│  └── vendor_portal/          (Vendor contract UI)              │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
vpp_aggregation_platform/
│
├── layer1_field_devices/                # LAYER 1: Hardware & Edge
│   ├── bess_controller/                 # Real BESS hardware interface
│   │   ├── modbus_interface/            # Modbus TCP/RTU client
│   │   ├── bms_integration/             # BMS CAN bus parser
│   │   ├── inverter_control/            # SunSpec inverter control
│   │   ├── safety_manager/              # Safety interlocks
│   │   └── main.py                      # BESS controller service
│   └── edge_simulator/                  # Simulation mode (existing)
│       └── main.py
│
├── layer2_campus_aggregation/           # LAYER 2: Site-level
│   ├── campus_controller/               # Campus aggregator service
│   │   ├── location_manager/            # Location hierarchy
│   │   ├── local_optimizer/             # Campus-level optimization
│   │   ├── redundancy_manager/          # BESS redundancy handling
│   │   └── main.py
│   └── models/
│       └── location_schema.py           # Campus/building/node schema
│
├── layer3_grid_integration/             # LAYER 3: Grid & Regional
│   ├── scada_interface/                 # Grid operator interface
│   │   ├── posoco_client/               # POSOCO WAMS integration
│   │   ├── iec60870_protocol/           # IEC 60870-5-104 (SCADA)
│   │   └── agc_handler/                 # AGC signal processing
│   ├── frequency_response/              # Grid frequency services
│   │   ├── pmu_interface/               # PMU data collector
│   │   ├── droop_controller/            # Frequency droop control
│   │   └── iegc_compliance/             # IEGC frequency rules
│   └── regional_aggregator/             # Geographic aggregation
│       └── main.py
│
├── layer4_market_compliance/            # LAYER 4: Market & Compliance
│   ├── market_gateway/                  # Exchange integration
│   │   ├── iex_client/                  # IEX API client
│   │   ├── pxil_client/                 # PXIL API client
│   │   ├── bidding_engine/              # Market bidding logic
│   │   └── settlement_system/           # DSM & invoicing
│   └── compliance_engine/               # Regulatory compliance
│       ├── cerc_reporter/               # CERC reporting
│       ├── iegc_validator/              # Grid code validation
│       └── audit_logger/                # Audit trails
│
├── core_services/                       # Supporting services
│   ├── aggregator_backend/              # (backend_express/)
│   ├── ml_pipeline/                     # (ml_pipeline/)
│   └── data_layer/                      # (data_layer_service/)
│
├── interfaces/                          # User interfaces
│   ├── web_dashboard/                   # (web_dashboard/)
│   └── vendor_portal/                   # (vendor_portal/)
│
├── config/                              # Configuration
│   ├── layer1_config.yaml               # BESS hardware config
│   ├── layer2_config.yaml               # Campus config
│   ├── layer3_config.yaml               # Grid integration config
│   ├── layer4_config.yaml               # Market config
│   └── locations.yaml                   # Location hierarchy
│
├── docker-compose.yml                   # Full stack orchestration
├── docker-compose.layer1.yml            # Layer 1 only (testing)
├── docker-compose.layer2.yml            # Layers 1-2 (site testing)
├── docker-compose.layer3.yml            # Layers 1-3 (grid testing)
├── docker-compose.full.yml              # All layers (production)
│
└── docs/
    ├── DEPLOYMENT.md                    # Deployment guide
    ├── LAYER1_BESS.md                   # BESS integration guide
    ├── LAYER2_CAMPUS.md                 # Campus setup guide
    ├── LAYER3_GRID.md                   # Grid integration guide
    ├── LAYER4_MARKET.md                 # Market participation guide
    └── SAFETY_COMPLIANCE.md             # Safety & compliance
```

## Data Flow

### Telemetry Flow (Bottom-Up)
```
BESS Hardware → Layer 1 Controller → Layer 2 Campus → Layer 3 Regional → Layer 4 Market
                     ↓                    ↓                ↓
                Data Layer ← Aggregator Backend ← ML Pipeline
```

### Control Flow (Top-Down)
```
Market Gateway → Regional Aggregator → Campus Controller → BESS Controller → Hardware
       ↓               ↓                     ↓                  ↓
  Compliance ← Grid Frequency ← Local Optimizer ← Safety Manager
```

## Operating Modes

### Mode 1: Pure Simulation (Current)
- Uses `edge_simulator` only
- No real hardware
- Perfect for development & testing

### Mode 2: Hardware-in-Loop (HIL)
- Uses `bess_controller` with real BESS
- Simulated grid frequency
- For BESS commissioning

### Mode 3: Grid-Connected Simulation
- Uses `edge_simulator`
- Real grid frequency from PMU
- For algorithm validation

### Mode 4: Production
- Real BESS via `bess_controller`
- Real grid integration
- Real market participation

## Key Features by Layer

### Layer 1: Field Devices
- **Real Hardware Support**: Modbus, CAN bus, SunSpec
- **Safety Interlocks**: Temperature, voltage, current monitoring
- **BMS Integration**: Cell-level monitoring, SOC/SOH tracking
- **Simulation Mode**: Existing simulator for development

### Layer 2: Campus Aggregation
- **Location Hierarchy**: Country → State → City → Campus → Building → Node
- **Local Optimization**: Minimize transmission losses
- **Redundancy Management**: Automatic failover between BESS units
- **Load Coordination**: Balance across colocated nodes

### Layer 3: Grid Integration
- **Real-time Frequency**: PMU data or POSOCO WAMS
- **SCADA Protocol**: IEC 60870-5-104
- **Droop Control**: 5% droop for primary frequency response
- **IEGC Compliance**: Frequency deadbands, response times

### Layer 4: Market & Compliance
- **Exchange Integration**: IEX, PXIL APIs
- **Market Bidding**: Day-ahead, real-time, balancing
- **Settlement**: DSM calculation, invoicing
- **Compliance**: CERC reporting, audit trails

## Configuration

Each layer has independent configuration:

### Layer 1 Config (`config/layer1_config.yaml`)
```yaml
mode: simulation  # or 'hardware'
bess_units:
  - id: BESS_DC01_01
    campus_id: CAMPUS_MUMBAI_ANDHERI
    modbus:
      host: 192.168.1.100
      port: 502
    capacity_kwh: 250
    max_power_kw: 100
```

### Layer 2 Config (`config/layer2_config.yaml`)
```yaml
campuses:
  - id: CAMPUS_MUMBAI_ANDHERI
    location:
      city: Mumbai
      state: Maharashtra
      latitude: 19.1136
      longitude: 72.8697
    bess_units: 4
```

### Layer 3 Config (`config/layer3_config.yaml`)
```yaml
grid_integration:
  mode: simulation  # or 'posoco', 'pmu'
  frequency_source: simulated
  scada_enabled: false
  droop_settings:
    deadband_hz: [49.9, 50.05]
    droop_percent: 5.0
```

### Layer 4 Config (`config/layer4_config.yaml`)
```yaml
market_participation:
  enabled: false
  exchanges:
    - name: IEX
      api_url: https://api.iexindia.com
      credentials: ${IEX_API_KEY}
    - name: PXIL
      api_url: https://api.pxil.co.in
      credentials: ${PXIL_API_KEY}
```

## Migration Path

### Phase 1: Restructure (Week 1)
1. Create layer directories
2. Move existing code to appropriate layers
3. Update imports and paths
4. Test in simulation mode

### Phase 2: Layer 1 Enhancement (Week 2)
1. Implement BESS hardware abstraction
2. Add Modbus/BMS interfaces
3. Implement safety manager
4. Hardware-in-loop testing

### Phase 3: Layer 2 Implementation (Week 3)
1. Build campus controller
2. Implement location hierarchy
3. Add local optimization
4. Multi-node coordination

### Phase 4: Layer 3 Integration (Week 4)
1. PMU/frequency measurement
2. SCADA protocol implementation
3. Droop control logic
4. IEGC compliance validation

### Phase 5: Layer 4 Completion (Week 5)
1. Exchange API clients
2. Bidding engine
3. Settlement system
4. Compliance reporting

## Safety Considerations

### Hardware Safety (Layer 1)
- Emergency shutdown on thermal runaway
- Cell balancing monitoring
- Voltage/current limits
- Manual override capabilities

### Grid Safety (Layer 3)
- Rate-of-change limits
- Frequency response deadbands
- Anti-islanding protection
- Grid code compliance checks

### Operational Safety (All Layers)
- Audit logging of all commands
- Role-based access control
- Failsafe defaults
- Manual override switches

## Compliance Requirements

### CERC (Central Electricity Regulatory Commission)
- Register as RESCO
- Quarterly reporting
- Financial audits

### IEGC (Indian Electricity Grid Code)
- Clause 5.2: Frequency response (0-5 seconds)
- Deadband: 49.9-50.05 Hz
- Droop: 5% for primary response

### Cybersecurity
- IEC 62351 compliance
- MQTT TLS encryption
- API authentication
- Audit trails

## Development Workflow

### For Simulation Development
```bash
docker-compose -f docker-compose.layer1.yml up
# Only runs edge_simulator + aggregator
```

### For BESS Integration
```bash
docker-compose -f docker-compose.layer2.yml up
# Runs Layer 1 (hardware) + Layer 2 (campus)
```

### For Grid Testing
```bash
docker-compose -f docker-compose.layer3.yml up
# Adds Layer 3 (grid integration)
```

### For Full Production
```bash
docker-compose -f docker-compose.full.yml up
# All 4 layers + core services
```

## Monitoring & Observability

### Layer 1 Metrics
- BESS SOC, SOH, temperature
- Charge/discharge power
- Safety alarm status
- Hardware communication latency

### Layer 2 Metrics
- Campus aggregate power
- Node availability
- Redundancy status
- Local optimization efficiency

### Layer 3 Metrics
- Grid frequency (real-time)
- Frequency response activation
- SCADA communication status
- Grid code compliance score

### Layer 4 Metrics
- Market bids submitted/cleared
- Revenue per trading session
- DSM charges
- Compliance violations
