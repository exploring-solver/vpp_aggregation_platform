# Module 2 - Quick Start Guide

## 🚀 Installation

### 1. Install Dependencies
```bash
cd backend_express
npm install axios node-cron
```

### 2. Configure Environment Variables
Add to `.env`:
```env
# Forecasting
FORECAST_UPDATE_INTERVAL=300
FORECAST_HORIZON_HOURS=24

# RL Optimization
RL_UPDATE_INTERVAL=60
AUTO_DISPATCH_ENABLED=false

# Market Bidding
MARKET_API_URL=https://api.cerc.gov.in
MARKET_API_KEY=your_key_here
BID_SUBMISSION_ENABLED=false
MIN_BID_CAPACITY_MW=1.0

# Dispatch
MAX_DISPATCH_POWER_MW=100
SOC_THRESHOLD_MIN=20
SOC_THRESHOLD_MAX=90
```

### 3. Start Server
```bash
npm run dev
```

---

## 📡 API Usage Examples

### Get Virtual Plant State
```bash
GET /api/aggregate/vpp-state
Authorization: Bearer <token>
```

### Get Load Forecast
```bash
GET /api/forecast/load?horizon_hours=24
Authorization: Bearer <token>
```

### Get Grid Stress Forecast
```bash
GET /api/forecast/grid-stress?horizon_hours=6
Authorization: Bearer <token>
```

### Get RL Optimization Recommendation
```bash
GET /api/optimization/recommendation
Authorization: Bearer <token>
```

### Get Dispatch Plan (without executing)
```bash
GET /api/optimization/dispatch/plan
Authorization: Bearer <token>
```

### Execute Dispatch
```bash
POST /api/optimization/dispatch
Authorization: Bearer <token>
Content-Type: application/json

{
  "auto_execute": true
}
```

### Submit Market Bid
```bash
POST /api/market/bids
Authorization: Bearer <token>
Content-Type: application/json

{
  "service_type": "SRAS",
  "capacity_mw": 50,
  "price_per_mw": 2500,
  "duration_minutes": 15
}
```

---

## 🔄 Automatic Operations

### Scheduled Jobs:
- **Forecast Updates**: Every 5 minutes (configurable)
- **RL Optimization**: Every 1 minute (configurable)
- **Auto-Dispatch**: Enabled if `AUTO_DISPATCH_ENABLED=true`

---

## 📊 Data Flow

```
Telemetry (MQTT) 
  → Data Aggregator 
    → Virtual Plant State
      → Forecast Engine
        → RL Optimizer
          → Dispatch Optimizer
            → MQTT Commands
              → Edge Nodes
```

---

## ✅ Testing Checklist

- [ ] Server starts without errors
- [ ] Forecast endpoints return data
- [ ] Optimization endpoints return recommendations
- [ ] Dispatch plan can be generated
- [ ] Market bids can be created
- [ ] Scheduled jobs are running
- [ ] Redis pub/sub is working
- [ ] MQTT commands can be sent

---

## 🐛 Troubleshooting

### Forecast not updating?
- Check `FORECAST_UPDATE_INTERVAL` in `.env`
- Check Redis connection
- Check MongoDB connection

### Optimization not working?
- Ensure nodes have telemetry data
- Check `RL_UPDATE_INTERVAL` in `.env`
- Verify VPP state is being computed

### Dispatch not executing?
- Check `AUTO_DISPATCH_ENABLED` in `.env`
- Verify MQTT connection
- Check node availability

---

## 📚 Documentation

- See `IMPLEMENTATION_REQUIREMENTS.md` for detailed requirements
- See `IMPLEMENTATION_SUMMARY.md` for implementation details

