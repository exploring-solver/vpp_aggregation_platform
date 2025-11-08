// Use simple auth by default, but allow fallback to Auth0 if configured
import { authenticateSimpleToken, checkRole as simpleCheckRole } from './simpleAuth.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';

// All authentication is now bypassed - allow all requests
export function authenticateToken(req, res, next) {
  // Try to decode token if provided, but don't require it
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET || 'vpp-platform-secret-key-change-in-production-2024';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.auth = decoded;
      req.user = decoded;
    } catch (error) {
      // Token invalid, but continue anyway
      req.auth = null;
      req.user = null;
    }
  } else {
    // No token - allow anyway
    req.auth = null;
    req.user = null;
  }
  next();
}

// Check role - now allows all requests
export function checkRole(allowedRoles) {
  return (req, res, next) => {
    // Allow all requests regardless of role
    next();
  };
}

// Optional auth - tries to authenticate but doesn't fail if no token (now always allows)
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try to decode token if provided, but don't fail if invalid
    try {
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET || 'vpp-platform-secret-key-change-in-production-2024';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.auth = decoded;
      req.user = decoded;
    } catch (error) {
      // Token invalid, but continue anyway
      req.auth = null;
      req.user = null;
    }
  } else {
    // No token provided, continue without auth
    req.auth = null;
    req.user = null;
  }
  next();
}

// Check role - now allows all requests regardless of method or role
export function optionalCheckRole(allowedRoles) {
  return (req, res, next) => {
    // Allow all requests regardless of method or role
    next();
  };
}
