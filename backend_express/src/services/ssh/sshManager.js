import { NodeSSH } from 'node-ssh';
import { getCollection } from '../database.js';
import { cacheGet, cacheSet, cacheDel } from '../redis.js';
import logger from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * SSH Manager Service
 * Manages SSH connections to edge machines
 * Handles authentication, command execution, and file operations
 */
export class SSHManager {
  constructor() {
    this.connections = new Map(); // Active SSH connections cache
    this.connectionTimeout = 30000; // 30 seconds
    this.commandTimeout = 10000; // 10 seconds
  }

  /**
   * Get SSH credentials for a node
   */
  async getNodeSSHCredentials(dcId) {
    try {
      const nodesCollection = getCollection('nodes');
      const node = await nodesCollection.findOne({ dc_id: dcId });
      
      if (!node) {
        throw new Error(`Node ${dcId} not found`);
      }

      // Check if node has SSH configuration
      if (!node.ssh_config) {
        throw new Error(`Node ${dcId} does not have SSH configuration`);
      }

      const sshConfig = node.ssh_config;
      
      // Decrypt password if encrypted
      let password = sshConfig.password;
      if (sshConfig.password_encrypted && sshConfig.password) {
        password = this.decryptPassword(sshConfig.password);
      }

      // Build credentials object
      const credentials = {
        host: sshConfig.host || node.ssh_host || node.ip_address,
        port: sshConfig.port || 22,
        username: sshConfig.username || 'pi', // Default for Raspberry Pi
        readyTimeout: this.connectionTimeout
      };

      // Add authentication method
      if (sshConfig.private_key) {
        // Use private key authentication (PEM file)
        const privateKey = this.decryptPassword(sshConfig.private_key);
        credentials.privateKey = privateKey;
        
        // Add passphrase if provided
        if (sshConfig.passphrase) {
          credentials.passphrase = this.decryptPassword(sshConfig.passphrase);
        }
      } else if (password) {
        // Use password authentication
        credentials.password = password;
      } else {
        throw new Error('No authentication method provided (password or private key required)');
      }

      return credentials;
    } catch (error) {
      logger.error(`Error getting SSH credentials for ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create SSH connection
   */
  async getConnection(dcId) {
    try {
      // Check cache first
      const cacheKey = `ssh:connection:${dcId}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached && this.connections.has(dcId)) {
        const conn = this.connections.get(dcId);
        // Test if connection is still alive
        try {
          await conn.execCommand('echo "test"', { cwd: '/' });
          return conn;
        } catch (error) {
          // Connection is dead, remove it
          this.connections.delete(dcId);
          await cacheDel(cacheKey); // Remove from cache
        }
      }

      // Get credentials
      const credentials = await this.getNodeSSHCredentials(dcId);
      
      // Create new connection
      const ssh = new NodeSSH();
      
      try {
        await ssh.connect(credentials);
      } catch (error) {
        logger.error(`SSH connection failed for ${dcId}:`, error);
        throw new Error(`SSH connection failed: ${error.message}`);
      }
      
      // Cache connection
      this.connections.set(dcId, ssh);
      await cacheSet(cacheKey, { connected: true, timestamp: new Date() }, 300); // 5 minutes
      
      logger.info(`SSH connection established to ${dcId} (${credentials.host})`);
      
      return ssh;
    } catch (error) {
      logger.error(`Error establishing SSH connection to ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Execute command on edge machine
   */
  async executeCommand(dcId, command, options = {}) {
    try {
      const ssh = await this.getConnection(dcId);
      
      const execOptions = {
        cwd: options.cwd || '~',
        execOptions: {
          pty: options.pty !== false, // Enable PTY by default
        },
        ...options
      };

      const result = await ssh.execCommand(command, execOptions);
      
      logger.debug(`SSH command executed on ${dcId}: ${command}`);
      
      return {
        success: result.code === 0,
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        command: command,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error executing SSH command on ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Execute multiple commands sequentially
   */
  async executeCommands(dcId, commands, options = {}) {
    const results = [];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(dcId, command, options);
        results.push(result);
        
        // Stop on first failure if stopOnError is true
        if (options.stopOnError && !result.success) {
          break;
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          command: command
        });
        
        if (options.stopOnError) {
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Get system information from edge machine
   */
  async getSystemInfo(dcId) {
    try {
      const commands = {
        hostname: 'hostname',
        uptime: 'uptime',
        memory: 'free -h',
        disk: 'df -h',
        cpu: 'top -bn1 | grep "Cpu(s)"',
        os: 'cat /etc/os-release | grep PRETTY_NAME',
        python: 'python3 --version 2>&1 || python --version 2>&1',
        node: 'node --version 2>&1 || echo "Not installed"'
      };

      const results = {};
      
      for (const [key, command] of Object.entries(commands)) {
        try {
          const result = await this.executeCommand(dcId, command);
          results[key] = {
            success: result.success,
            output: result.stdout || result.stderr
          };
        } catch (error) {
          results[key] = {
            success: false,
            error: error.message
          };
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error getting system info from ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Get edge node specific information (BESS status, sensors, etc.)
   */
  async getEdgeNodeInfo(dcId) {
    try {
      const commands = {
        // Check if edge controller is running
        edge_controller: 'systemctl is-active edge-controller 2>&1 || ps aux | grep edge_controller | grep -v grep',
        // Check MQTT connection
        mqtt_status: 'mosquitto_pub -h localhost -t test -m test 2>&1 || echo "MQTT not available"',
        // Check sensor readings (if sensor script exists)
        sensors: 'python3 /opt/edge/sensors.py status 2>&1 || echo "Sensor script not found"',
        // Check BESS inverter status
        bess_status: 'cat /opt/edge/bess_status.json 2>&1 || echo "BESS status file not found"',
        // Check network interfaces
        network: 'ip addr show | grep -E "inet |state"',
        // Check disk usage
        disk_usage: 'df -h /',
        // Check running processes
        processes: 'ps aux | head -20'
      };

      const results = {};
      
      for (const [key, command] of Object.entries(commands)) {
        try {
          const result = await this.executeCommand(dcId, command, { timeout: 5000 });
          results[key] = {
            success: result.success,
            output: result.stdout || result.stderr
          };
        } catch (error) {
          results[key] = {
            success: false,
            error: error.message
          };
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error getting edge node info from ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Upload file to edge machine
   */
  async uploadFile(dcId, localPath, remotePath) {
    try {
      const ssh = await this.getConnection(dcId);
      await ssh.putFile(localPath, remotePath);
      
      logger.info(`File uploaded to ${dcId}: ${localPath} -> ${remotePath}`);
      
      return {
        success: true,
        localPath,
        remotePath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error uploading file to ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Download file from edge machine
   */
  async downloadFile(dcId, remotePath, localPath) {
    try {
      const ssh = await this.getConnection(dcId);
      await ssh.getFile(localPath, remotePath);
      
      logger.info(`File downloaded from ${dcId}: ${remotePath} -> ${localPath}`);
      
      return {
        success: true,
        remotePath,
        localPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error downloading file from ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * List files in directory
   */
  async listFiles(dcId, remotePath = '~') {
    try {
      const result = await this.executeCommand(dcId, `ls -lah ${remotePath}`);
      
      return {
        success: result.success,
        path: remotePath,
        files: result.stdout.split('\n').filter(line => line.trim()),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error listing files on ${dcId}:`, error);
      throw error;
    }
  }

  /**
   * Close SSH connection
   */
  async closeConnection(dcId) {
    try {
      if (this.connections.has(dcId)) {
        const ssh = this.connections.get(dcId);
        ssh.dispose();
        this.connections.delete(dcId);
        
        const cacheKey = `ssh:connection:${dcId}`;
        await cacheDel(cacheKey); // Remove from cache
        
        logger.info(`SSH connection closed for ${dcId}`);
      }
    } catch (error) {
      logger.error(`Error closing SSH connection for ${dcId}:`, error);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections() {
    for (const [dcId, ssh] of this.connections.entries()) {
      try {
        ssh.dispose();
      } catch (error) {
        logger.error(`Error closing connection for ${dcId}:`, error);
      }
    }
    this.connections.clear();
    logger.info('All SSH connections closed');
  }

  /**
   * Encrypt sensitive data (password, private key)
   * 
   * IMPORTANT: Set SSH_ENCRYPTION_KEY in .env file!
   * Generate a key by running: node scripts/generate-ssh-key.js
   * The key must be at least 32 characters long.
   */
  encryptPassword(text) {
    if (!text) return text;
    const algorithm = 'aes-256-cbc';
    const encryptionKey = process.env.SSH_ENCRYPTION_KEY || 'default-key-change-in-production-32chars!!';
    
    if (encryptionKey === 'default-key-change-in-production-32chars!!') {
      logger.warn('⚠️  Using default SSH encryption key! Set SSH_ENCRYPTION_KEY in .env for production!');
    }
    
    const key = Buffer.from(encryptionKey, 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decryptPassword(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText; // Not encrypted
    }
    
    try {
      const algorithm = 'aes-256-cbc';
      const encryptionKey = process.env.SSH_ENCRYPTION_KEY || 'default-key-change-in-production-32chars!!';
      const key = Buffer.from(encryptionKey, 'utf8');
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting password:', error);
      return encryptedText; // Return as-is if decryption fails
    }
  }

  /**
   * Test SSH connection
   */
  async testConnection(dcId) {
    try {
      const ssh = await this.getConnection(dcId);
      const result = await ssh.execCommand('echo "SSH connection test successful"');
      
      return {
        success: result.code === 0,
        message: result.stdout || result.stderr,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new SSHManager();

