import express from 'express';
import { handleTelemetryData, getLatestTelemetry, getTelemetryInRange } from '../services/telemetryHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/telemetry - Receive telemetry from edge nodes
router.post('/', async (req, res) => {
  try {
    const telemetry = req.body;
    
    if (!telemetry.dc_id) {
      return res.status(400).json({ error: 'dc_id is required' });
    }
    
    const result = await handleTelemetryData(telemetry);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error processing telemetry:', error);
    res.status(500).json({ error: 'Failed to process telemetry' });
  }
});

// GET /api/telemetry - Get latest telemetry
router.get('/', async (req, res) => {
  try {
    const { dc_id, limit = 100 } = req.query;
    const data = await getLatestTelemetry(dc_id, parseInt(limit));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Error fetching telemetry:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});

// GET /api/telemetry/range - Get telemetry in time range
router.get('/range', async (req, res) => {
  try {
    const { dc_id, start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end timestamps are required' });
    }
    
    const data = await getTelemetryInRange(dc_id, start, end);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Error fetching telemetry range:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});

export default router;
