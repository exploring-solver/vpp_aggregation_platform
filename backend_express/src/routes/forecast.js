import express from 'express';
import forecastEngine from '../services/forecasting/forecastEngine.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/forecast/load - Get load forecast
router.get('/load', async (req, res) => {
  try {
    const { horizon_hours } = req.query;
    const horizon = horizon_hours ? parseInt(horizon_hours) : null;
    
    const forecast = await forecastEngine.generateLoadForecast(horizon);
    res.json({ success: true, data: forecast });
  } catch (error) {
    logger.error('Error generating load forecast:', error);
    res.status(500).json({ error: 'Failed to generate load forecast' });
  }
});

// GET /api/forecast/grid-stress - Get grid stress forecast
router.get('/grid-stress', async (req, res) => {
  try {
    const { horizon_hours } = req.query;
    const horizon = horizon_hours ? parseInt(horizon_hours) : null;
    
    const forecast = await forecastEngine.generateGridStressForecast(horizon);
    res.json({ success: true, data: forecast });
  } catch (error) {
    logger.error('Error generating grid stress forecast:', error);
    res.status(500).json({ error: 'Failed to generate grid stress forecast' });
  }
});

export default router;

