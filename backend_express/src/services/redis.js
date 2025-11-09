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
    // Note: Redis pub/sub subscriptions disabled due to node-redis v4 compatibility
    subscriberClient = redisClient.duplicate();
    subscriberClient.on('error', (err) => logger.error('Redis Subscriber Error:', err));
    await subscriberClient.connect();
    
    logger.info('Redis connections established (pub/sub disabled, using direct callbacks)');
    
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

// Pub/Sub subscription - DISABLED due to node-redis v4 compatibility issues
// Using direct callback triggering instead of Redis pub/sub
const channelCallbacks = new Map();

export async function subscribeChannel(channel, callback) {
  // Store callback for manual triggering (no Redis subscription)
  if (!channelCallbacks.has(channel)) {
    channelCallbacks.set(channel, []);
  }
  channelCallbacks.get(channel).push(callback);
  logger.debug(`Registered callback for channel: ${channel} (Redis pub/sub disabled)`);
}

// Manual trigger function to call callbacks (used instead of Redis pub/sub)
export function triggerChannelCallbacks(channel, data) {
  const callbacks = channelCallbacks.get(channel) || [];
  callbacks.forEach(cb => {
    if (typeof cb === 'function') {
      try {
        cb(data);
      } catch (error) {
        logger.error(`Error in callback for channel ${channel}:`, error);
      }
    }
  });
}
