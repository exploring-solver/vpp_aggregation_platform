import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient = null;
let subscriberClient = null;

export async function connectRedis() {
  try {
    // Main Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    redisClient.on('connect', () => logger.info('Redis client connected'));
    
    await redisClient.connect();

    // Subscriber client (separate connection for pub/sub)
    subscriberClient = redisClient.duplicate();
    subscriberClient.on('error', (err) => logger.error('Redis Subscriber Error:', err));
    await subscriberClient.connect();
    
    // CRITICAL: Initialize message handler IMMEDIATELY after connection
    // This must happen before any subscribe() calls
    initializeRedisSubscriptions();
    
    // Small delay to ensure handler is fully registered
    await new Promise(resolve => setImmediate(resolve));
    
    logger.info('Redis connections established with pub/sub handler ready');
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis first.');
  }
  return redisClient;
}

export function getSubscriberClient() {
  if (!subscriberClient) {
    throw new Error('Redis subscriber not initialized.');
  }
  return subscriberClient;
}

// Cache helpers
export async function cacheSet(key, value, expirySeconds = 300) {
  const client = getRedisClient();
  const data = typeof value === 'string' ? value : JSON.stringify(value);
  await client.setEx(key, expirySeconds, data);
}

export async function cacheGet(key) {
  const client = getRedisClient();
  const data = await client.get(key);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export async function cacheDel(key) {
  const client = getRedisClient();
  await client.del(key);
}

// Pub/Sub helpers
export async function publishMessage(channel, message) {
  const client = getRedisClient();
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  await client.publish(channel, data);
  logger.debug(`Published to ${channel}:`, message);
}

const channelSubscriptions = new Map();
let messageHandlerSetup = false;

// Global message handler function - must be defined at module level
function redisMessageHandler(message, channelName) {
  try {
    // Parse message data
    let data;
    try {
      data = typeof message === 'string' ? JSON.parse(message) : message;
    } catch (parseError) {
      // If JSON parse fails, use raw message
      data = message;
    }
    
    // Get all callbacks for this channel
    const callbacks = channelSubscriptions.get(channelName) || [];
    
    if (callbacks.length === 0) {
      logger.debug(`No callbacks registered for channel ${channelName}`);
      return;
    }
    
    // Call all callbacks
    callbacks.forEach(cb => {
      if (typeof cb === 'function') {
        try {
          cb(data);
        } catch (error) {
          logger.error(`Error in channel callback for ${channelName}:`, error);
        }
      } else {
        logger.warn(`Invalid callback for channel ${channelName}: not a function`);
      }
    });
  } catch (error) {
    logger.error(`Error handling Redis message for ${channelName}:`, error);
  }
}

// Initialize message handler early - MUST be called before any subscriptions
function initializeRedisSubscriptions() {
  if (messageHandlerSetup || !subscriberClient) {
    if (messageHandlerSetup) {
      logger.debug('Redis message handler already configured');
    }
    return;
  }
  
  // Redis v4+ uses 'message' event with (message, channel) signature
  // CRITICAL: Set up the handler BEFORE any subscribe() calls
  // Register the handler using the module-level function
  try {
    subscriberClient.on('message', redisMessageHandler);
    messageHandlerSetup = true;
    logger.info('Redis message handler configured and registered');
  } catch (error) {
    logger.error('Failed to register Redis message handler:', error);
    throw error;
  }
}

export async function subscribeChannel(channel, callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  // CRITICAL: Ensure message handler is set up BEFORE subscribing
  if (!messageHandlerSetup) {
    initializeRedisSubscriptions();
  }
  
  const subscriber = getSubscriberClient();
  
  // Store callback for this channel FIRST
  if (!channelSubscriptions.has(channel)) {
    channelSubscriptions.set(channel, []);
  }
  channelSubscriptions.get(channel).push(callback);
  logger.debug(`Added callback to Redis channel: ${channel}`);
  
  // Subscribe to channel (only if not already subscribed)
  if (channelSubscriptions.get(channel).length === 1) {
    try {
      // Use the proper node-redis v4 subscribe method
      // This returns a promise that resolves when subscription is confirmed
      await subscriber.subscribe(channel);
      logger.info(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      logger.error(`Failed to subscribe to channel ${channel}:`, error);
      // Remove callback if subscription failed
      const callbacks = channelSubscriptions.get(channel) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      throw error;
    }
  }
}
