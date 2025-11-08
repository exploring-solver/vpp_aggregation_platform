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
import forecastRoutes from './routes/forecast.js';
import optimizationRoutes from './routes/optimization.js';
import marketRoutes from './routes/market.js';

// Import services
import { connectDB } from './services/database.js';
import { connectRedis, getRedisClient } from './services/redis.js';
import { initMQTT } from './services/mqtt.js';
import logger from './utils/logger.js';
import { authenticateToken } from './middleware/auth.js';
import { authenticateFlexible } from './middleware/apiAuth.js';
import { setupWebSocket } from './services/websocket.js';
import forecastScheduler from './jobs/forecastScheduler.js';
import optimizationScheduler from './jobs/optimizationScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
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

// Protected routes - telemetry uses flexible auth (API key or JWT)
app.use('/api/telemetry', authenticateFlexible, telemetryRoutes);

// Protected routes with JWT authentication
app.use('/api/dispatch', authenticateToken, dispatchRoutes);
app.use('/api/nodes', authenticateToken, nodesRoutes);
app.use('/api/aggregate', authenticateToken, aggregateRoutes);
app.use('/api/forecast', authenticateToken, forecastRoutes);
app.use('/api/optimization', authenticateToken, optimizationRoutes);
app.use('/api/market', authenticateToken, marketRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle authentication errors from express-jwt
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    logger.warn(`Authentication error: ${err.message}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message || 'Invalid or missing authentication token',
      timestamp: new Date().toISOString()
    });
  }

  // Handle other errors
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

    // Start scheduled jobs
    forecastScheduler.start();
    optimizationScheduler.start();
    logger.info('Scheduled jobs started');

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
      
      // Stop schedulers
      forecastScheduler.stop();
      optimizationScheduler.stop();
      
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
