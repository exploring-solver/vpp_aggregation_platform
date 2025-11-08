# VPP Aggregation Platform - Integrated Setup Guide

This guide covers the complete setup of the VPP (Virtual Power Plant) aggregation platform with identifier-based authentication for edge nodes.

## System Overview

The integrated system consists of:
- **Backend Express**: Aggregator server with REST APIs and real-time processing
- **Edge Nodes**: Python FastAPI services that simulate IoT devices/data centers
- **Web Dashboard**: React-based monitoring interface
- **Authentication**: Identifier-key based M2M authentication (no Auth0 required for edge nodes)

## Quick Start

### 1. Backend Setup

```bash
cd backend_express
npm install
```

Copy the environment file:
```bash
cp .env.example .env
```

Key environment variables:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/vpp_aggregator
REDIS_URL=redis://localhost:6379
MQTT_BROKER_URL=mqtt://localhost:1883

# Edge Node Authentication Keys
DC01_KEY=dc01-secret-key-2024
DC02_KEY=dc02-secret-key-2024
DC03_KEY=dc03-secret-key-2024
DC04_KEY=dc04-secret-key-2024
DC05_KEY=dc05-secret-key-2024
```

Start the backend:
```bash
npm run dev
```

### 2. Edge Node Setup

```bash
cd services/edge_node
pip install -r requirements.txt
```

#### Running Multiple Edge Nodes

**Node 1 (DC01):**
```bash
# Copy the pre-configured environment
cp .env.dc01 .env
python main.py
```

**Node 2 (DC02) - in a separate terminal:**
```bash
# Copy the second node configuration  
cp .env.dc02 .env
python main.py
```

### 3. Web Dashboard Setup

```bash
cd web_dashboard
npm install
npm run dev
```

Access the dashboard at `http://localhost:5173`

## Authentication System

### M2M Authentication for Edge Nodes

Edge nodes now use **identifier-key based authentication** instead of Auth0:

- Each node has a unique `NODE_ID` (e.g., DC01, DC02)
- Each node has a secret `NODE_KEY` that must match the backend configuration
- Authentication is logged as "M2M" for audit purposes
- Nodes auto-register when they first send telemetry

### Authentication Headers

Edge nodes send these headers with requests:
```
X-Node-ID: DC01
X-Node-Key: dc01-secret-key-2024
```

## API Endpoints

### Telemetry (M2M - Node Authentication)
- `POST /api/telemetry` - Edge nodes send data here
- `GET /api/telemetry` - Retrieve telemetry data

### Nodes (JWT - User Authentication) 
- `GET /api/nodes` - List all registered nodes
- `GET /api/nodes/:node_id` - Get specific node details

### Aggregation (JWT - User Authentication)
- `GET /api/aggregate` - Get aggregated VPP statistics

## Data Flow

1. **Edge Node Startup**: Node loads `NODE_ID` and `NODE_KEY` from environment
2. **Authentication**: Node authenticates using identifier headers
3. **Auto-Registration**: Backend auto-registers new nodes on first telemetry
4. **Data Processing**: Telemetry is stored in MongoDB and cached in Redis
5. **Dashboard Updates**: Web dashboard polls APIs every 10-15 seconds for updates

## Testing the Integration

### 1. Start All Services

1. Ensure MongoDB and Redis are running
2. Start the backend aggregator: `npm run dev`
3. Start edge node DC01: `cp .env.dc01 .env && python main.py`
4. Start edge node DC02: `cp .env.dc02 .env && python main.py` (in new terminal)
5. Start web dashboard: `npm run dev`

### 2. Verify M2M Authentication

Check backend logs for:
```
M2M authentication successful for node DC01
Auto-registered new node: DC01 (Mumbai Data Center)
Telemetry processed successfully for node DC01
```

### 3. Verify Dashboard Integration

1. Open dashboard at `http://localhost:5173`
2. Navigate to "Edge Nodes" page
3. Verify nodes appear with real data
4. Check that aggregate statistics show combined data from all nodes

### 4. Test Node Auto-Registration

1. Create a new `.env.dc03` file:
```env
NODE_ID=DC03
NODE_NAME=Bangalore Data Center
NODE_KEY=dc03-secret-key-2024
NODE_LOCATION=Bangalore
PORT=8002
AGGREGATOR_URL=http://localhost:3000
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://localhost:1883
TELEMETRY_INTERVAL=5
```

2. Add the key to backend `.env`:
```env
DC03_KEY=dc03-secret-key-2024
```

3. Start the new node:
```bash
cp .env.dc03 .env && python main.py
```

4. Verify it appears in the dashboard automatically

## Troubleshooting

### Edge Node Authentication Issues

If you see authentication errors:
1. Check that `NODE_KEY` in edge node matches `DC0X_KEY` in backend
2. Verify `NODE_ID` is unique and matches expected format
3. Check backend logs for detailed error messages

### Dashboard Shows No Data

1. Verify backend APIs are accessible: `curl http://localhost:3000/health`
2. Check browser console for API errors
3. Ensure you have a valid JWT token in localStorage (for development, you may need to bypass auth)

### Auto-Registration Not Working

1. Check that edge node is sending telemetry successfully
2. Verify MongoDB connection in backend logs
3. Check that telemetry includes `dc_id` field

## Environment Files Summary

- `backend_express/.env` - Backend configuration with node keys
- `services/edge_node/.env.example` - Template for edge nodes
- `services/edge_node/.env.dc01` - Pre-configured for DC01 
- `services/edge_node/.env.dc02` - Pre-configured for DC02

## Log Monitoring

Monitor these logs during operation:
- Backend: M2M authentication success/failure, auto-registration events
- Edge Nodes: Telemetry transmission status, connection health
- Dashboard: API fetch success/failure, real-time update status

The system is now fully integrated with identifier-based M2M authentication, auto-registration, and real-time dashboard updates!