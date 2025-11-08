import logger from '../utils/logger.js';
import agentCoordinator from '../services/agents/AgentCoordinator.js';

/**
 * Agent Scheduler
 * Runs agents autonomously at configured intervals
 */
class AgentScheduler {
  constructor() {
    this.interval = null;
    this.running = false;
    this.coordinationInterval = 30; // seconds
  }

  start() {
    if (this.running) {
      logger.warn('Agent scheduler already running');
      return;
    }

    this.running = true;
    logger.info(`Starting agent scheduler (coordination every ${this.coordinationInterval}s)`);
    
    // Run coordination immediately
    this.runCoordination();
    
    // Schedule periodic coordination
    this.interval = setInterval(() => {
      this.runCoordination();
    }, this.coordinationInterval * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
    logger.info('Agent scheduler stopped');
  }

  async runCoordination() {
    try {
      await agentCoordinator.coordinate();
    } catch (error) {
      logger.error('Error in agent coordination:', error);
    }
  }
}

export default new AgentScheduler();

