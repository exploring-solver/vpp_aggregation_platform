import logger from '../../utils/logger.js';
import { cacheGet, cacheSet, publishMessage } from '../redis.js';

/**
 * Base Agent Class
 * All agents inherit from this base class
 */
export class BaseAgent {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      updateInterval: config.updateInterval || 30, // seconds
      enabled: config.enabled !== false,
      ...config
    };
    this.lastRun = null;
    this.runCount = 0;
    this.status = 'idle'; // idle, running, error
    this.lastResult = null;
  }

  /**
   * Main execution method - to be implemented by subclasses
   */
  async execute(context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Run the agent
   */
  async run(context = {}) {
    if (!this.config.enabled) {
      return { success: false, reason: 'Agent disabled' };
    }

    this.status = 'running';
    this.lastRun = new Date();
    
    try {
      const result = await this.execute(context);
      this.lastResult = result;
      this.runCount++;
      this.status = 'idle';
      
      // Publish agent update
      await publishMessage(`agent:${this.name}:update`, {
        agent: this.name,
        timestamp: this.lastRun.toISOString(),
        status: this.status,
        result: result
      });
      
      logger.info(`Agent ${this.name} executed successfully`);
      return result;
    } catch (error) {
      this.status = 'error';
      logger.error(`Agent ${this.name} error:`, error);
      throw error;
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      status: this.status,
      lastRun: this.lastRun,
      runCount: this.runCount,
      enabled: this.config.enabled,
      lastResult: this.lastResult
    };
  }

  /**
   * Cache helper
   */
  async getCached(key, ttl = 60) {
    return await cacheGet(key);
  }

  async setCached(key, value, ttl = 60) {
    return await cacheSet(key, value, ttl);
  }
}

