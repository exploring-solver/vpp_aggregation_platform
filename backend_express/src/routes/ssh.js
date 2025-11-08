import express from 'express';
import sshManager from '../services/ssh/sshManager.js';
import { getCollection } from '../services/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/ssh/:dcId/test - Test SSH connection
router.post('/:dcId/test', async (req, res) => {
  try {
    const { dcId } = req.params;
    const result = await sshManager.testConnection(dcId);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error(`Error testing SSH connection to ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to test SSH connection' });
  }
});

// POST /api/ssh/:dcId/command - Execute command on edge machine
router.post('/:dcId/command', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { command, cwd, pty } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }
    
    const result = await sshManager.executeCommand(dcId, command, { cwd, pty });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error executing SSH command on ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to execute command' });
  }
});

// POST /api/ssh/:dcId/commands - Execute multiple commands
router.post('/:dcId/commands', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { commands, cwd, stopOnError } = req.body;
    
    if (!commands || !Array.isArray(commands)) {
      return res.status(400).json({ error: 'commands array is required' });
    }
    
    const results = await sshManager.executeCommands(dcId, commands, { cwd, stopOnError });
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`Error executing SSH commands on ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to execute commands' });
  }
});

// GET /api/ssh/:dcId/system-info - Get system information
router.get('/:dcId/system-info', async (req, res) => {
  try {
    const { dcId } = req.params;
    const info = await sshManager.getSystemInfo(dcId);
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error(`Error getting system info from ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get system info' });
  }
});

// GET /api/ssh/:dcId/edge-info - Get edge node specific information
router.get('/:dcId/edge-info', async (req, res) => {
  try {
    const { dcId } = req.params;
    const info = await sshManager.getEdgeNodeInfo(dcId);
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error(`Error getting edge info from ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get edge info' });
  }
});

// GET /api/ssh/:dcId/files - List files in directory
router.get('/:dcId/files', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { path } = req.query;
    const result = await sshManager.listFiles(dcId, path);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error listing files on ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
});

// POST /api/ssh/:dcId/upload - Upload file to edge machine
router.post('/:dcId/upload', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { localPath, remotePath } = req.body;
    
    if (!localPath || !remotePath) {
      return res.status(400).json({ error: 'localPath and remotePath are required' });
    }
    
    const result = await sshManager.uploadFile(dcId, localPath, remotePath);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error uploading file to ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// POST /api/ssh/:dcId/download - Download file from edge machine
router.post('/:dcId/download', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { remotePath, localPath } = req.body;
    
    if (!remotePath || !localPath) {
      return res.status(400).json({ error: 'remotePath and localPath are required' });
    }
    
    const result = await sshManager.downloadFile(dcId, remotePath, localPath);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error downloading file from ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// POST /api/ssh/:dcId/close - Close SSH connection
router.post('/:dcId/close', async (req, res) => {
  try {
    const { dcId } = req.params;
    await sshManager.closeConnection(dcId);
    res.json({ success: true, message: 'SSH connection closed' });
  } catch (error) {
    logger.error(`Error closing SSH connection for ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to close connection' });
  }
});

// PUT /api/ssh/:dcId/config - Update SSH configuration for node
router.put('/:dcId/config', async (req, res) => {
  try {
    const { dcId } = req.params;
    const { ssh_config } = req.body;
    
    if (!ssh_config) {
      return res.status(400).json({ error: 'ssh_config is required' });
    }
    
    const nodesCollection = getCollection('nodes');
    const node = await nodesCollection.findOne({ dc_id: dcId });
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    // Encrypt sensitive fields
    const encryptedConfig = {
      host: ssh_config.host,
      port: ssh_config.port,
      username: ssh_config.username
    };
    
    // Handle password authentication
    if (ssh_config.password && ssh_config.password !== '••••••••') {
      encryptedConfig.password = sshManager.encryptPassword(ssh_config.password);
      encryptedConfig.password_encrypted = true;
    } else if (ssh_config.password === '••••••••') {
      // Keep existing encrypted password from database
      if (node.ssh_config && node.ssh_config.password) {
        encryptedConfig.password = node.ssh_config.password;
        encryptedConfig.password_encrypted = node.ssh_config.password_encrypted || true;
      }
    }
    
    // Handle private key authentication
    if (ssh_config.private_key && ssh_config.private_key.trim()) {
      const privateKeyContent = ssh_config.private_key.trim();
      
      // Optionally encrypt the private key (set ENCRYPT_SSH_KEYS=false to skip encryption)
      // Note: Encryption is recommended for production, but you can disable it for simplicity
      const shouldEncrypt = process.env.ENCRYPT_SSH_KEYS !== 'false';
      
      if (shouldEncrypt) {
        // Encrypt for secure storage
        encryptedConfig.private_key = sshManager.encryptPassword(privateKeyContent);
        encryptedConfig.private_key_encrypted = true;
      } else {
        // Store plain text (less secure but simpler - not recommended for production)
        encryptedConfig.private_key = privateKeyContent;
        encryptedConfig.private_key_encrypted = false;
        logger.warn(`⚠️  Storing SSH private key in plain text for ${dcId} (ENCRYPT_SSH_KEYS=false)`);
      }
      
      // Encrypt passphrase if provided
      if (ssh_config.passphrase && ssh_config.passphrase.trim()) {
        if (shouldEncrypt) {
          encryptedConfig.passphrase = sshManager.encryptPassword(ssh_config.passphrase.trim());
          encryptedConfig.passphrase_encrypted = true;
        } else {
          encryptedConfig.passphrase = ssh_config.passphrase.trim();
          encryptedConfig.passphrase_encrypted = false;
        }
      }
      
      // Clear password when using private key
      delete encryptedConfig.password;
      delete encryptedConfig.password_encrypted;
    } else if (ssh_config.usePrivateKey === false || !ssh_config.private_key) {
      // Clear private key when using password
      delete encryptedConfig.private_key;
      delete encryptedConfig.private_key_encrypted;
      delete encryptedConfig.passphrase;
      delete encryptedConfig.passphrase_encrypted;
    }
    
    // Ensure we have at least one authentication method
    if (!encryptedConfig.password && !encryptedConfig.private_key) {
      return res.status(400).json({ error: 'Either password or private key must be provided' });
    }
    
    const updateResult = await nodesCollection.updateOne(
      { dc_id: dcId },
      { $set: { ssh_config: encryptedConfig, updated_at: new Date() } }
    );
    
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    if (updateResult.modifiedCount === 0) {
      logger.warn(`SSH config update for ${dcId} resulted in no changes`);
    }
    
    // Close existing connection if any
    await sshManager.closeConnection(dcId);
    
    // Verify the config was saved
    const updatedNode = await nodesCollection.findOne({ dc_id: dcId });
    if (!updatedNode || !updatedNode.ssh_config) {
      logger.error(`SSH config was not saved for ${dcId}. Node exists: ${!!updatedNode}`);
      return res.status(500).json({ error: 'Failed to save SSH configuration. Please try again.' });
    }
    
    logger.info(`SSH configuration updated for ${dcId}: host=${encryptedConfig.host}, username=${encryptedConfig.username}, has_key=${!!encryptedConfig.private_key}, has_password=${!!encryptedConfig.password}`);
    res.json({ 
      success: true, 
      message: 'SSH configuration updated',
      data: {
        host: encryptedConfig.host,
        port: encryptedConfig.port,
        username: encryptedConfig.username,
        has_private_key: !!encryptedConfig.private_key,
        has_password: !!encryptedConfig.password
      }
    });
  } catch (error) {
    logger.error(`Error updating SSH config for ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to update SSH config' });
  }
});

// GET /api/ssh/:dcId/config - Get SSH configuration (without sensitive data)
router.get('/:dcId/config', async (req, res) => {
  try {
    const { dcId } = req.params;
    const nodesCollection = getCollection('nodes');
    const node = await nodesCollection.findOne({ dc_id: dcId });
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    if (!node.ssh_config) {
      return res.json({ success: true, data: null, message: 'No SSH configuration found' });
    }
    
    // Return config without sensitive data
    const safeConfig = {
      host: node.ssh_config.host,
      port: node.ssh_config.port,
      username: node.ssh_config.username,
      has_password: !!node.ssh_config.password,
      has_private_key: !!node.ssh_config.private_key,
      password_encrypted: node.ssh_config.password_encrypted || false
    };
    
    res.json({ success: true, data: safeConfig });
  } catch (error) {
    logger.error(`Error getting SSH config for ${dcId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get SSH config' });
  }
});

export default router;

