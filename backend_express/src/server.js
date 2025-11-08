import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Import routes
import telemetryRoutes from './routes/telemetry.js';
import dispatchRoutes from './routes/dispatch.js';
import nodesRoutes from './routes/nodes.js';
import aggregateRoutes from './routes/aggregate.js';
import authRoutes from './routes/auth.js';

// Import services
import { connectDB } from './services/database.js';
import { connectRedis, getRedisClient } from './services/redis.js';
import { initMQTT } from './services/mqtt.js';
import logger from './utils/logger.js';
import { authenticateToken } from './middleware/auth.js';
import { setupWebSocket } from './services/websocket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/telemetry', authenticateToken, telemetryRoutes);
app.use('/api/dispatch', authenticateToken, dispatchRoutes);
app.use('/api/nodes', authenticateToken, nodesRoutes);
app.use('/api/aggregate', authenticateToken, aggregateRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Initialize MQTT
    await initMQTT();
    logger.info('MQTT client initialized');

    // Start HTTP server
    const server = createServer(app);
    server.listen(PORT, () => {
      logger.info(`🚀 Aggregator API running on port ${PORT}`);
    });

    // Start WebSocket server
    const wsServer = createServer();
    const wss = new WebSocketServer({ server: wsServer });
    setupWebSocket(wss);
    
    wsServer.listen(WS_PORT, () => {
      logger.info(`🔌 WebSocket server running on port ${WS_PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      wsServer.close(() => {
        logger.info('WebSocket server closed');
      });
      const redis = getRedisClient();
      await redis.quit();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
