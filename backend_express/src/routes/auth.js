import express from 'express';
import { getCollection } from '../services/database.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const auth0Id = req.auth.sub;
    const collection = getCollection('users');
    
    let user = await collection.findOne({ auth0_id: auth0Id });
    
    // Create user if doesn't exist (first login)
    if (!user) {
      user = {
        auth0_id: auth0Id,
        email: req.auth.email || req.auth['https://vpp.example.com/email'],
        name: req.auth.name || req.auth['https://vpp.example.com/name'],
        role: req.auth['https://vpp.example.com/roles']?.[0] || 'viewer',
        created_at: new Date()
      };
      
      await collection.insertOne(user);
      logger.info(`Created new user: ${user.email}`);
    }
    
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// POST /api/auth/user - Create/update user (for Auth0 hooks)
router.post('/user', async (req, res) => {
  try {
    const { auth0_id, email, name, role = 'viewer' } = req.body;
    
    if (!auth0_id || !email) {
      return res.status(400).json({ error: 'auth0_id and email are required' });
    }
    
    const collection = getCollection('users');
    
    const user = {
      auth0_id,
      email,
      name,
      role,
      created_at: new Date()
    };
    
    await collection.updateOne(
      { auth0_id },
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
