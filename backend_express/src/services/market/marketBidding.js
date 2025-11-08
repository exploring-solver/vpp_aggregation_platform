import { getCollection } from '../database.js';
import { cacheGet, cacheSet, publishMessage } from '../redis.js';
import logger from '../../utils/logger.js';
import dataAggregator from '../aggregation/dataAggregator.js';
import forecastEngine from '../forecasting/forecastEngine.js';
import axios from 'axios';

/**
 * Market Bidding Interface
 * REST API bridge to CERC/market simulation
 * Prepares bid packets with metadata, predicted capacity, and pricing
 */
export class MarketBidding {
  constructor() {
    this.marketApiUrl = process.env.MARKET_API_URL || 'https://api.cerc.gov.in';
    this.marketApiKey = process.env.MARKET_API_KEY;
    this.bidSubmissionEnabled = process.env.BID_SUBMISSION_ENABLED === 'true';
    this.minBidCapacityMw = parseFloat(process.env.MIN_BID_CAPACITY_MW || 1.0);
  }

  /**
   * Prepare and submit market bid
   */
  async prepareBid(serviceType, capacityMw, pricePerMw, durationMinutes = 15) {
    try {
      // Get current VPP state
      const vppState = await dataAggregator.getVirtualPlantState();
      
      // Get forecast for confidence
      const forecast = await forecastEngine.generateLoadForecast(6);
      
      // Build bid packet
      const bidPacket = this.buildBidPacket({
        serviceType,
        capacityMw,
        pricePerMw,
        durationMinutes,
        vppState,
        forecast
      });

      // Validate bid
      const validation = this.validateBid(bidPacket);
      if (!validation.valid) {
        throw new Error(`Bid validation failed: ${validation.reason}`);
      }

      // Store bid
      const bidCollection = getCollection('market_bids');
      const result = await bidCollection.insertOne({
        ...bidPacket,
        status: 'draft',
        created_at: new Date()
      });

      logger.info(`Market bid prepared: ${bidPacket.bid_id} for ${serviceType}`);

      // Submit bid if enabled
      if (this.bidSubmissionEnabled) {
        const submission = await this.submitBid(bidPacket);
        return {
          bid_id: bidPacket.bid_id,
          status: submission.status,
          submitted: true,
          submission_response: submission.response
        };
      }

      return {
        bid_id: bidPacket.bid_id,
        status: 'draft',
        submitted: false,
        message: 'Bid submission disabled - bid saved as draft'
      };
    } catch (error) {
      logger.error('Error preparing market bid:', error);
      throw error;
    }
  }

  /**
   * Build bid packet
   */
  buildBidPacket({ serviceType, capacityMw, pricePerMw, durationMinutes, vppState, forecast }) {
    const bidId = `BID-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Calculate response time (simulated based on VPP state)
    const avgResponseTime = this.calculateResponseTime(vppState);
    
    // Get node IDs
    const nodeIds = vppState.nodes.map(n => n.dc_id);
    
    // Calculate confidence based on forecast and VPP state
    const confidence = this.calculateBidConfidence(vppState, forecast);

    return {
      bid_id: bidId,
      service_type: serviceType,
      capacity_mw: capacityMw,
      price_per_mw: pricePerMw,
      duration_minutes: durationMinutes,
      response_time_ms: avgResponseTime,
      metadata: {
        predicted_capacity: capacityMw,
        confidence: confidence,
        node_ids: nodeIds,
        total_vpp_capacity_mw: vppState.total_capacity_mw,
        available_reserve_mw: vppState.available_reserve_mw,
        avg_soc: vppState.avg_soc,
        avg_frequency: vppState.avg_frequency,
        forecast_confidence: forecast.confidence
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate bid packet
   */
  validateBid(bidPacket) {
    // Check minimum capacity
    if (bidPacket.capacity_mw < this.minBidCapacityMw) {
      return {
        valid: false,
        reason: `Bid capacity (${bidPacket.capacity_mw} MW) below minimum (${this.minBidCapacityMw} MW)`
      };
    }

    // Check service type
    const validServiceTypes = ['SRAS', 'TRAS', 'DR'];
    if (!validServiceTypes.includes(bidPacket.service_type)) {
      return {
        valid: false,
        reason: `Invalid service type: ${bidPacket.service_type}`
      };
    }

    // Check price
    if (bidPacket.price_per_mw <= 0) {
      return {
        valid: false,
        reason: 'Price per MW must be positive'
      };
    }

    // Check duration
    if (bidPacket.duration_minutes <= 0) {
      return {
        valid: false,
        reason: 'Duration must be positive'
      };
    }

    return { valid: true };
  }

  /**
   * Submit bid to market API
   */
  async submitBid(bidPacket) {
    try {
      if (!this.marketApiKey) {
        logger.warn('Market API key not configured - bid not submitted');
        return {
          status: 'error',
          response: { error: 'Market API key not configured' }
        };
      }

      // Prepare API payload
      const payload = {
        serviceType: bidPacket.service_type,
        capacity: bidPacket.capacity_mw,
        price: bidPacket.price_per_mw,
        duration: bidPacket.duration_minutes,
        responseTime: bidPacket.response_time_ms,
        metadata: bidPacket.metadata
      };

      // Submit to market API
      const response = await axios.post(
        `${this.marketApiUrl}/api/bids`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.marketApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Update bid status
      const bidCollection = getCollection('market_bids');
      await bidCollection.updateOne(
        { bid_id: bidPacket.bid_id },
        {
          $set: {
            status: response.data.status || 'submitted',
            submitted_at: new Date(),
            submission_response: response.data
          }
        }
      );

      logger.info(`Bid ${bidPacket.bid_id} submitted successfully`);

      return {
        status: 'submitted',
        response: response.data
      };
    } catch (error) {
      logger.error(`Error submitting bid ${bidPacket.bid_id}:`, error);
      
      // Update bid status to failed
      const bidCollection = getCollection('market_bids');
      await bidCollection.updateOne(
        { bid_id: bidPacket.bid_id },
        {
          $set: {
            status: 'failed',
            error: error.message
          }
        }
      );

      return {
        status: 'error',
        response: { error: error.message }
      };
    }
  }

  /**
   * Calculate average response time based on VPP state
   */
  calculateResponseTime(vppState) {
    // Simulated response time based on:
    // - Number of nodes (more nodes = slightly longer)
    // - Average SOC (higher SOC = faster discharge response)
    // Base response time: 100ms
    const baseTime = 100;
    const nodeFactor = Math.min(vppState.node_count * 5, 50); // Max 50ms
    const socFactor = (100 - vppState.avg_soc) * 0.5; // Lower SOC = slower
    
    return Math.round(baseTime + nodeFactor + socFactor);
  }

  /**
   * Calculate bid confidence
   */
  calculateBidConfidence(vppState, forecast) {
    // Confidence factors:
    // 1. Forecast confidence (0-1)
    // 2. VPP state stability (0-1)
    // 3. Available reserve ratio (0-1)
    
    const forecastConf = forecast.confidence || 0.7;
    const stabilityConf = vppState.online_nodes / Math.max(vppState.node_count, 1);
    const reserveRatio = vppState.total_capacity_mw > 0 
      ? vppState.available_reserve_mw / vppState.total_capacity_mw 
      : 0;
    
    // Weighted average
    const confidence = (
      forecastConf * 0.4 +
      stabilityConf * 0.3 +
      Math.min(reserveRatio, 1) * 0.3
    );
    
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Get active bids
   */
  async getActiveBids() {
    try {
      const bidCollection = getCollection('market_bids');
      const bids = await bidCollection.find({
        status: { $in: ['draft', 'submitted', 'accepted'] }
      })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

      return bids;
    } catch (error) {
      logger.error('Error fetching active bids:', error);
      throw error;
    }
  }

  /**
   * Get bid status
   */
  async getBidStatus(bidId) {
    try {
      const bidCollection = getCollection('market_bids');
      const bid = await bidCollection.findOne({ bid_id: bidId });
      
      if (!bid) {
        throw new Error(`Bid ${bidId} not found`);
      }

      return bid;
    } catch (error) {
      logger.error(`Error fetching bid ${bidId}:`, error);
      throw error;
    }
  }
}

export default new MarketBidding();

