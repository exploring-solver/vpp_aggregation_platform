import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vpp-platform-secret-key-change-in-production-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Simple JWT token authentication middleware
export function authenticateSimpleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    req.user = decoded; // For compatibility
    next();
  } catch (error) {
    logger.warn(`Token verification failed: ${error.message}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
}

// Generate a simple JWT token
export function generateToken(user) {
  const payload = {
    sub: user.id || user.email,
    email: user.email,
    name: user.name || user.email,
    role: user.role || 'operator',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

// Optional authentication middleware - doesn't fail if no token, but sets req.user if valid token provided
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without authentication
    req.user = null;
    req.auth = null;
    return next();
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    req.user = decoded; // For compatibility
    next();
  } catch (error) {
    // Token invalid or expired - continue without authentication
    logger.warn(`Optional auth token verification failed: ${error.message}`);
    req.user = null;
    req.auth = null;
    next();
  }
}

// Check role middleware
export function checkRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.auth?.role || req.user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.warn(`Access denied for user ${req.auth?.sub} with role ${userRole}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
}

export { JWT_SECRET, JWT_EXPIRES_IN };

