# 🔋 VPP Aggregation Platform

A comprehensive **Virtual Power Plant (VPP)** aggregation platform for managing distributed energy resources with real-time telemetry, dispatch control, AI forecasting, and reinforcement learning optimization.

## 🌟 Key Features

- **Real-time Monitoring**: WebSocket-based live telemetry from distributed edge nodes
- **Dispatch Control**: Send charge/discharge commands to battery systems
- **Multi-Platform**: Web dashboard (React) + Mobile app (Flutter)
- **AI-Powered**: Forecasting service with LSTM/Prophet (ready to implement)
- **RL Optimization**: Reinforcement learning agent for intelligent dispatch decisions
- **Scalable Architecture**: Microservices with MongoDB, Redis, and MQTT
- **Secure**: Auth0 authentication with role-based access control

## 🏗️ System Architecture

```
[Edge Nodes (FastAPI)] ◄─MQTT/HTTP─► [Aggregator (Express.js)] ◄─► [Web/Mobile]
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        │                     │                     │
                   [MongoDB]              [Redis]               [MQTT]
                    - Telemetry           - Pub/Sub            - Broker
                    - Metadata            - Caching
                    - Events
```

## 📦 Project Structure

```
vpp_aggregation_platform/
├── backend_express/          # Express.js Aggregator API
│   ├── src/
│   │   ├── routes/          # API routes (telemetry, dispatch, nodes, etc.)
│   │   ├── services/        # Business logic (DB, Redis, MQTT, WebSocket)
│   │   ├── middleware/      # Auth middleware (Auth0 JWT)
│   │   └── utils/           # Logger, helpers
│   ├── package.json
│   └── Dockerfile
│
├── services/                 # FastAPI Microservices
│   ├── edge_node/           # Edge node simulator
│   │   ├── main.py          # FastAPI app
│   │   ├── simulator.py     # Telemetry generation
│   │   ├── mqtt_client.py   # MQTT communication
│   │   └── config.py
│   ├── forecast_service/    # AI forecasting (TODO)
│   ├── rl_agent_service/    # RL optimization (TODO)
│   └── dispatch_worker/     # Reliable command delivery (TODO)
│
├── web_dashboard/           # React + Vite web app
│   ├── src/
│   │   ├── components/      # Layout, ProtectedRoute
│   │   ├── pages/           # Dashboard, Nodes, Dispatch, Forecasts
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── Dockerfile.dev
│
├── mobile_app/              # Flutter mobile app
│   ├── lib/
│   │   ├── screens/         # Login, Dashboard
│   │   └── main.dart
│   └── pubspec.yaml
│
├── docker/                  # Docker configurations
│   └── mosquitto/config/    # MQTT broker config
│
├── docker-compose.yml       # Orchestration for all services
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (recommended)
- **Node.js 20+** (for local dev)
- **Python 3.11+** (for FastAPI services)
- **Flutter SDK 3.0+** (for mobile app)
- **Auth0 Account** (for authentication)

### 1. Setup Environment Variables

```bash
# Root .env
cp .env.example .env

# Backend
cp backend_express/.env.example backend_express/.env

# Web Dashboard
cp web_dashboard/.env.example web_dashboard/.env

# Edge Node
cp services/edge_node/.env.example services/edge_node/.env
```

### 2. Configure Auth0

1. Go to [Auth0.com](https://auth0.com) and create an account
2. Create a **Single Page Application** for the web dashboard
3. Create an **API** with identifier (e.g., `https://vpp-api.example.com`)
4. Update your `.env` files with:
   ```env
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_AUDIENCE=https://vpp-api.example.com
   AUTH0_CLIENT_ID=your-client-id
   ```

### 3. Start All Services with Docker

```bash
# Build and start everything
docker-compose up --build

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access the Platform

| Service | URL | Description |
|---------|-----|-------------|
| **Web Dashboard** | http://localhost:5173 | React UI |
| **Aggregator API** | http://localhost:3000 | Express.js backend |
| **WebSocket** | ws://localhost:3001 | Real-time updates |
| **Edge Node 1** | http://localhost:8001 | Simulator DC01 |
| **Edge Node 2** | http://localhost:8002 | Simulator DC02 |
| **MongoDB** | localhost:27017 | Database |
| **Redis** | localhost:6379 | Cache & Pub/Sub |
| **MQTT Broker** | mqtt://localhost:1883 | IoT messaging |

## 🔑 Default Test Flow

1. **Start services**: `docker-compose up`
2. **Open web app**: http://localhost:5173
3. **Sign in** via Auth0 (create account first time)
4. **View dashboard** with real-time telemetry from 2 edge nodes
5. **Send dispatch command**: Go to Dispatch → Select nodes → Choose action
6. **Monitor results**: See telemetry updates in real-time

## 🛠️ Local Development (Without Docker)

### Backend (Express.js)

```bash
cd backend_express
npm install
npm run dev
```

Requires MongoDB and Redis running locally:
```bash
# MongoDB
mongod --dbpath ./data/db

# Redis
redis-server
```

### Web Dashboard

```bash
cd web_dashboard
npm install
npm run dev
```

### Edge Node Simulator

```bash
cd services/edge_node
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Mobile App

```bash
cd mobile_app
flutter pub get
flutter run
```

## 📡 API Documentation

### Aggregator API Endpoints

#### Telemetry
```http
POST /api/telemetry
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "dc_id": "DC01",
  "timestamp": "2025-01-08T10:00:00Z",
  "cpu_usage": 45.2,
  "soc": 78.5,
  "power_kw": 105.3,
  "freq": 49.98
}
```

```http
GET /api/telemetry?dc_id=DC01&limit=100
GET /api/telemetry/range?dc_id=DC01&start={timestamp}&end={timestamp}
```

#### Nodes
```http
GET /api/nodes              # List all nodes
GET /api/nodes/DC01         # Get specific node
POST /api/nodes             # Register new node (admin only)
PUT /api/nodes/DC01         # Update node (admin only)
DELETE /api/nodes/DC01      # Delete node (admin only)
```

#### Dispatch
```http
POST /api/dispatch
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "targets": ["DC01", "DC02"],  // or "all"
  "action": "charge",            // charge | discharge | defer_load | hold
  "params": {
    "kw": 20
  }
}
```

```http
GET /api/dispatch/logs?dc_id=DC01&limit=50
```

#### Aggregate
```http
GET /api/aggregate              # Get virtual plant statistics
GET /api/aggregate?nodeIds=DC01,DC02
```

Response:
```json
{
  "success": true,
  "data": {
    "total_power_kw": 245.8,
    "avg_soc": 78.5,
    "avg_freq": 49.98,
    "node_count": 2,
    "online_nodes": 2,
    "freq_status": "normal"
  }
}
```

## 🔐 Authentication & Authorization

### Auth0 Integration

The platform uses Auth0 for secure authentication:

1. **Web App**: Uses `@auth0/auth0-react` for login flow
2. **Backend**: Validates JWTs using `express-jwt` and `jwks-rsa`
3. **Mobile**: Uses Auth0 Flutter SDK (to be implemented)

### Roles

- **Admin**: Full access (create/delete nodes, all dispatch operations)
- **Operator**: Dispatch commands, view all data
- **Viewer**: Read-only access

Roles are managed in Auth0 and included in JWT claims.

## 📊 Database Schema

### MongoDB Collections

#### `telemetry`
```javascript
{
  "_id": ObjectId,
  "dc_id": "DC01",
  "timestamp": ISODate,
  "cpu_usage": 12.5,
  "network_mb_sent": 1.2,
  "network_mb_recv": 0.8,
  "soc": 78.3,
  "power_kw": 95.0,
  "freq": 49.95,
  "load_factor": 0.75
}
```

#### `nodes`
```javascript
{
  "_id": ObjectId,
  "dc_id": "DC01",
  "hostname": "edge-1",
  "location": { "lat": 28.6, "lon": 77.2 },
  "capacity_kw": 150,
  "battery_kwh": 200,
  "created_at": ISODate
}
```

#### `dispatch_log`
```javascript
{
  "_id": ObjectId,
  "dc_id": "DC01",
  "action": "discharge",
  "params": { "kw": 20 },
  "issued_by": "operator_id",
  "timestamp": ISODate,
  "status": "sent"
}
```

## 🧪 Testing

### Run Backend Tests
```bash
cd backend_express
npm test
```

### Run Edge Node Tests
```bash
cd services/edge_node
pytest
```

## 🐳 Docker Commands Reference

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Remove volumes (clean slate)
docker-compose down -v

# View logs
docker-compose logs -f [service_name]

# Rebuild specific service
docker-compose build aggregator_backend
docker-compose up -d aggregator_backend

# Scale edge nodes
docker-compose up --scale edge_node_1=3

# Execute command in container
docker-compose exec aggregator_backend npm run lint
```

## 🔧 Configuration

### Edge Node Configuration
```env
DC_ID=DC01                              # Unique node identifier
MQTT_ENABLED=true                       # Enable MQTT communication
MQTT_BROKER_URL=mqtt://localhost:1883
AGGREGATOR_URL=http://localhost:3000    # Fallback HTTP endpoint
TELEMETRY_INTERVAL=5                    # Seconds between telemetry
```

### Aggregator Configuration
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/vpp_platform
REDIS_HOST=localhost
REDIS_PORT=6379
MQTT_BROKER_URL=mqtt://localhost:1883
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api
```

## 🚧 Next Steps & TODOs

### Core Features (In Progress)
- [x] Express.js Aggregator API with Auth0
- [x] FastAPI Edge Node Simulator
- [x] React Web Dashboard (starter)
- [x] Flutter Mobile App (starter)
- [x] MongoDB integration
- [x] Redis pub/sub
- [x] MQTT communication
- [x] Docker Compose orchestration

### Advanced Features (Planned)
- [ ] **Forecast Service**: LSTM/Prophet models for load prediction
- [ ] **RL Agent Service**: PPO/DQN for optimal dispatch
- [ ] **Dispatch Worker**: Reliable command queue with retries
- [ ] **Charts Integration**: Recharts for web, fl_chart for mobile
- [ ] **WebSocket Client**: Real-time dashboard updates
- [ ] **Push Notifications**: Mobile alerts for critical events
- [ ] **Data Downsampling**: Time-series aggregation for efficiency
- [ ] **Kubernetes Manifests**: Production deployment configs
- [ ] **CI/CD Pipeline**: GitHub Actions for testing & deployment
- [ ] **Load Testing**: Performance benchmarks with k6
- [ ] **Monitoring**: Grafana dashboards & Prometheus metrics

## 📈 Performance Considerations

- **Telemetry Frequency**: Default 5 seconds per node (configurable)
- **WebSocket**: Selective subscriptions to reduce bandwidth
- **Redis Caching**: 10-second TTL for aggregate data
- **MongoDB Indexes**: Optimized for time-series queries
- **MQTT QoS**: Level 0 for telemetry, Level 1 for commands

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 💡 Architecture Decisions

### Why Express.js for Aggregator?
- Mature ecosystem for REST APIs
- Excellent WebSocket support
- Easy Auth0 integration
- Great for request/response patterns

### Why FastAPI for Edge Services?
- High performance with async support
- Automatic API documentation
- Perfect for data science/ML integration
- Type safety with Pydantic

### Why MongoDB?
- Flexible schema for telemetry
- Excellent time-series support
- Horizontal scalability
- Rich query capabilities

### Why Redis?
- Ultra-fast caching
- Built-in pub/sub
- Perfect for real-time features

### Why MQTT?
- Lightweight for IoT devices
- QoS levels for reliability
- Industry standard for edge communication

## 📞 Support

For issues, questions, or contributions:
- **GitHub Issues**: [Open an issue](https://github.com/your-repo/issues)
- **Documentation**: See `/docs` folder (to be created)
- **Email**: support@example.com

---

**Built with ❤️ for the clean energy future 🌱⚡**

*Last updated: 2025-01-08*
