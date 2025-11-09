import mqtt from 'mqtt';
import logger from '../utils/logger.js';
import { handleTelemetryData } from './telemetryHandler.js';

let mqttClient = null;

export async function initMQTT() {
  return new Promise((resolve, reject) => {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    
    const options = {
      clientId: `aggregator_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      connectTimeout: 4000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      reconnectPeriod: 1000,
    };

    mqttClient = mqtt.connect(brokerUrl, options);

    mqttClient.on('connect', () => {
      logger.info('MQTT connected to broker');
      
      // Subscribe to telemetry from all edge nodes
      mqttClient.subscribe('edge/+/telemetry', (err) => {
        if (err) {
          logger.error('MQTT subscription error:', err);
        } else {
          logger.info('Subscribed to edge/+/telemetry');
        }
      });

      // Subscribe to status messages
      mqttClient.subscribe('edge/+/status', (err) => {
        if (!err) {
          logger.info('Subscribed to edge/+/status');
        }
      });

      resolve(mqttClient);
    });

    mqttClient.on('error', (error) => {
      logger.error('MQTT error:', error);
      reject(error);
    });

    mqttClient.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const nodeId = topic.split('/')[1];

        if (topic.includes('/telemetry')) {
          // Handle telemetry data - this will publish to Redis
          await handleTelemetryData({ ...data, dc_id: nodeId });
          logger.info(`✓ Telemetry received via MQTT from node ${nodeId} and processed`);
        } else if (topic.includes('/status')) {
          logger.debug(`Status update from node ${nodeId}:`, data);
        }
      } catch (error) {
        logger.error(`Error processing MQTT message from ${topic}:`, error);
      }
    });

    mqttClient.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });

    mqttClient.on('close', () => {
      logger.warn('MQTT connection closed');
    });
  });
}

export function getMQTTClient() {
  if (!mqttClient) {
    throw new Error('MQTT not initialized. Call initMQTT first.');
  }
  return mqttClient;
}

export async function publishToNode(dcId, action, params = {}) {
  const client = getMQTTClient();
  const topic = `edge/${dcId}/control`;
  const message = JSON.stringify({ action, params, timestamp: new Date().toISOString() });
  
  return new Promise((resolve, reject) => {
    client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`Failed to publish to ${topic}:`, err);
        reject(err);
      } else {
        logger.info(`Published control command to ${topic}`);
        resolve();
      }
    });
  });
}
