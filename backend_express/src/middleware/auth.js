import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import logger from '../utils/logger.js';

export const authenticateToken = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
  credentialsRequired: true
});

export function checkRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.auth?.role || req.auth['https://vpp.example.com/roles']?.[0];
    
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

export function optionalAuth(req, res, next) {
  // Allow requests to proceed even without valid token
  next();
}
