// Use simple auth by default, but allow fallback to Auth0 if configured
import { authenticateSimpleToken, checkRole as simpleCheckRole } from './simpleAuth.js';
import logger from '../utils/logger.js';

// Default to simple auth - Auth0 can be enabled via USE_AUTH0 env var
// For now, always use simple auth
export const authenticateToken = authenticateSimpleToken;
export const checkRole = simpleCheckRole;

// Optional auth - tries to authenticate but doesn't fail if no token
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try to authenticate if token is provided
    return authenticateSimpleToken(req, res, next);
  } else {
    // No token provided, continue without auth
    req.auth = null;
    req.user = null;
    next();
  }
}

// Check role - requires auth for write operations
export function optionalCheckRole(allowedRoles) {
  return (req, res, next) => {
    // For write operations (POST, PUT, DELETE, PATCH), require auth
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!req.auth) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required for this operation'
        });
      }
      // Check role if auth exists
      return simpleCheckRole(allowedRoles)(req, res, next);
    }
    
    // For read operations (GET), allow without auth
    next();
  };
}
