import express from 'express';
import rlOptimizer from '../services/optimization/rlOptimizer.js';
import dispatchOptimizer from '../services/optimization/dispatchOptimizer.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/optimization/recommendation - Get RL optimization recommendation (public)
router.get('/recommendation', async (req, res) => {
  try {
    const recommendation = await rlOptimizer.getOptimalAction();
    res.json({ success: true, data: recommendation });
  } catch (error) {
    logger.error('Error getting optimization recommendation:', error);
    res.status(500).json({ error: 'Failed to get optimization recommendation' });
  }
});

// POST /api/optimization/dispatch - Optimize and execute dispatch (public)
router.post('/dispatch', async (req, res) => {
  try {
    const { auto_execute = false } = req.body;
    const result = await dispatchOptimizer.optimizeAndDispatch(auto_execute === true);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error in dispatch optimization:', error);
    res.status(500).json({ error: 'Failed to optimize dispatch' });
  }
});

// GET /api/optimization/dispatch/plan - Get dispatch plan without executing (public read)
router.get('/dispatch/plan', async (req, res) => {
  try {
    const result = await dispatchOptimizer.optimizeAndDispatch(false);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error getting dispatch plan:', error);
    res.status(500).json({ error: 'Failed to get dispatch plan' });
  }
});

export default router;

