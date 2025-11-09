import express from 'express';
import { getCollection } from '../services/database.js';
import { generateToken, authenticateSimpleToken } from '../middleware/simpleAuth.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// POST /api/vendor-auth/register - Register new vendor
router.post('/register', async (req, res) => {
  try {
    const { email, password, companyName, contactName, phone } = req.body;
    
    if (!email || !password || !companyName) {
      return res.status(400).json({ 
        error: 'email, password, and companyName are required' 
      });
    }
    
    const vendorsCollection = getCollection('vendors');
    
    // Check if vendor already exists
    const existingVendor = await vendorsCollection.findOne({ email });
    if (existingVendor) {
      return res.status(409).json({ 
        error: 'Vendor with this email already exists' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create vendor
    const vendor = {
      email,
      password: hashedPassword,
      companyName,
      contactName: contactName || companyName,
      phone: phone || '',
      role: 'vendor',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await vendorsCollection.insertOne(vendor);
    
    // Generate token
    const token = generateToken({
      id: vendor.email,
      email: vendor.email,
      name: vendor.companyName,
      role: 'vendor'
    });
    
    logger.info(`Vendor registered: ${email}`);
    
    res.status(201).json({
      success: true,
      token,
      vendor: {
        email: vendor.email,
        companyName: vendor.companyName,
        contactName: vendor.contactName,
        role: vendor.role
      }
    });
  } catch (error) {
    logger.error('Vendor registration error:', error);
    res.status(500).json({ error: 'Failed to register vendor' });
  }
});

// POST /api/vendor-auth/login - Vendor login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'email and password are required' 
      });
    }
    
    const vendorsCollection = getCollection('vendors');
    const vendor = await vendorsCollection.findOne({ email });
    
    if (!vendor) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, vendor.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Check if vendor is active
    if (vendor.status !== 'active') {
      return res.status(403).json({ 
        error: 'Vendor account is not active' 
      });
    }
    
    // Update last login
    await vendorsCollection.updateOne(
      { email },
      { $set: { last_login: new Date() } }
    );
    
    // Generate token
    const token = generateToken({
      id: vendor.email,
      email: vendor.email,
      name: vendor.companyName,
      role: 'vendor'
    });
    
    logger.info(`Vendor logged in: ${email}`);
    
    res.json({
      success: true,
      token,
      vendor: {
        email: vendor.email,
        companyName: vendor.companyName,
        contactName: vendor.contactName,
        role: vendor.role
      }
    });
  } catch (error) {
    logger.error('Vendor login error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// GET /api/vendor-auth/me - Get current vendor info
router.get('/me', authenticateSimpleToken, async (req, res) => {
  try {
    const vendorsCollection = getCollection('vendors');
    const vendor = await vendorsCollection.findOne({ email: req.user.email });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json({
      success: true,
      vendor: {
        email: vendor.email,
        companyName: vendor.companyName,
        contactName: vendor.contactName,
        phone: vendor.phone,
        role: vendor.role,
        status: vendor.status,
        created_at: vendor.created_at
      }
    });
  } catch (error) {
    logger.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor info' });
  }
});

export default router;

