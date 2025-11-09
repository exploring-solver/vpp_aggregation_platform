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
    
    // Set up message handler immediately after connection
    setupMessageHandler();
    
    logger.info('Redis connections established');
    
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

// Simple pub/sub implementation - store callbacks per channel
const channelCallbacks = new Map();
let messageHandlerRegistered = false;

// Single global message handler - register once
function setupMessageHandler() {
  if (messageHandlerRegistered) return;
  
  const subscriber = getSubscriberClient();
  
  // Register ONE message handler that routes to appropriate callbacks
  subscriber.on('message', (message, channelName) => {
    const callbacks = channelCallbacks.get(channelName) || [];
    if (callbacks.length === 0) return;
    
    let data;
    try {
      data = typeof message === 'string' ? JSON.parse(message) : message;
    } catch (e) {
      data = message;
    }
    
    callbacks.forEach(cb => {
      if (typeof cb === 'function') {
        try {
          cb(data);
        } catch (error) {
          logger.error(`Error in callback for channel ${channelName}:`, error);
        }
      }
    });
  });
  
  messageHandlerRegistered = true;
  logger.info('Redis message handler registered');
}

export async function subscribeChannel(channel, callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  const subscriber = getSubscriberClient();
  
  // Ensure message handler is set up (should already be done during connection)
  setupMessageHandler();
  
  // Store callback first
  if (!channelCallbacks.has(channel)) {
    channelCallbacks.set(channel, []);
  }
  channelCallbacks.get(channel).push(callback);
  
  // Subscribe to channel only if this is the first callback
  if (channelCallbacks.get(channel).length === 1) {
    await subscriber.subscribe(channel);
    logger.info(`Subscribed to Redis channel: ${channel}`);
  } else {
    logger.debug(`Added additional callback to existing subscription: ${channel}`);
  }
}
