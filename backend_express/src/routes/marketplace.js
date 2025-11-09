import express from 'express';
import { getCollection } from '../services/database.js';
import { authenticateSimpleToken, optionalAuth } from '../middleware/simpleAuth.js';
import logger from '../utils/logger.js';
import rlTradingAgent from '../services/market/rlTradingAgent.js';

const router = express.Router();

// GET /api/marketplace/bids - Get all bids (public read, vendors can filter by their own)
router.get('/bids', optionalAuth, async (req, res) => {
  try {
    const { status, market_type, placed_by, vendor_id, limit = 50 } = req.query;
    const bidsCollection = getCollection('market_bids');
    
    const query = {};
    if (status) query.status = status;
    if (market_type) query['rl_strategy.marketType'] = market_type;
    if (placed_by) query.placed_by = placed_by;
    if (vendor_id) query.vendor_id = vendor_id;
    
    // If vendor is authenticated, show their bids first
    if (req.user && req.user.role === 'vendor') {
      query.vendor_id = req.user.email;
    }
    
    const bids = await bidsCollection.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ success: true, count: bids.length, data: bids });
  } catch (error) {
    logger.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// POST /api/marketplace/bids - Create new bid (vendor auth required)
router.post('/bids', authenticateSimpleToken, async (req, res) => {
  try {
    const { service_type, capacity_mw, price_per_mw, duration_minutes, market_type } = req.body;
    
    if (!service_type || !capacity_mw || !price_per_mw) {
      return res.status(400).json({ 
        error: 'service_type, capacity_mw, and price_per_mw are required' 
      });
    }
    
    // Only vendors can create bids
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Only vendors can create bids' });
    }
    
    const bidsCollection = getCollection('market_bids');
    const bidId = `BID-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const bid = {
      bid_id: bidId,
      service_type,
      capacity_mw: parseFloat(capacity_mw),
      price_per_mw: parseFloat(price_per_mw),
      duration_minutes: parseInt(duration_minutes) || 60,
      market_type: market_type || 'intraday',
      status: 'pending',
      vendor_id: req.user.email,
      vendor_name: req.user.name,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await bidsCollection.insertOne(bid);
    
    logger.info(`Bid created by vendor ${req.user.email}: ${bidId}`);
    
    res.status(201).json({ success: true, data: bid });
  } catch (error) {
    logger.error('Error creating bid:', error);
    res.status(500).json({ error: 'Failed to create bid' });
  }
});

// PUT /api/marketplace/bids/:bidId - Update bid (vendor auth required, own bids only)
router.put('/bids/:bidId', authenticateSimpleToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const { capacity_mw, price_per_mw, duration_minutes, status } = req.body;
    
    const bidsCollection = getCollection('market_bids');
    const bid = await bidsCollection.findOne({ bid_id: bidId });
    
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    // Check ownership
    if (req.user.role === 'vendor' && bid.vendor_id !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to update this bid' });
    }
    
    // Only allow status updates if bid is already accepted/completed
    if (bid.status === 'accepted' || bid.status === 'completed') {
      return res.status(400).json({ error: 'Cannot update accepted or completed bid' });
    }
    
    const update = { updated_at: new Date() };
    if (capacity_mw !== undefined) update.capacity_mw = parseFloat(capacity_mw);
    if (price_per_mw !== undefined) update.price_per_mw = parseFloat(price_per_mw);
    if (duration_minutes !== undefined) update.duration_minutes = parseInt(duration_minutes);
    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) {
      update.status = status;
    }
    
    await bidsCollection.updateOne(
      { bid_id: bidId },
      { $set: update }
    );
    
    const updatedBid = await bidsCollection.findOne({ bid_id: bidId });
    
    logger.info(`Bid updated: ${bidId}`);
    
    res.json({ success: true, data: updatedBid });
  } catch (error) {
    logger.error('Error updating bid:', error);
    res.status(500).json({ error: 'Failed to update bid' });
  }
});

// DELETE /api/marketplace/bids/:bidId - Delete bid (vendor auth required, own bids only)
router.delete('/bids/:bidId', authenticateSimpleToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    
    const bidsCollection = getCollection('market_bids');
    const bid = await bidsCollection.findOne({ bid_id: bidId });
    
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    // Check ownership
    if (req.user.role === 'vendor' && bid.vendor_id !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this bid' });
    }
    
    // Only allow deletion if bid is pending or cancelled
    if (bid.status === 'accepted' || bid.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete accepted or completed bid' });
    }
    
    await bidsCollection.deleteOne({ bid_id: bidId });
    
    logger.info(`Bid deleted: ${bidId}`);
    
    res.json({ success: true, message: 'Bid deleted successfully' });
  } catch (error) {
    logger.error('Error deleting bid:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

// GET /api/marketplace/transactions - Get all transactions
router.get('/transactions', optionalAuth, async (req, res) => {
  try {
    const { status, vendor_id, placed_by, limit = 50 } = req.query;
    const transactionsCollection = getCollection('transactions');
    
    const query = {};
    if (status) query.status = status;
    if (vendor_id) query.vendor_id = vendor_id;
    if (placed_by) query.placed_by = placed_by;
    
    // If vendor is authenticated, show their transactions
    if (req.user && req.user.role === 'vendor') {
      query.vendor_id = req.user.email;
    }
    
    const transactions = await transactionsCollection.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/marketplace/transactions - Create transaction (when bid is accepted)
router.post('/transactions', optionalAuth, async (req, res) => {
  try {
    const { bid_id, vendor_id, capacity_mw, price_per_mw, duration_minutes, market_type } = req.body;
    
    if (!bid_id || !capacity_mw || !price_per_mw) {
      return res.status(400).json({ 
        error: 'bid_id, capacity_mw, and price_per_mw are required' 
      });
    }
    
    const transactionsCollection = getCollection('transactions');
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const transaction = {
      transaction_id: transactionId,
      bid_id,
      vendor_id: vendor_id || (req.user ? req.user.email : 'system'),
      capacity_mw: parseFloat(capacity_mw),
      price_per_mw: parseFloat(price_per_mw),
      duration_minutes: parseInt(duration_minutes) || 60,
      market_type: market_type || 'intraday',
      total_amount: parseFloat(capacity_mw) * parseFloat(price_per_mw) * (parseInt(duration_minutes) || 60) / 60,
      status: 'pending',
      placed_by: req.user ? req.user.email : 'amansharma12607@gmail.com',
      created_at: new Date(),
      started_at: null,
      completed_at: null,
      updated_at: new Date()
    };
    
    await transactionsCollection.insertOne(transaction);
    
    logger.info(`Transaction created: ${transactionId}`);
    
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    logger.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/marketplace/transactions/:transactionId - Update transaction status
router.put('/transactions/:transactionId', optionalAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;
    
    if (!status || !['pending', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }
    
    const transactionsCollection = getCollection('transactions');
    const transaction = await transactionsCollection.findOne({ transaction_id: transactionId });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const update = { 
      status,
      updated_at: new Date()
    };
    
    if (status === 'active' && !transaction.started_at) {
      update.started_at = new Date();
    }
    
    if (status === 'completed' && !transaction.completed_at) {
      update.completed_at = new Date();
      // Calculate completion time
      if (transaction.started_at) {
        const duration = new Date() - new Date(transaction.started_at);
        update.actual_duration_minutes = Math.round(duration / 60000);
      }
    }
    
    await transactionsCollection.updateOne(
      { transaction_id: transactionId },
      { $set: update }
    );
    
    const updatedTransaction = await transactionsCollection.findOne({ transaction_id: transactionId });
    
    logger.info(`Transaction updated: ${transactionId} -> ${status}`);
    
    res.json({ success: true, data: updatedTransaction });
  } catch (error) {
    logger.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// GET /api/marketplace/vendors - Get all vendors
router.get('/vendors', optionalAuth, async (req, res) => {
  try {
    const vendorsCollection = getCollection('vendors');
    const vendors = await vendorsCollection.find({ status: 'active' })
      .project({ password: 0 }) // Exclude password
      .sort({ companyName: 1 })
      .toArray();
    
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (error) {
    logger.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET /api/marketplace/trading-strategy - Get RL trading strategy (public, read-only)
router.get('/trading-strategy', async (req, res) => {
  try {
    // Get latest strategy without executing
    const tradingCollection = getCollection('trading_sessions');
    const latest = await tradingCollection.findOne({}, { sort: { timestamp: -1 } });
    
    if (latest) {
      res.json({ success: true, data: latest });
    } else {
      // Execute if no history
      const strategy = await rlTradingAgent.executeTradingStrategy();
      res.json({ success: true, data: strategy });
    }
  } catch (error) {
    logger.error('Error fetching trading strategy:', error);
    res.status(500).json({ error: 'Failed to fetch trading strategy' });
  }
});

// POST /api/marketplace/trading-strategy - Execute RL trading strategy (public)
router.post('/trading-strategy', async (req, res) => {
  try {
    const strategy = await rlTradingAgent.executeTradingStrategy();
    res.json({ success: true, data: strategy });
  } catch (error) {
    logger.error('Error executing trading strategy:', error);
    res.status(500).json({ error: 'Failed to execute trading strategy' });
  }
});

// GET /api/marketplace/trading-history - Get trading history
router.get('/trading-history', optionalAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await rlTradingAgent.getTradingHistory(parseInt(limit));
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    logger.error('Error fetching trading history:', error);
    res.status(500).json({ error: 'Failed to fetch trading history' });
  }
});

// GET /api/marketplace/performance - Get RL agent performance metrics
router.get('/performance', async (req, res) => {
  try {
    const metrics = await rlTradingAgent.getPerformanceMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

export default router;

