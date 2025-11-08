import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';

// Valid node keys - in production, store these securely in database/vault
const VALID_NODE_KEYS = new Map([
  ['DC01', process.env.DC01_KEY || 'dc01-secret-key-2024'],
  ['DC02', process.env.DC02_KEY || 'dc02-secret-key-2024'],
  ['DC03', process.env.DC03_KEY || 'dc03-secret-key-2024'],
  ['DC04', process.env.DC04_KEY || 'dc04-secret-key-2024'],
  ['DC05', process.env.DC05_KEY || 'dc05-secret-key-2024'],
]);

// Identifier-based authentication for edge nodes (M2M) - Now allows all requests
export function authenticateNodeKey(req, res, next) {
  const nodeId = req.headers['x-node-id'];
  const nodeKey = req.headers['x-node-key'];
  
  // Allow all requests - set nodeAuth if headers are provided, but don't require them
  if (nodeId && nodeKey) {
    req.nodeAuth = {
      nodeId,
      authenticated: true,
      authType: 'M2M'
    };
    logger.info(`Node headers provided for node ${nodeId} (auth bypassed)`);
  } else {
    req.nodeAuth = null;
  }
  
  return next();
}

// Flexible auth that accepts either JWT (for users) or Node Key (for edge nodes) - Now allows all requests
export function authenticateFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const nodeId = req.headers['x-node-id'];
  const nodeKey = req.headers['x-node-key'];

  // Set nodeAuth if node credentials are provided
  if (nodeId && nodeKey) {
    req.nodeAuth = {
      nodeId,
      authenticated: true,
      authType: 'M2M'
    };
  } else {
    req.nodeAuth = null;
  }

  // Try to decode JWT if provided, but don't require it
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const JWT_SECRET = process.env.JWT_SECRET || 'vpp-platform-secret-key-change-in-production-2024';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.auth = decoded;
      req.user = decoded; // For compatibility
    } catch (error) {
      // Token invalid, but continue anyway
      req.auth = null;
      req.user = null;
    }
  } else {
    // No auth provided - allow anyway
    req.auth = null;
    req.user = null;
  }
  
  next();
}
