// Use simple auth by default, but allow fallback to Auth0 if configured
import { authenticateSimpleToken, checkRole as simpleCheckRole } from './simpleAuth.js';
import logger from '../utils/logger.js';

// Default to simple auth - Auth0 can be enabled via USE_AUTH0 env var
// For now, always use simple auth
export const authenticateToken = authenticateSimpleToken;
export const checkRole = simpleCheckRole;

export function optionalAuth(req, res, next) {
  // Allow requests to proceed even without valid token
  next();
}
