import logger from '../utils/logger.js';
import { getCollection } from '../services/database.js';
import { authenticateSimpleToken } from './simpleAuth.js';

// Valid node keys - in production, store these securely in database/vault
const VALID_NODE_KEYS = new Map([
  ['DC01', process.env.DC01_KEY || 'dc01-secret-key-2024'],
  ['DC02', process.env.DC02_KEY || 'dc02-secret-key-2024'],
  ['DC03', process.env.DC03_KEY || 'dc03-secret-key-2024'],
  ['DC04', process.env.DC04_KEY || 'dc04-secret-key-2024'],
  ['DC05', process.env.DC05_KEY || 'dc05-secret-key-2024'],
]);

// Identifier-based authentication for edge nodes (M2M)
export function authenticateNodeKey(req, res, next) {
  const nodeId = req.headers['x-node-id'];
  const nodeKey = req.headers['x-node-key'];
  
  if (!nodeId || !nodeKey) {
    logger.warn('M2M authentication failed: Missing node ID or key headers');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Node ID and key headers required for M2M communication'
    });
  }

  // Validate node key
  const expectedKey = VALID_NODE_KEYS.get(nodeId);
  if (!expectedKey || expectedKey !== nodeKey) {
    logger.warn(`M2M authentication failed for node ${nodeId}: Invalid key`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid node credentials'
    });
  }

  // Successfully authenticated
  req.nodeAuth = {
    nodeId,
    authenticated: true,
    authType: 'M2M'
  };
  
  logger.info(`M2M authentication successful for node ${nodeId}`);
  return next();
}

// Flexible auth that accepts either JWT (for users) or Node Key (for edge nodes)
export function authenticateFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const nodeId = req.headers['x-node-id'];
  const nodeKey = req.headers['x-node-key'];

  // If node credentials are provided, use node key auth (M2M)
  if (nodeId && nodeKey) {
    return authenticateNodeKey(req, res, next);
  }

  // If Bearer token is provided, use JWT auth (user auth)
  if (authHeader?.startsWith('Bearer ')) {
    // Use simple auth middleware
    return authenticateSimpleToken(req, res, next);
  } else {
    // No auth provided
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required (JWT Bearer token or Node credentials)'
    });
  }
}
