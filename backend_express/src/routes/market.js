import express from 'express';
import marketBidding from '../services/market/marketBidding.js';
import logger from '../utils/logger.js';
import { checkRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/market/bids - Prepare and submit market bid
router.post('/bids', checkRole(['operator', 'admin']), async (req, res) => {
  try {
    const { service_type, capacity_mw, price_per_mw, duration_minutes } = req.body;
    
    if (!service_type || !capacity_mw || !price_per_mw) {
      return res.status(400).json({ 
        error: 'service_type, capacity_mw, and price_per_mw are required' 
      });
    }
    
    const result = await marketBidding.prepareBid(
      service_type,
      parseFloat(capacity_mw),
      parseFloat(price_per_mw),
      parseInt(duration_minutes) || 15
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error preparing market bid:', error);
    res.status(500).json({ error: error.message || 'Failed to prepare market bid' });
  }
});

// GET /api/market/bids - Get active bids
router.get('/bids', async (req, res) => {
  try {
    const bids = await marketBidding.getActiveBids();
    res.json({ success: true, count: bids.length, data: bids });
  } catch (error) {
    logger.error('Error fetching active bids:', error);
    res.status(500).json({ error: 'Failed to fetch active bids' });
  }
});

// GET /api/market/bids/:bidId - Get bid status
router.get('/bids/:bidId', async (req, res) => {
  try {
    const { bidId } = req.params;
    const bid = await marketBidding.getBidStatus(bidId);
    res.json({ success: true, data: bid });
  } catch (error) {
    logger.error(`Error fetching bid ${req.params.bidId}:`, error);
    res.status(404).json({ error: error.message || 'Bid not found' });
  }
});

export default router;

