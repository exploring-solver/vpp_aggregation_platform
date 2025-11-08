import { MongoClient } from 'mongodb';
import logger from '../utils/logger.js';

let db = null;
let client = null;

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vpp_platform';
    client = new MongoClient(uri);
    
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME || 'vpp_platform');
    
    // Create indexes
    await createIndexes();
    
    logger.info('MongoDB connection established');
    return db;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
}

async function createIndexes() {
  // Telemetry collection indexes
  await db.collection('telemetry').createIndex({ dc_id: 1, timestamp: -1 });
  await db.collection('telemetry').createIndex({ timestamp: -1 });
  
  // Nodes collection indexes
  await db.collection('nodes').createIndex({ dc_id: 1 }, { unique: true });
  
  // Dispatch log indexes
  await db.collection('dispatch_log').createIndex({ dc_id: 1, timestamp: -1 });
  await db.collection('dispatch_log').createIndex({ timestamp: -1 });
  
  // Users collection indexes
  await db.collection('users').createIndex({ auth0_id: 1 }, { unique: true });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  
  logger.info('Database indexes created');
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
}

export function getCollection(name) {
  return getDB().collection(name);
}

export async function closeDB() {
  if (client) {
    await client.close();
    logger.info('MongoDB connection closed');
  }
}
