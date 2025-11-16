# VPP Aggregation Platform - Deployment Guide

## Overview

This guide covers deploying the VPP Aggregation Platform in different configurations, from simulation to production.

## Architecture Layers

The platform is organized into 4 distinct layers:

```
Layer 4: Market & Compliance        → Port 8300
Layer 3: Grid Integration            → Port 8200
Layer 2: Campus Aggregation          → Port 8100
Layer 1: Field Devices (BESS/Edge)   → Ports 8001-8099
```

## Deployment Modes

### Mode 1: Development (Simulation Only)

Run everything in simulation mode for development and testing.

```bash
# Start infrastructure + Layer 1 (simulation)
docker-compose up mongodb redis mqtt_broker aggregator_backend bess_controller_1 bess_controller_2

# Or use the existing docker-compose.yml (backwards compatible)
docker-compose up
```

**Access:**
- Web Dashboard: http://localhost:5173
- Backend API: http://localhost:3000
- BESS Controller 1: http://localhost:8001
- BESS Controller 2: http://localhost:8002

### Mode 2: Campus Testing (Layers 1-2)

Test campus-level aggregation with multiple BESS units.

```bash
docker-compose -f docker-compose.full.yml up \
  mongodb redis mqtt_broker \
  aggregator_backend \
  bess_controller_1 bess_controller_2 \
  campus_mumbai \
  web_dashboard
```

**Access:**
- Campus Controller: http://localhost:8100
- Campus Telemetry: http://localhost:8100/telemetry
- Node Management: http://localhost:8100/nodes

### Mode 3: Grid Integration Testing (Layers 1-3)

Add grid frequency response capabilities.

```bash
docker-compose -f docker-compose.full.yml up \
  mongodb redis mqtt_broker \
  aggregator_backend \
  bess_controller_1 bess_controller_2 \
  campus_mumbai \
  layer3_regional \
  web_dashboard
```

**Access:**
- Layer 3 Regional: http://localhost:8200
- Frequency Status: http://localhost:8200/frequency/status
- Droop Controller: http://localhost:8200/droop/status

### Mode 4: Full Stack (All Layers)

Complete system with market integration.

```bash
docker-compose -f docker-compose.full.yml up
```

**Access:**
- All previous endpoints
- Layer 4 Market: http://localhost:8300
- Market Status: http://localhost:8300/market/status

## Hardware Integration (Production)

### Prerequisites

1. **BESS Hardware**
   - Modbus TCP/RTU interface
   - IP address configured
   - BMS with CAN bus (optional)
   - Inverter with SunSpec support

2. **PMU (Phasor Measurement Unit)**
   - IEEE C37.118 compatible
   - Network accessible
   - GPS synchronized

3. **Network**
   - Dedicated VLAN for BESS communication
   - Firewall rules configured
   - VPN for remote access

### Configuration Steps

#### Step 1: Configure BESS Hardware

Edit `config/layer1_config.yaml`:

```yaml
mode: hardware  # Change from 'simulation'

bess_units:
  - id: BESS_DC01_01
    modbus:
      host: 192.168.1.100  # Your BESS IP
      port: 502
      unit_id: 1
      timeout: 5
```

#### Step 2: Configure Grid Integration

Edit `config/layer3_config.yaml`:

```yaml
grid_integration:
  mode: pmu  # or 'posoco' or 'scada'

pmu:
  enabled: true
  host: 192.168.10.100  # Your PMU IP
  port: 4712
  zone: western
```

#### Step 3: Enable Market Participation

Edit `config/layer4_config.yaml`:

```yaml
market_participation:
  enabled: true  # Enable when ready

exchanges:
  - name: IEX
    enabled: true
    api_key: "YOUR_IEX_API_KEY"
```

Set environment variables:

```bash
export IEX_API_KEY="your-iex-api-key"
export PXIL_API_KEY="your-pxil-api-key"
```

#### Step 4: Deploy

```bash
# Build services
docker-compose -f docker-compose.full.yml build

# Start in production mode
docker-compose -f docker-compose.full.yml up -d

# Check logs
docker-compose -f docker-compose.full.yml logs -f
```

## Testing Individual Layers

### Test Layer 1 (BESS Controller)

```bash
# Start just the BESS controller
docker run -it --rm \
  -p 8001:8000 \
  -e BESS_ID=BESS_TEST_01 \
  -e MODE=simulation \
  vpp_bess_controller

# Test API
curl http://localhost:8001/health
curl http://localhost:8001/telemetry
curl -X POST http://localhost:8001/power \
  -H "Content-Type: application/json" \
  -d '{"power_kw": 50.0}'
```

### Test Layer 2 (Campus Aggregation)

```bash
# Start campus controller
docker run -it --rm \
  -p 8100:8100 \
  -e CAMPUS_ID=CAMPUS_MUMBAI_ANDHERI \
  vpp_campus_controller

# Test API
curl http://localhost:8100/health
curl http://localhost:8100/telemetry
curl http://localhost:8100/capacity
```

### Test Layer 3 (Grid Integration)

```bash
# Start regional aggregator
docker run -it --rm \
  -p 8200:8200 \
  -e REGION_ID=REGION_WESTERN \
  vpp_layer3_regional

# Test API
curl http://localhost:8200/frequency/status
curl http://localhost:8200/droop/status
```

## Monitoring & Logging

### View Logs

```bash
# All services
docker-compose -f docker-compose.full.yml logs -f

# Specific service
docker-compose -f docker-compose.full.yml logs -f bess_controller_1

# Filter errors
docker-compose -f docker-compose.full.yml logs | grep ERROR
```

### Health Checks

```bash
# Check all services
./scripts/health_check.sh

# Or manually
curl http://localhost:8001/health  # BESS 1
curl http://localhost:8002/health  # BESS 2
curl http://localhost:8100/health  # Campus
curl http://localhost:8200/health  # Layer 3
curl http://localhost:8300/health  # Layer 4
curl http://localhost:3000/health  # Aggregator
```

### Monitoring Dashboards

- **Web Dashboard**: http://localhost:5173
- **Grafana** (if enabled): http://localhost:3001
- **MQTT Topics**:
  - `vpp/telemetry/+` - Telemetry data
  - `vpp/commands/+` - Control commands
  - `vpp/status/+` - Status updates

## Troubleshooting

### BESS Not Connecting

```bash
# Check network connectivity
docker exec vpp_bess_01 ping 192.168.1.100

# Test Modbus manually
docker exec vpp_bess_01 python -c "
from modbus_interface.modbus_client import ModbusBESSClient
import asyncio
client = ModbusBESSClient('192.168.1.100', 502)
print(asyncio.run(client.connect()))
"
```

### PMU Connection Issues

```bash
# Check PMU reachability
docker exec vpp_layer3_regional ping 192.168.10.100

# Test PMU protocol
tcpdump -i any port 4712
```

### Market Integration Issues

```bash
# Test IEX API
curl -H "Authorization: Bearer $IEX_API_KEY" https://api.iexindia.com/test

# Check Layer 4 logs
docker-compose logs layer4_market | grep "IEX"
```

## Performance Tuning

### Database Optimization

```yaml
# docker-compose.full.yml
mongodb:
  command: mongod --wiredTigerCacheSizeGB 2
```

### Redis Memory

```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### BESS Polling Rate

```yaml
# config/layer1_config.yaml
telemetry_interval: 5  # Reduce to 1 for faster updates
```

## Security

### Enable MQTT TLS

1. Generate certificates:
```bash
cd docker/mosquitto/certs
./generate_certs.sh
```

2. Update mosquitto config:
```
listener 8883
cafile /mosquitto/certs/ca.crt
certfile /mosquitto/certs/server.crt
keyfile /mosquitto/certs/server.key
require_certificate true
```

3. Update MQTT URL in configs:
```yaml
mqtt:
  broker_url: mqtts://mqtt_broker:8883
```

### API Authentication

Set Auth0 credentials:

```bash
export AUTH0_DOMAIN="your-domain.auth0.com"
export AUTH0_AUDIENCE="https://vpp-api"
export AUTH0_CLIENT_ID="your-client-id"
```

## Backup & Recovery

### Database Backup

```bash
# Backup MongoDB
docker exec vpp_mongodb mongodump --out=/backup
docker cp vpp_mongodb:/backup ./backup_$(date +%Y%m%d)

# Restore
docker cp ./backup vpp_mongodb:/backup
docker exec vpp_mongodb mongorestore /backup
```

### Configuration Backup

```bash
# Backup configs
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/
```

## Scaling

### Horizontal Scaling (Multiple Campuses)

```yaml
# Add more campus controllers
campus_bangalore:
  image: vpp_campus_controller
  environment:
    CAMPUS_ID: CAMPUS_BANGALORE_WHITEFIELD

campus_delhi:
  image: vpp_campus_controller
  environment:
    CAMPUS_ID: CAMPUS_DELHI_NOIDA
```

### Load Balancing

Use nginx for API load balancing:

```nginx
upstream vpp_backend {
    server aggregator_backend_1:3000;
    server aggregator_backend_2:3000;
}

server {
    listen 80;
    location /api {
        proxy_pass http://vpp_backend;
    }
}
```

## Production Checklist

- [ ] Hardware connections tested
- [ ] Network security configured (VLANs, firewalls)
- [ ] MQTT TLS enabled
- [ ] API authentication enabled
- [ ] Database backups scheduled
- [ ] Monitoring dashboards configured
- [ ] Logging aggregation setup (ELK stack)
- [ ] Alerting rules configured
- [ ] Disaster recovery plan documented
- [ ] Grid code compliance verified (IEGC)
- [ ] Market registration complete (CERC)
- [ ] Insurance coverage obtained
- [ ] Operator training completed

## Support

For issues or questions:
- GitHub Issues: https://github.com/exploring-solver/vpp_aggregation_platform/issues
- Documentation: https://docs.vusio.io
- Email: support@vusio.io
