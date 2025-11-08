import express from 'express';
import agentCoordinator from '../services/agents/AgentCoordinator.js';
import loadForecastAgent from '../services/agents/LoadForecastAgent.js';
import demandResponseAgent from '../services/agents/DemandResponseAgent.js';
import gridOptimizationAgent from '../services/agents/GridOptimizationAgent.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/agents/status - Get status of all agents
router.get('/status', async (req, res) => {
  try {
    const status = agentCoordinator.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error getting agent status:', error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// POST /api/agents/coordinate - Manually trigger agent coordination
router.post('/coordinate', async (req, res) => {
  try {
    const result = await agentCoordinator.coordinate();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error coordinating agents:', error);
    res.status(500).json({ error: 'Failed to coordinate agents' });
  }
});

// GET /api/agents/:agentName/status - Get status of specific agent
router.get('/:agentName/status', async (req, res) => {
  try {
    const { agentName } = req.params;
    const agents = {
      'LoadForecastAgent': loadForecastAgent,
      'DemandResponseAgent': demandResponseAgent,
      'GridOptimizationAgent': gridOptimizationAgent
    };
    
    const agent = agents[agentName];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const status = agent.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error(`Error getting agent ${req.params.agentName} status:`, error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// POST /api/agents/:agentName/run - Manually run a specific agent
router.post('/:agentName/run', async (req, res) => {
  try {
    const { agentName } = req.params;
    const agents = {
      'LoadForecastAgent': loadForecastAgent,
      'DemandResponseAgent': demandResponseAgent,
      'GridOptimizationAgent': gridOptimizationAgent
    };
    
    const agent = agents[agentName];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const context = await agentCoordinator.buildSharedContext();
    const result = await agent.run(context);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error running agent ${req.params.agentName}:`, error);
    res.status(500).json({ error: 'Failed to run agent' });
  }
});

// GET /api/agents/decisions - Get recent agent decisions
router.get('/decisions', async (req, res) => {
  try {
    const status = agentCoordinator.getStatus();
    res.json({ 
      success: true, 
      data: {
        recentDecisions: status.recentDecisions,
        lastCoordination: status.lastCoordination
      }
    });
  } catch (error) {
    logger.error('Error getting agent decisions:', error);
    res.status(500).json({ error: 'Failed to get agent decisions' });
  }
});

export default router;

