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
    await subscriberClient.connect();
    
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

const channelSubscriptions = new Map();
let messageHandlerSetup = false;

export async function subscribeChannel(channel, callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  const client = getSubscriberClient();
  
  // Store callback for this channel
  if (!channelSubscriptions.has(channel)) {
    channelSubscriptions.set(channel, []);
    
    // Subscribe to channel
    await client.subscribe(channel);
    logger.info(`Subscribed to Redis channel: ${channel}`);
  }
  
  channelSubscriptions.get(channel).push(callback);
  logger.debug(`Added callback to Redis channel: ${channel}`);
  
  // Set up global message handler once
  if (!messageHandlerSetup) {
    const subscriber = getSubscriberClient();
    
    // Redis v4+ uses 'message' event with (message, channel) signature
    subscriber.on('message', (message, channelName) => {
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
    });
    
    messageHandlerSetup = true;
    logger.info('Redis message handler configured');
  }
}
