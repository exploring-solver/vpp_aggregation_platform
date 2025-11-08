# VPP Data & Persistence Layer Service

## Overview

The Data & Persistence Layer Service is a centralized storage and query layer for time-series telemetry, forecasts, events, and transaction data for the Virtual Power Plant (VPP) Aggregation Platform.

## Architecture

### Components

1. **Time-Series Database (MongoDB)**
   - Stores per-node telemetry with timestamps
   - Optimized for high-frequency data ingestion
   - Automated data retention and cleanup

2. **Metadata Store**
   - Static information: data center IDs, capacities, location, tariffs
   - Node configurations and technical specifications
   - Geographic and operational data

3. **Transaction Log**
   - All dispatch events, bids, and settlements
   - Blockchain integration for settlement tracking
   - Financial and operational transaction data

4. **Analytics Engine**
   - Real-time data aggregation
   - Historical performance analysis
   - Revenue and efficiency metrics

5. **Redis Cache Layer**
   - Real-time data access
   - Query result caching
   - Portfolio aggregations

## API Endpoints

### Telemetry Data

```
POST /api/telemetry/:nodeId          - Ingest single telemetry reading
POST /api/telemetry/batch            - Batch telemetry ingestion
GET  /api/telemetry/:nodeId/latest   - Get latest telemetry data
GET  /api/telemetry/:nodeId/historical - Get historical aggregated data
```

### Transaction Logging

```
POST /api/transactions               - Log new transaction
GET  /api/transactions/:nodeId       - Get node transactions
```

### Analytics

```
GET /api/analytics/:nodeId/daily     - Daily analytics
GET /api/analytics/:nodeId/monthly   - Monthly analytics
GET /api/analytics/:nodeId/benchmarks - Performance benchmarks
GET /api/analytics/portfolio         - Portfolio-wide analytics
```

### Metadata Management

```
POST   /api/metadata                 - Create node metadata
GET    /api/metadata/:nodeId         - Get node metadata
PATCH  /api/metadata/:nodeId         - Update node metadata
```

### Query Endpoints

```
GET /api/nodes/active                - Get all active nodes
GET /api/nodes/by-type/:type         - Get nodes by technology type
GET /api/nodes/nearby                - Geographic node search
GET /api/realtime/portfolio          - Real-time portfolio data
```

## Data Models

### TelemetryData
- Time-series telemetry readings
- Power output, voltage, current, frequency
- Weather conditions and grid metrics
- System health indicators
- Data quality metrics

### NodeMetadata
- Static node information
- Location and capacity data
- Tariff and pricing information
- Technical specifications
- Grid connection details

### TransactionLog
- Dispatch and settlement events
- Financial transaction data
- Blockchain integration
- Performance tracking
- Compliance information

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the service:
```bash
npm start        # Production
npm run dev      # Development with nodemon
```

## Configuration

### Database Setup

**MongoDB:**
- Requires MongoDB 4.4+ (5.0+ recommended for time-series collections)
- Automatic indexing for time-series queries
- TTL indexes for data retention

**Redis:**
- Used for caching and real-time aggregations
- Pub/sub for real-time data streaming
- Queue management for batch processing

### Environment Variables

See `.env.example` for all configuration options.

## Performance Features

### High-Throughput Ingestion
- Batch processing for telemetry data
- Asynchronous queue processing
- Optimized database writes

### Efficient Querying
- Compound indexes for time-series data
- Redis caching for frequent queries
- Aggregation pipelines for analytics

### Real-Time Updates
- Redis pub/sub for live data streaming
- Portfolio-level aggregations
- Real-time performance metrics

## Data Retention

- **Telemetry Data**: 30 days (configurable)
- **Transaction Logs**: 2 years (configurable)
- **Analytics Cache**: 1-24 hours depending on type
- **Real-time Cache**: 5 minutes

## Monitoring and Health

### Health Check
```
GET /health
```

### Data Quality Metrics
```
GET /api/data-quality/:nodeId
```

### Performance Monitoring
- Query response times
- Cache hit rates
- Database connection health
- Queue processing status

## Integration

The service integrates with:
- **VPP Aggregation Platform**: Receives aggregated data
- **Dashboard Services**: Provides visualization data
- **Blockchain Settlement Layer**: Transaction verification
- **AI/ML Pipelines**: Training data and features

## Scaling Considerations

### Horizontal Scaling
- Multiple service instances behind load balancer
- Database read replicas for query distribution
- Redis cluster for cache scaling

### Data Partitioning
- Time-based partitioning for telemetry data
- Node-based sharding for large deployments
- Archive old data to cold storage

## Security

- Rate limiting on API endpoints
- Input validation and sanitization
- Secure database connections
- Environment-based configuration

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
data_layer_service/
├── models/           # Database models
├── services/         # Business logic
├── routes/          # API endpoints  
├── logs/            # Application logs
├── server.js        # Main application
└── package.json     # Dependencies
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Adjust batch sizes and cache TTL
2. **Slow Queries**: Check indexes and query patterns
3. **Connection Timeouts**: Increase pool sizes and timeouts
4. **Data Quality**: Monitor completeness and accuracy metrics

### Logs

Application logs are written to:
- `logs/error.log` - Error messages
- `logs/combined.log` - All log levels
- Console output in development

## Support

For issues and questions, please refer to the main VPP platform documentation or contact the development team.
