# VPP Aggregation Platform - Layered Architecture

## 🎯 Overview

This repository contains a complete **Virtual Power Plant (VPP)** platform designed for Battery Energy Storage Systems (BESS) aggregation and grid integration in India. The platform follows **IEEE 2030.5 smart grid architecture** with proper layer separation.

## 🏗️ Architecture

The platform is organized into **4 distinct layers**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Market & Compliance (Port 8300)                   │
│  ✓ IEX/PXIL integration  ✓ CERC compliance  ✓ DSM tracking │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Grid Integration (Port 8200)                      │
│  ✓ Frequency response  ✓ PMU/SCADA  ✓ IEGC compliance      │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Campus Aggregation (Port 8100)                    │
│  ✓ Multi-BESS coordination  ✓ Local optimization           │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Field Devices (Ports 8001-8099)                   │
│  ✓ BESS hardware control  ✓ Modbus/BMS  ✓ Safety systems   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
vpp_aggregation_platform/
│
├── layer1_field_devices/              # Hardware & Edge Layer
│   ├── bess_controller/               # Real BESS hardware interface
│   │   ├── modbus_interface/          # Modbus TCP/RTU client
│   │   ├── bms_integration/           # Battery Management System
│   │   ├── inverter_control/          # SunSpec inverter control
│   │   ├── safety_manager/            # Safety interlocks
│   │   └── main.py                    # BESS controller service
│   └── edge_simulator/                # Simulation mode (existing)
│
├── layer2_campus_aggregation/         # Site-level Aggregation
│   ├── campus_controller/             # Campus aggregator
│   │   ├── location_manager/          # Location hierarchy
│   │   ├── local_optimizer/           # Campus optimization
│   │   └── main.py
│   └── models/
│       └── location_schema.py         # Location data models
│
├── layer3_grid_integration/           # Grid & Regional Layer
│   ├── frequency_response/
│   │   ├── pmu_interface/             # PMU data collector
│   │   └── droop_controller/          # Frequency droop control
│   ├── scada_interface/               # SCADA/POSOCO integration
│   └── regional_aggregator/           # Geographic aggregation
│
├── layer4_market_compliance/          # Market & Compliance Layer
│   ├── market_gateway/
│   │   ├── iex_client/                # IEX API integration
│   │   ├── pxil_client/               # PXIL integration
│   │   ├── bidding_engine/            # Market bidding
│   │   └── settlement_system/         # DSM & invoicing
│   └── compliance_engine/
│       ├── cerc_reporter/             # CERC reporting
│       └── iegc_validator/            # Grid code compliance
│
├── backend_express/                   # Core aggregator backend
├── ml_pipeline/                       # ML forecasting & agents
├── data_layer_service/                # Time-series storage
├── web_dashboard/                     # Operator UI
├── vendor_portal/                     # Vendor UI
│
├── config/                            # Configuration files
│   ├── layer1_config.yaml             # BESS hardware config
│   ├── layer2_config.yaml             # Campus config
│   ├── layer3_config.yaml             # Grid integration
│   └── layer4_config.yaml             # Market config
│
├── docker-compose.yml                 # Original (backwards compatible)
├── docker-compose.full.yml            # All layers (new)
│
└── docs/
    ├── ARCHITECTURE.md                # Architecture overview
    ├── DEPLOYMENT.md                  # Deployment guide
    └── LAYER*.md                      # Layer-specific docs
```

## 🚀 Quick Start

### Simulation Mode (Development)

```bash
# Clone repository
git clone https://github.com/exploring-solver/vpp_aggregation_platform.git
cd vpp_aggregation_platform

# Start Layer 1 (BESS simulation)
docker-compose -f docker-compose.full.yml up \
  mongodb redis mqtt_broker \
  aggregator_backend \
  bess_controller_1 bess_controller_2 \
  web_dashboard

# Access dashboard
open http://localhost:5173
```

### Full Stack (All Layers)

```bash
# Start entire platform
docker-compose -f docker-compose.full.yml up

# Access services
# - Web Dashboard: http://localhost:5173
# - BESS Controller 1: http://localhost:8001
# - Campus Controller: http://localhost:8100
# - Layer 3 (Grid): http://localhost:8200
# - Layer 4 (Market): http://localhost:8300
```

### Hardware Integration (Production)

```bash
# 1. Configure BESS hardware
vim config/layer1_config.yaml
# Set mode: hardware and Modbus IPs

# 2. Configure grid integration
vim config/layer3_config.yaml
# Set PMU/SCADA settings

# 3. Deploy
docker-compose -f docker-compose.full.yml up -d
```

## 🔑 Key Features by Layer

### Layer 1: Field Devices ✅

**Hardware Integration:**
- ✅ Modbus TCP/RTU client for BESS controllers
- ✅ BMS CAN bus integration for cell-level monitoring
- ✅ SunSpec protocol for inverter control
- ✅ Safety interlocks (temperature, voltage, current)
- ✅ Emergency shutdown procedures
- ✅ Simulation mode for development

**APIs:**
- `GET /health` - Health check
- `GET /telemetry` - Real-time telemetry
- `POST /power` - Set power setpoint
- `POST /control` - Control commands (enable/disable/emergency stop)
- `GET /safety/violations` - Safety violations history

### Layer 2: Campus Aggregation ✅

**Campus-Level Features:**
- ✅ Multi-BESS unit coordination
- ✅ Location hierarchy (Campus → Building → Node)
- ✅ Local optimization (minimize losses, balance SOC)
- ✅ Redundancy management (automatic failover)
- ✅ Three dispatch strategies:
  - **Proportional**: By capacity
  - **Balanced**: Equalize SOC
  - **Priority**: SOC-based priority

**APIs:**
- `GET /telemetry` - Aggregated campus telemetry
- `GET /nodes` - All campus nodes
- `POST /dispatch` - Dispatch power across nodes
- `GET /capacity` - Aggregate capacity

### Layer 3: Grid Integration ✅

**Grid Frequency Response:**
- ✅ PMU interface (IEEE C37.118 compatible)
- ✅ Real-time frequency monitoring
- ✅ **Frequency droop control** (5% droop per IEGC)
- ✅ Deadband: 49.90-50.05 Hz (IEGC compliant)
- ✅ ROCOF (Rate of Change of Frequency) damping
- ✅ Adaptive response (SOC and temperature dependent)
- ✅ Primary frequency response (0-5 seconds)

**IEGC Compliance:**
- ✅ Frequency band detection
- ✅ Response time enforcement (< 5 seconds)
- ✅ Droop accuracy validation (±5%)

**APIs:**
- `GET /frequency/status` - Current frequency and alarms
- `GET /droop/status` - Droop controller status
- `POST /droop/enable` - Enable frequency response

### Layer 4: Market & Compliance ✅

**Market Integration:**
- ✅ IEX (Indian Energy Exchange) API client
- ✅ PXIL (Power Exchange India Limited) support
- ✅ Day-Ahead Market (DAM) bidding
- ✅ Real-Time Market (RTM) bidding
- ✅ Automated bidding strategy
- ✅ Settlement system (DSM tracking)

**Compliance:**
- ✅ CERC (Central Electricity Regulatory Commission) reporting
- ✅ IEGC (Indian Electricity Grid Code) validation
- ✅ Audit logging (all bids, dispatches, settlements)
- ✅ Financial reporting

**APIs:**
- `GET /market/prices` - Market clearing prices
- `POST /market/bid` - Submit market bid
- `GET /market/portfolio` - Trading portfolio
- `GET /compliance/report` - Compliance report

## 📊 What's New vs. Previous Version

| Feature | Before | After |
|---------|--------|-------|
| **BESS Integration** | Simulated only | ✅ Real hardware (Modbus/BMS/Inverter) |
| **Safety Systems** | Software checks | ✅ Hardware interlocks, emergency stop |
| **Campus Aggregation** | Single-node focus | ✅ Multi-BESS coordination |
| **Grid Frequency** | Simulated | ✅ Real PMU/SCADA integration |
| **Frequency Response** | None | ✅ IEGC-compliant droop control |
| **Market Integration** | Stub APIs | ✅ Real IEX/PXIL clients |
| **Location Hierarchy** | Flat | ✅ Campus → Building → Node |
| **Compliance** | None | ✅ CERC/IEGC reporting |

## 🎛️ Configuration

Each layer has independent configuration via YAML files:

### Layer 1: BESS Hardware

```yaml
# config/layer1_config.yaml
mode: simulation  # or 'hardware'

bess_units:
  - id: BESS_DC01_01
    modbus:
      host: 192.168.1.100
      port: 502
    capacity:
      rated_power_kw: 100
      energy_capacity_kwh: 250
```

### Layer 3: Grid Integration

```yaml
# config/layer3_config.yaml
grid_integration:
  mode: pmu  # or 'posoco', 'scada', 'simulation'

frequency_response:
  enabled: true
  droop:
    droop_percent: 5.0       # IEGC standard
    deadband_low_hz: 49.90
    deadband_high_hz: 50.05
```

### Layer 4: Market

```yaml
# config/layer4_config.yaml
market_participation:
  enabled: false  # Enable when ready

exchanges:
  - name: IEX
    api_key: ${IEX_API_KEY}

bidding_strategy:
  soc_thresholds:
    min_soc_for_sell: 30
    max_soc_for_buy: 80
```

## 🧪 Testing

### Test Individual Layers

```bash
# Layer 1 (BESS)
curl http://localhost:8001/health
curl http://localhost:8001/telemetry
curl -X POST http://localhost:8001/power \
  -H "Content-Type: application/json" \
  -d '{"power_kw": 50.0}'

# Layer 2 (Campus)
curl http://localhost:8100/telemetry
curl http://localhost:8100/capacity

# Layer 3 (Grid)
curl http://localhost:8200/frequency/status
curl http://localhost:8200/droop/status

# Layer 4 (Market)
curl http://localhost:8300/market/prices?segment=dam
curl http://localhost:8300/market/portfolio
```

### Frequency Response Test

```bash
# Enable droop controller
curl -X POST http://localhost:8200/droop/enable

# Simulate frequency event (in simulation mode)
# Frequency drops to 49.7 Hz → BESS should discharge
# Frequency rises to 50.3 Hz → BESS should charge

# Check response
curl http://localhost:8200/frequency/status
```

## 📈 Monitoring

### Key Metrics

**Layer 1 (BESS):**
- SOC, SOH, temperature, voltage, current
- Power output, charge/discharge rate
- Safety violations, alarms

**Layer 2 (Campus):**
- Aggregate power, available capacity
- Node online/offline count
- SOC distribution across nodes

**Layer 3 (Grid):**
- Grid frequency (real-time)
- Frequency deviation, ROCOF
- Droop response power
- IEGC compliance status

**Layer 4 (Market):**
- Bids submitted/cleared
- Market revenue/cost
- DSM charges

### Dashboards

- **Web Dashboard**: http://localhost:5173
- **Grafana** (optional): Add time-series visualization
- **MQTT Monitor**: Subscribe to `vpp/#` topics

## 🔐 Security

### Production Security Checklist

- [ ] Enable MQTT TLS (port 8883)
- [ ] Configure Auth0 for API authentication
- [ ] Use VPN for BESS hardware access
- [ ] Enable audit logging
- [ ] Set up firewall rules (restrict ports)
- [ ] Regular security audits

## 📚 Documentation

- [**ARCHITECTURE.md**](ARCHITECTURE.md) - Detailed architecture
- [**DEPLOYMENT.md**](docs/DEPLOYMENT.md) - Deployment guide
- [**Layer 1 Guide**](docs/LAYER1_BESS.md) - BESS hardware integration
- [**Layer 2 Guide**](docs/LAYER2_CAMPUS.md) - Campus setup
- [**Layer 3 Guide**](docs/LAYER3_GRID.md) - Grid integration
- [**Layer 4 Guide**](docs/LAYER4_MARKET.md) - Market participation

## 🛠️ Development

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ (for frontend)

### Local Development

```bash
# Start infrastructure only
docker-compose up mongodb redis mqtt_broker

# Run BESS controller locally
cd layer1_field_devices/bess_controller
pip install -r requirements.txt
python main.py

# Run campus controller locally
cd layer2_campus_aggregation/campus_controller
pip install -r requirements.txt
python main.py
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙋 Support

- **GitHub Issues**: https://github.com/exploring-solver/vpp_aggregation_platform/issues
- **Documentation**: https://docs.vusio.io
- **Email**: support@vusio.io

## 🎓 References

- **IEGC**: Indian Electricity Grid Code (CERC)
- **IEX**: Indian Energy Exchange
- **IEEE 2030.5**: Smart Energy Profile
- **IEEE C37.118**: Synchrophasor standard
- **SunSpec**: Inverter communication standard

---

**Built with ❤️ for India's renewable energy future**
