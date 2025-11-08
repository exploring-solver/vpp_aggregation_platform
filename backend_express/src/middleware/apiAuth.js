import logger from '../utils/logger.js';

// Simple API key authentication for M2M communication (edge nodes)
export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('ApiKey ', '');
  
  // For now, accept any valid JWT token OR a simple API key
  // You can make this more secure by using a separate API key
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required for M2M communication'
    });
  }

  // For development, accept a simple API key
  const validApiKeys = [
    process.env.EDGE_NODE_API_KEY || 'vpp-edge-node-key-2024',
    // Also accept Bearer tokens for backward compatibility
  ];

  // Check if it's a Bearer token (JWT)
  if (apiKey.startsWith('Bearer ')) {
    // Let the JWT middleware handle it
    return next();
  }

  // Check API key
  if (validApiKeys.includes(apiKey)) {
    req.apiKeyAuth = true;
    return next();
  }

  logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 10)}...`);
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid API key'
  });
}

// Flexible auth that accepts either JWT or API key
export function authenticateFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // If API key is provided, use API key auth
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // If Bearer token is provided, use JWT auth
  if (authHeader?.startsWith('Bearer ')) {
    // Import and use the JWT middleware
    import('./auth.js').then(({ authenticateToken }) => {
      return authenticateToken(req, res, next);
    }).catch(next);
  } else {
    // No auth provided
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
}