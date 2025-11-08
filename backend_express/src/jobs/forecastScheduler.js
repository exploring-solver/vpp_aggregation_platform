import cron from 'node-cron';
import forecastEngine from '../services/forecasting/forecastEngine.js';
import logger from '../utils/logger.js';

/**
 * Forecast Scheduler
 * Periodically updates forecasts
 */
export class ForecastScheduler {
  constructor() {
    this.updateInterval = process.env.FORECAST_UPDATE_INTERVAL || 300; // 5 minutes
    this.job = null;
  }

  /**
   * Start forecast scheduler
   */
  start() {
    // Run every N minutes (default 5 minutes)
    const minutes = Math.max(1, Math.floor(this.updateInterval / 60));
    const cronExpression = `*/${minutes} * * * *`;
    
    this.job = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running scheduled forecast update...');
        
        // Generate load forecast
        await forecastEngine.generateLoadForecast();
        
        // Generate grid stress forecast
        await forecastEngine.generateGridStressForecast();
        
        logger.info('Scheduled forecast update completed');
      } catch (error) {
        logger.error('Error in scheduled forecast update:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    logger.info(`Forecast scheduler started (interval: ${this.updateInterval}s)`);
  }

  /**
   * Stop forecast scheduler
   */
  stop() {
    if (this.job) {
      this.job.stop();
      logger.info('Forecast scheduler stopped');
    }
  }
}

export default new ForecastScheduler();

