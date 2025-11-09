import express from 'express';
import { getCollection } from '../services/database.js';
import { authenticateSimpleToken, optionalAuth } from '../middleware/simpleAuth.js';
import logger from '../utils/logger.js';
import rlTradingAgent from '../services/market/rlTradingAgent.js';

const router = express.Router();

// ============================================================================
// ENERGY CONTRACTS (posted by vendors - energy companies)
// ============================================================================

// GET /api/marketplace/contracts - Get all energy contracts (public read)
router.get('/contracts', optionalAuth, async (req, res) => {
  try {
    const { status, vendor_id, limit = 50 } = req.query;
    const contractsCollection = getCollection('energy_contracts');
    
    const query = {};
    if (status) query.status = status;
    if (vendor_id) query.vendor_id = vendor_id;
    
    // If vendor is authenticated, show their contracts
    if (req.user && req.user.role === 'vendor') {
      query.vendor_id = req.user.email;
    } else {
      // For operators, only show open contracts
      query.status = query.status || 'open';
    }
    
    const contracts = await contractsCollection.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    // Get bid counts for each contract
    const bidsCollection = getCollection('contract_bids');
    for (const contract of contracts) {
      const bidCount = await bidsCollection.countDocuments({ 
        contract_id: contract.contract_id,
        status: { $in: ['pending', 'accepted'] }
      });
      contract.bid_count = bidCount;
    }
    
    res.json({ success: true, count: contracts.length, data: contracts });
  } catch (error) {
    logger.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// POST /api/marketplace/contracts - Create energy contract (vendor auth required)
router.post('/contracts', authenticateSimpleToken, async (req, res) => {
  try {
    const { 
      title, 
      description,
      required_capacity_mw, 
      max_price_per_mw, 
      duration_minutes,
      start_time,
      contract_type = 'energy_supply'
    } = req.body;
    
    if (!required_capacity_mw || !max_price_per_mw) {
      return res.status(400).json({ 
        error: 'required_capacity_mw and max_price_per_mw are required' 
      });
    }
    
    // Only vendors can create contracts
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Only vendors can create energy contracts' });
    }
    
    const contractsCollection = getCollection('energy_contracts');
    const contractId = `CNT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const contract = {
      contract_id: contractId,
      title: title || `Energy Contract ${contractId}`,
      description: description || '',
      required_capacity_mw: parseFloat(required_capacity_mw),
      max_price_per_mw: parseFloat(max_price_per_mw),
      duration_minutes: parseInt(duration_minutes) || 60,
      start_time: start_time ? new Date(start_time) : new Date(),
      contract_type,
      status: 'open', // open, closed, awarded, cancelled
      vendor_id: req.user.email,
      vendor_name: req.user.name,
      created_at: new Date(),
      updated_at: new Date(),
      awarded_to: null,
      awarded_bid_id: null
    };
    
    await contractsCollection.insertOne(contract);
    
    logger.info(`Energy contract created by vendor ${req.user.email}: ${contractId}`);
    
    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    logger.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// PUT /api/marketplace/contracts/:contractId - Update contract (vendor auth required, own contracts only)
router.put('/contracts/:contractId', authenticateSimpleToken, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { title, description, required_capacity_mw, max_price_per_mw, duration_minutes, status } = req.body;
    
    const contractsCollection = getCollection('energy_contracts');
    const contract = await contractsCollection.findOne({ contract_id: contractId });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check ownership
    if (req.user.role === 'vendor' && contract.vendor_id !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to update this contract' });
    }
    
    // Only allow status updates if contract is already awarded
    if (contract.status === 'awarded' && status !== 'awarded') {
      return res.status(400).json({ error: 'Cannot modify awarded contract' });
    }
    
    const update = { updated_at: new Date() };
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (required_capacity_mw !== undefined) update.required_capacity_mw = parseFloat(required_capacity_mw);
    if (max_price_per_mw !== undefined) update.max_price_per_mw = parseFloat(max_price_per_mw);
    if (duration_minutes !== undefined) update.duration_minutes = parseInt(duration_minutes);
    if (status && ['open', 'closed', 'awarded', 'cancelled'].includes(status)) {
      update.status = status;
    }
    
    await contractsCollection.updateOne(
      { contract_id: contractId },
      { $set: update }
    );
    
    const updatedContract = await contractsCollection.findOne({ contract_id: contractId });
    
    logger.info(`Contract updated: ${contractId}`);
    
    res.json({ success: true, data: updatedContract });
  } catch (error) {
    logger.error('Error updating contract:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// DELETE /api/marketplace/contracts/:contractId - Delete contract (vendor auth required, own contracts only)
router.delete('/contracts/:contractId', authenticateSimpleToken, async (req, res) => {
  try {
    const { contractId } = req.params;
    
    const contractsCollection = getCollection('energy_contracts');
    const contract = await contractsCollection.findOne({ contract_id: contractId });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check ownership
    if (req.user.role === 'vendor' && contract.vendor_id !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this contract' });
    }
    
    // Only allow deletion if contract is open or cancelled
    if (contract.status === 'awarded' || contract.status === 'closed') {
      return res.status(400).json({ error: 'Cannot delete awarded or closed contract' });
    }
    
    await contractsCollection.deleteOne({ contract_id: contractId });
    
    logger.info(`Contract deleted: ${contractId}`);
    
    res.json({ success: true, message: 'Contract deleted successfully' });
  } catch (error) {
    logger.error('Error deleting contract:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

// ============================================================================
// CONTRACT BIDS (placed by data center operators on contracts)
// ============================================================================

// GET /api/marketplace/contracts/:contractId/bids - Get bids for a contract
router.get('/contracts/:contractId/bids', optionalAuth, async (req, res) => {
  try {
    const { contractId } = req.params;
    const bidsCollection = getCollection('contract_bids');
    
    const bids = await bidsCollection.find({ contract_id: contractId })
      .sort({ price_per_mw: 1, created_at: -1 }) // Sort by price (lowest first)
      .toArray();
    
    res.json({ success: true, count: bids.length, data: bids });
  } catch (error) {
    logger.error('Error fetching contract bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// POST /api/marketplace/contracts/:contractId/bids - Place bid on contract (operator auth optional)
router.post('/contracts/:contractId/bids', optionalAuth, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { capacity_mw, price_per_mw, operator_email, node_id } = req.body;
    
    if (!capacity_mw || !price_per_mw) {
      return res.status(400).json({ 
        error: 'capacity_mw and price_per_mw are required' 
      });
    }
    
    // Check if contract exists and is open
    const contractsCollection = getCollection('energy_contracts');
    const contract = await contractsCollection.findOne({ contract_id: contractId });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    if (contract.status !== 'open') {
      return res.status(400).json({ error: 'Contract is not open for bidding' });
    }
    
    // Validate bid price
    if (parseFloat(price_per_mw) > contract.max_price_per_mw) {
      return res.status(400).json({ 
        error: `Bid price (₹${price_per_mw}/MW) exceeds maximum allowed (₹${contract.max_price_per_mw}/MW)` 
      });
    }
    
    // Validate capacity
    if (parseFloat(capacity_mw) > contract.required_capacity_mw) {
      return res.status(400).json({ 
        error: `Bid capacity (${capacity_mw} MW) exceeds required capacity (${contract.required_capacity_mw} MW)` 
      });
    }
    
    const bidsCollection = getCollection('contract_bids');
    const bidId = `BID-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const bid = {
      bid_id: bidId,
      contract_id: contractId,
      capacity_mw: parseFloat(capacity_mw),
      price_per_mw: parseFloat(price_per_mw),
      operator_email: operator_email || req.user?.email || 'amansharma12607@gmail.com',
      node_id: node_id || null,
      status: 'pending', // pending, accepted, rejected, withdrawn
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await bidsCollection.insertOne(bid);
    
    logger.info(`Bid placed on contract ${contractId} by ${bid.operator_email}: ${bidId}`);
    
    res.status(201).json({ success: true, data: bid });
  } catch (error) {
    logger.error('Error placing bid:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// PUT /api/marketplace/bids/:bidId/accept - Accept a bid (vendor auth required)
router.put('/bids/:bidId/accept', authenticateSimpleToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    
    const bidsCollection = getCollection('contract_bids');
    const contractsCollection = getCollection('energy_contracts');
    const transactionsCollection = getCollection('transactions');
    
    const bid = await bidsCollection.findOne({ bid_id: bidId });
    
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    const contract = await contractsCollection.findOne({ contract_id: bid.contract_id });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check ownership
    if (req.user.role === 'vendor' && contract.vendor_id !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to accept bids on this contract' });
    }
    
    if (contract.status !== 'open') {
      return res.status(400).json({ error: 'Contract is not open for accepting bids' });
    }
    
    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Bid is not pending' });
    }
    
    // Accept the bid
    await bidsCollection.updateOne(
      { bid_id: bidId },
      { $set: { status: 'accepted', updated_at: new Date() } }
    );
    
    // Reject all other bids on this contract
    await bidsCollection.updateMany(
      { 
        contract_id: bid.contract_id,
        bid_id: { $ne: bidId },
        status: 'pending'
      },
      { $set: { status: 'rejected', updated_at: new Date() } }
    );
    
    // Close the contract
    await contractsCollection.updateOne(
      { contract_id: bid.contract_id },
      { 
        $set: { 
          status: 'awarded',
          awarded_to: bid.operator_email,
          awarded_bid_id: bidId,
          updated_at: new Date()
        }
      }
    );
    
    // Create transaction
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const transaction = {
      transaction_id: transactionId,
      contract_id: bid.contract_id,
      bid_id: bidId,
      vendor_id: contract.vendor_id,
      vendor_name: contract.vendor_name,
      operator_email: bid.operator_email,
      node_id: bid.node_id,
      capacity_mw: bid.capacity_mw,
      price_per_mw: bid.price_per_mw,
      duration_minutes: contract.duration_minutes,
      total_amount: bid.capacity_mw * bid.price_per_mw * (contract.duration_minutes / 60),
      status: 'pending',
      created_at: new Date(),
      started_at: null,
      completed_at: null,
      updated_at: new Date()
    };
    
    await transactionsCollection.insertOne(transaction);
    
    logger.info(`Bid ${bidId} accepted, transaction ${transactionId} created`);
    
    res.json({ 
      success: true, 
      message: 'Bid accepted and transaction created',
      data: {
        bid,
        transaction
      }
    });
  } catch (error) {
    logger.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
});

// GET /api/marketplace/bids - Get all bids (for operators to see their bids)
router.get('/bids', optionalAuth, async (req, res) => {
  try {
    const { operator_email, status, limit = 50 } = req.query;
    const bidsCollection = getCollection('contract_bids');
    
    const query = {};
    if (operator_email) {
      query.operator_email = operator_email;
    } else if (req.user && req.user.role !== 'vendor') {
      // If operator is logged in, show their bids
      query.operator_email = req.user.email || 'amansharma12607@gmail.com';
    }
    if (status) query.status = status;
    
    const bids = await bidsCollection.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    // Enrich with contract info
    const contractsCollection = getCollection('energy_contracts');
    for (const bid of bids) {
      const contract = await contractsCollection.findOne({ contract_id: bid.contract_id });
      bid.contract = contract;
    }
    
    res.json({ success: true, count: bids.length, data: bids });
  } catch (error) {
    logger.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// ============================================================================
// TRANSACTIONS
// ============================================================================

// GET /api/marketplace/transactions - Get all transactions
router.get('/transactions', optionalAuth, async (req, res) => {
  try {
    const { status, vendor_id, operator_email, limit = 50 } = req.query;
    const transactionsCollection = getCollection('transactions');
    
    const query = {};
    if (status) query.status = status;
    if (vendor_id) query.vendor_id = vendor_id;
    if (operator_email) query.operator_email = operator_email;
    
    // If vendor is authenticated, show their transactions
    if (req.user && req.user.role === 'vendor') {
      query.vendor_id = req.user.email;
    } else if (req.user && req.user.role !== 'vendor') {
      // If operator is authenticated, show their transactions
      query.operator_email = req.user.email || 'amansharma12607@gmail.com';
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

// ============================================================================
// VENDORS & OTHER ENDPOINTS
// ============================================================================

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
