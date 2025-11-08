import express from 'express';
import { getCollection } from '../services/database.js';
import { generateToken } from '../middleware/simpleAuth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/auth/login - Simple login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simple authentication - in production, use proper password hashing
    // For now, accept any email/password or use environment variables
    const validUsers = [
      { email: process.env.ADMIN_EMAIL || 'admin@vpp.com', password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin' },
      { email: 'operator@vpp.com', password: 'operator123', role: 'operator' },
      { email: 'viewer@vpp.com', password: 'viewer123', role: 'viewer' }
    ];
    
    // Allow any email if no password is set (development mode)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let user = null;
    
    if (isDevelopment && !password) {
      // Development mode: accept any email
      user = {
        email: email || 'admin@vpp.com',
        name: email?.split('@')[0] || 'Admin',
        role: 'admin',
        id: email || 'admin@vpp.com'
      };
    } else {
      // Find user
      user = validUsers.find(u => u.email === email && u.password === password);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        });
      }
      user = {
        email: user.email,
        name: user.email.split('@')[0],
        role: user.role,
        id: user.email
      };
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Store or update user in database
    const collection = getCollection('users');
    await collection.updateOne(
      { email: user.email },
      {
        $set: {
          ...user,
          last_login: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    logger.info(`User logged in: ${user.email}`);
    
    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// GET /api/auth/me - Get current user info (public)
router.get('/me', async (req, res) => {
  try {
    // For public access, return a default user or empty
    const authHeader = req.headers.authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Try to decode token if provided, but don't require it
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'vpp-platform-secret-key-change-in-production-2024');
        const collection = getCollection('users');
        user = await collection.findOne({ email: decoded.sub || decoded.email });
        
        if (!user) {
          user = {
            email: decoded.email || decoded.sub,
            name: decoded.name || decoded.email,
            role: decoded.role || 'viewer',
            created_at: new Date()
          };
          await collection.insertOne(user);
        }
      } catch (error) {
        // Token invalid, return default
        user = { email: 'anonymous', name: 'Anonymous', role: 'viewer' };
      }
    } else {
      // No token, return default
      user = { email: 'anonymous', name: 'Anonymous', role: 'viewer' };
    }
    
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// POST /api/auth/user - Create/update user
router.post('/user', async (req, res) => {
  try {
    const { email, name, role = 'viewer' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    const collection = getCollection('users');
    
    const user = {
      email,
      name: name || email.split('@')[0],
      role,
      created_at: new Date()
    };
    
    await collection.updateOne(
      { email },
      { $set: user, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    );
    
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    logger.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to process user' });
  }
});

export default router;
