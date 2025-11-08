# VPP Aggregation Platform - Architecture & Data Flow

## Overview
This document explains how the protocols (MQTT, WebSocket, HTTP), databases (MongoDB, Redis), and pub/sub systems work together in the VPP aggregation platform.

## System Components

### 1. Edge Nodes (`services/edge_node/`)
- **Language**: Python (FastAPI)
- **Libraries**: 
  - `paho-mqtt` for MQTT communication
  - `psutil` for system metrics (CPU, RAM, disk, battery)
  - `httpx` for HTTP fallback
- **No queue library** - uses async/await for concurrency

### 2. Backend Aggregator (`backend_express/`)
- **Language**: Node.js (Express)
- **Libraries**:
  - `mqtt` (node-mqtt) for MQTT broker connection
  - `redis` (node-redis v4+) for caching and pub/sub
  - `ws` (WebSocket) for real-time frontend updates
  - MongoDB driver for persistent storage

### 3. Frontend Dashboard (`web_dashboard/`)
- **Framework**: React + Vite
- **Libraries**:
  - Native WebSocket API for real-time updates
  - `recharts` for data visualization
  - REST API polling as fallback

## Data Flow Architecture

```
┌─────────────────┐
│   Edge Node     │
│  (Python/FastAPI)│
│                 │
│  - Simulator    │
│  - MQTT Client  │
│  - HTTP Client  │
└────────┬────────┘
         │
         │ PRIMARY: MQTT
         │ Topic: edge/{dc_id}/telemetry
         │
         ▼
┌─────────────────┐
│  MQTT Broker    │
│  (Mosquitto)     │
└────────┬────────┘
         │
         │ Subscribe: edge/+/telemetry
         │
         ▼
┌─────────────────────────────────┐
│   Backend Aggregator            │
│   (Node.js/Express)             │
│                                 │
│  ┌──────────────────────────┐  │
│  │  MQTT Handler            │  │
│  │  - Receives telemetry    │  │
│  │  - Calls handleTelemetry │  │
│  └───────────┬──────────────┘  │
│              │                  │
│              ▼                  │
│  ┌──────────────────────────┐  │
│  │  Telemetry Handler       │  │
│  │  - Auto-registers nodes  │  │
│  │  - Stores in MongoDB     │  │
│  │  - Caches in Redis       │  │
│  │  - Publishes to Redis    │  │
│  └───────────┬──────────────┘  │
│              │                  │
│              ▼                  │
│  ┌──────────────────────────┐  │
│  │  Redis Pub/Sub           │  │
│  │  Channel: telemetry:new   │  │
│  └───────────┬──────────────┘  │
│              │                  │
│              ▼                  │
│  ┌──────────────────────────┐  │
│  │  WebSocket Server         │  │
│  │  - Subscribes to Redis    │  │
│  │  - Broadcasts to clients  │  │
│  └───────────┬──────────────┘  │
└──────────────┼──────────────────┘
               │
               │ WebSocket (ws://)
               │
               ▼
┌─────────────────┐
│  Frontend       │
│  (React)        │
│                 │
│  - WebSocket    │
│  - Charts       │
│  - REST API     │
└─────────────────┘
```

## Protocol Details

### MQTT (Message Queuing Telemetry Transport)

**Purpose**: Primary transport for edge node → aggregator communication

**Topics**:
- `edge/{dc_id}/telemetry` - Telemetry data from nodes
- `edge/{dc_id}/status` - Node online/offline status
- `edge/{dc_id}/control` - Control commands to nodes

**Flow**:
1. Edge node generates telemetry every 5 seconds
2. Publishes to `edge/{dc_id}/telemetry` via MQTT
3. Backend subscribes to `edge/+/telemetry` (wildcard)
4. Backend processes and stores data

**Fallback**: If MQTT fails, edge node falls back to HTTP POST to `/api/telemetry`

### Redis Pub/Sub

**Purpose**: Internal message bus for backend services

**Channels**:
- `telemetry:new` - New telemetry received
- `vpp:state:update` - Virtual plant state updates
- `dispatch:commands` - Dispatch commands issued
- `dispatch:optimized` - Agent-optimized dispatches

**Flow**:
1. Telemetry handler publishes to `telemetry:new`
2. WebSocket server subscribes to channel
3. WebSocket server broadcasts to connected clients
4. Frontend receives real-time updates

**Storage**: Redis also caches latest node state:
- Key: `node:{dc_id}:last_state`
- TTL: 300 seconds (5 minutes)

### MongoDB

**Purpose**: Persistent storage for historical data

**Collections**:
- `telemetry` - All telemetry records
- `nodes` - Node metadata and configuration
- `dispatch_log` - Dispatch command history
- `users` - User accounts

**Flow**:
1. Telemetry handler stores each record
2. Data aggregator queries for historical analysis
3. Frontend can query via REST API

### WebSocket

**Purpose**: Real-time bidirectional communication with frontend

**Connection**: `ws://localhost:3001` (or configured WS_PORT)

**Message Types**:
```javascript
{
  type: 'telemetry' | 'aggregate' | 'dispatch' | 'connected',
  data: { ... }
}
```

**Flow**:
1. Frontend connects to WebSocket server
2. Backend subscribes to Redis channels
3. When Redis publishes, WebSocket broadcasts to all clients
4. Frontend updates UI in real-time

**Fallback**: Frontend uses REST API polling every 10-15 seconds if WebSocket fails

## Data Storage Flow

### Telemetry Data Journey

1. **Generation** (Edge Node)
   - Simulator generates telemetry with system stats
   - Includes: power_kw, soc, freq, cpu, ram, disk, battery

2. **Transport** (MQTT)
   - Published to `edge/{dc_id}/telemetry`
   - QoS 0 (at most once) for telemetry
   - QoS 1 (at least once) for control commands

3. **Processing** (Backend)
   - MQTT handler receives message
   - Calls `handleTelemetryData()`
   - Auto-registers node if new
   - Extracts capacity_kw and battery_kwh from meta

4. **Storage** (MongoDB)
   - Inserts into `telemetry` collection
   - Indexed by dc_id and timestamp

5. **Caching** (Redis)
   - Stores latest state: `node:{dc_id}:last_state`
   - Used for fast aggregation queries

6. **Pub/Sub** (Redis)
   - Publishes to `telemetry:new` channel
   - WebSocket server receives notification

7. **Real-time Update** (WebSocket)
   - Broadcasts to all connected frontend clients
   - Frontend updates charts and UI

## Control Flow (Aggregator → Edge Node)

1. **Command Generation** (Backend)
   - Agent system or manual dispatch
   - Creates command: `{ action, params }`

2. **Transport** (MQTT)
   - Publishes to `edge/{dc_id}/control`
   - QoS 1 for reliability

3. **Execution** (Edge Node)
   - MQTT client receives command
   - Calls `handle_control_command()`
   - Simulator applies action (charge/discharge/etc.)

## Multi-Agent System

**Agents**:
- LoadForecastAgent - Predicts load
- DemandResponseAgent - Coordinates DR events
- OptimizationAgent - Optimizes dispatch
- MonitoringAgent - Monitors system health

**Communication**:
- Agents use shared Redis channels
- Consensus-based decision making
- Autonomous execution when approved

## Frontend Data Strategy

**Real-time Data** (WebSocket):
- Telemetry updates
- Aggregate state changes
- Dispatch notifications

**Historical Data** (REST API):
- Node list and metadata
- Historical telemetry
- Past dispatch logs

**Hybrid Approach**:
- WebSocket for live updates (low latency)
- REST API for initial load and fallback
- Polling as backup if WebSocket disconnects

## Libraries & Frameworks Summary

### Edge Node
- **MQTT**: `paho-mqtt` (Python)
- **HTTP**: `httpx` (async HTTP client)
- **System Stats**: `psutil`
- **No queue library** - Python async/await handles concurrency

### Backend
- **MQTT**: `mqtt` (node-mqtt)
- **Redis**: `redis` (node-redis v4+)
- **WebSocket**: `ws` (native WebSocket server)
- **Database**: MongoDB native driver
- **No queue library** - Redis pub/sub handles messaging

### Frontend
- **WebSocket**: Native WebSocket API
- **Charts**: `recharts`
- **HTTP**: `fetch` API
- **No Socket.IO** - Using native WebSocket for simplicity

## Performance Characteristics

- **MQTT**: ~1-5ms latency, handles thousands of messages/sec
- **Redis Pub/Sub**: <1ms latency, very high throughput
- **WebSocket**: <10ms latency, bidirectional
- **MongoDB**: Optimized with indexes, handles time-series data
- **Redis Cache**: Sub-millisecond reads for latest state

## Error Handling

- **MQTT Failure**: Falls back to HTTP
- **Redis Failure**: Logs error, continues processing
- **MongoDB Failure**: Logs warning, continues with cache
- **WebSocket Failure**: Frontend falls back to polling
- **Node Offline**: Detected via missing telemetry, marked offline

