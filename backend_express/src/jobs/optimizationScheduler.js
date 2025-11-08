import cron from 'node-cron';
import rlOptimizer from '../services/optimization/rlOptimizer.js';
import dispatchOptimizer from '../services/optimization/dispatchOptimizer.js';
import logger from '../utils/logger.js';

/**
 * Optimization Scheduler
 * Periodically runs RL optimization and auto-dispatches if enabled
 */
export class OptimizationScheduler {
  constructor() {
    this.updateInterval = process.env.RL_UPDATE_INTERVAL || 60; // 1 minute
    this.autoDispatchEnabled = process.env.AUTO_DISPATCH_ENABLED === 'true';
    this.job = null;
  }

  /**
   * Start optimization scheduler
   */
  start() {
    // Run every N minutes (default 1 minute)
    const minutes = Math.max(1, Math.floor(this.updateInterval / 60));
    const cronExpression = `*/${minutes} * * * *`;
    
    this.job = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running scheduled RL optimization...');
        
        // Get optimization recommendation
        const recommendation = await rlOptimizer.getOptimalAction();
        
        // Auto-dispatch if enabled and action is not 'hold'
        if (this.autoDispatchEnabled && recommendation.recommended_action !== 'hold') {
          logger.info(`Auto-dispatching: ${recommendation.recommended_action}`);
          const result = await dispatchOptimizer.optimizeAndDispatch(true);
          logger.info(`Auto-dispatch completed: ${result.execution?.success || 0} commands executed`);
        }
        
        logger.info('Scheduled optimization completed');
      } catch (error) {
        logger.error('Error in scheduled optimization:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    logger.info(`Optimization scheduler started (interval: ${this.updateInterval}s, auto-dispatch: ${this.autoDispatchEnabled})`);
  }

  /**
   * Stop optimization scheduler
   */
  stop() {
    if (this.job) {
      this.job.stop();
      logger.info('Optimization scheduler stopped');
    }
  }
}

export default new OptimizationScheduler();

