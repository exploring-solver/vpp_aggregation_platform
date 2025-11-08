import multiAgentSystem from '../services/agents/multiAgentSystem.js';
import logger from '../utils/logger.js';

/**
 * Agent Scheduler
 * Runs multi-agent coordination cycles at regular intervals
 */
class AgentScheduler {
  constructor() {
    this.intervalId = null;
    this.intervalSeconds = parseInt(process.env.AGENT_INTERVAL_SECONDS || 30); // Default 30 seconds
  }

  start() {
    if (this.intervalId) {
      logger.warn('Agent scheduler already running');
      return;
    }

    // Run every N seconds using setInterval
    this.intervalId = setInterval(async () => {
      try {
        logger.debug('Running scheduled agent coordination cycle');
        await multiAgentSystem.executeCycle();
      } catch (error) {
        logger.error('Error in scheduled agent cycle:', error);
      }
    }, this.intervalSeconds * 1000);

    logger.info(`Agent scheduler started (interval: ${this.intervalSeconds}s)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Agent scheduler stopped');
    }
  }
}

export default new AgentScheduler();

