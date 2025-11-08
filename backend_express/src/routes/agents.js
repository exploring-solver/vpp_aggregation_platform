import express from 'express';
import multiAgentSystem from '../services/agents/multiAgentSystem.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/agents/status - Get agent system status
router.get('/status', async (req, res) => {
  try {
    const status = await multiAgentSystem.getAgentStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error getting agent status:', error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// POST /api/agents/execute - Execute agent coordination cycle
router.post('/execute', async (req, res) => {
  try {
    const result = await multiAgentSystem.executeCycle();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error executing agent cycle:', error);
    res.status(500).json({ error: 'Failed to execute agent cycle' });
  }
});

// GET /api/agents/recommendations - Get agent recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const status = await multiAgentSystem.getAgentStatus();
    res.json({
      success: true,
      data: {
        recommendedAction: status.agents.optimization.recommendedAction,
        expectedRevenue: status.agents.optimization.expectedRevenue,
        confidence: status.agents.optimization.confidence,
        loadForecast: status.agents.forecast.loadForecast,
        gridStress: status.agents.forecast.gridStress,
        systemHealth: status.agents.monitoring.status,
        availableReserve: status.agents.monitoring.availableReserve
      }
    });
  } catch (error) {
    logger.error('Error getting agent recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

export default router;

