import express from 'express';
import { getCollection } from '../services/database.js';
import { cacheGet } from '../services/redis.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/nodes - List all nodes
router.get('/', async (req, res) => {
  try {
    const collection = getCollection('nodes');
    const nodes = await collection.find({}).toArray();
    
    // Enrich with latest state from cache
    const enrichedNodes = await Promise.all(
      nodes.map(async (node) => {
        const lastState = await cacheGet(`node:${node.dc_id}:last_state`);
        return {
          ...node,
          last_state: lastState,
          online: lastState ? true : false
        };
      })
    );
    
    res.json({ success: true, count: enrichedNodes.length, data: enrichedNodes });
  } catch (error) {
    logger.error('Error fetching nodes:', error);
    res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

// GET /api/nodes/:dc_id - Get specific node
router.get('/:dc_id', async (req, res) => {
  try {
    const { dc_id } = req.params;
    const collection = getCollection('nodes');
    const node = await collection.findOne({ dc_id });
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    const lastState = await cacheGet(`node:${dc_id}:last_state`);
    
    res.json({
      success: true,
      data: {
        ...node,
        last_state: lastState,
        online: lastState ? true : false
      }
    });
  } catch (error) {
    logger.error('Error fetching node:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// POST /api/nodes - Register new node (public)
router.post('/', async (req, res) => {
  try {
    const nodeData = req.body;
    
    if (!nodeData.dc_id) {
      return res.status(400).json({ error: 'dc_id is required' });
    }
    
    const collection = getCollection('nodes');
    
    // Check if node already exists
    const existing = await collection.findOne({ dc_id: nodeData.dc_id });
    if (existing) {
      return res.status(409).json({ error: 'Node already exists' });
    }
    
    const node = {
      ...nodeData,
      created_at: new Date()
    };
    
    await collection.insertOne(node);
    
    res.status(201).json({ success: true, data: node });
  } catch (error) {
    logger.error('Error creating node:', error);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// PUT /api/nodes/:dc_id - Update node (public)
router.put('/:dc_id', async (req, res) => {
  try {
    const { dc_id } = req.params;
    const updates = req.body;
    
    // Remove immutable fields
    delete updates.dc_id;
    delete updates.created_at;
    
    const collection = getCollection('nodes');
    const result = await collection.updateOne(
      { dc_id },
      { $set: { ...updates, updated_at: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json({ success: true, message: 'Node updated' });
  } catch (error) {
    logger.error('Error updating node:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// DELETE /api/nodes/:dc_id - Delete node (public)
router.delete('/:dc_id', async (req, res) => {
  try {
    const { dc_id } = req.params;
    const collection = getCollection('nodes');
    const result = await collection.deleteOne({ dc_id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json({ success: true, message: 'Node deleted' });
  } catch (error) {
    logger.error('Error deleting node:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

export default router;
