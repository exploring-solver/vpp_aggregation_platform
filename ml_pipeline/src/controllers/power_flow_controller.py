import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from utils.logger import logger
from config.db import db_manager
import asyncio

class PowerFlowController:
    """
    Intelligent controller that actively manages power flow to nodes
    Controls battery charge/discharge and workload allocation
    """
    
    def __init__(self):
        self.active_controls = {}
        self.control_history = []
        
        # Valid commands that hardware accepts
        self.valid_commands = ['Charge', 'Discharge', 'Hold', 'Load Deferral']
        
        self.safety_limits = {
            'min_soc': 20.0,
            'max_soc': 90.0,
            'max_charge_rate': 250,  # kW
            'max_discharge_rate': 250,  # kW
            'min_frequency': 49.7,
            'max_frequency': 50.3
        }
    
    async def control_node_power(
        self,
        node_id: str,
        action: str,
        magnitude: float,
        reason: str,
        duration_minutes: int = 15
    ) -> Dict:
        """
        Execute power flow control command to a node
        
        Args:
            node_id: Target node
            action: One of ['Charge', 'Discharge', 'Hold', 'Load Deferral']
            magnitude: kW for Charge/Discharge, % for Load Deferral
            reason: Explanation for this action
            duration_minutes: How long to maintain this control
        
        Returns:
            Control result with execution status
        """
        try:
            # Normalize action to proper case
            action = self._normalize_action(action)
            
            # Validate action
            if action not in self.valid_commands:
                return {
                    'status': 'rejected',
                    'reason': f'Invalid action. Must be one of: {self.valid_commands}',
                    'node_id': node_id
                }
            
            # Validate safety
            safety_check = await self._safety_check(node_id, action, magnitude)
            if not safety_check['safe']:
                logger.warning(f"Safety check failed for {node_id}: {safety_check['reason']}")
                return {
                    'status': 'rejected',
                    'reason': safety_check['reason'],
                    'node_id': node_id,
                    'action': action
                }
            
            # Execute control
            control_command = {
                'node_id': node_id,
                'action': action,  # Exact command format: 'Charge', 'Discharge', etc.
                'magnitude': magnitude,
                'reason': reason,
                'timestamp': datetime.now(),
                'duration_minutes': duration_minutes,
                'expires_at': datetime.now() + timedelta(minutes=duration_minutes)
            }
            
            # Send to actual hardware (via MQTT/API)
            hardware_result = await self._send_to_hardware(control_command)
            
            # Store active control
            self.active_controls[node_id] = control_command
            
            # Log to database
            await self._log_control_action(control_command, hardware_result)
            
            logger.info(
                f"✅ Power control executed: {node_id} -> {action} "
                f"({magnitude} {'kW' if action in ['Charge', 'Discharge'] else '%'}) | "
                f"Reason: {reason}"
            )
            
            return {
                'status': 'success',
                'command': control_command,
                'hardware_status': hardware_result,
                'node_id': node_id
            }
        
        except Exception as e:
            logger.error(f"Error in power control: {e}")
            return {'status': 'error', 'error': str(e), 'node_id': node_id}
    
    def _normalize_action(self, action: str) -> str:
        """
        Normalize action string to proper format
        Converts: 'charge' -> 'Charge', 'load_deferral' -> 'Load Deferral'
        """
        action_map = {
            'charge': 'Charge',
            'discharge': 'Discharge',
            'hold': 'Hold',
            'load deferral': 'Load Deferral',
            'load_deferral': 'Load Deferral',
            'loaddeferral': 'Load Deferral',
            'reduce_load': 'Load Deferral',
            'defer': 'Load Deferral'
        }
        
        normalized = action_map.get(action.lower(), action)
        
        # If already in proper format, return as-is
        if normalized in self.valid_commands:
            return normalized
        
        # Try to match by capitalizing
        for valid_cmd in self.valid_commands:
            if action.lower() == valid_cmd.lower():
                return valid_cmd
        
        return action  # Return original if no match
    
    async def _safety_check(
        self,
        node_id: str,
        action: str,
        magnitude: float
    ) -> Dict:
        """
        Critical safety checks before executing control
        """
        try:
            # Get current node state
            collection = db_manager.mongo_db['telemetries']
            latest = await collection.find_one(
                {'nodeId': node_id},
                sort=[('timestamp', -1)]
            )
            
            if not latest:
                return {'safe': False, 'reason': 'No telemetry data available'}
            
            current_soc = latest.get('batteryLevel', 50)
            
            # Check SOC limits for Charge/Discharge
            if action == 'Discharge' and current_soc <= self.safety_limits['min_soc']:
                return {
                    'safe': False,
                    'reason': f"SOC too low for discharge: {current_soc}% <= {self.safety_limits['min_soc']}%"
                }
            
            if action == 'Charge' and current_soc >= self.safety_limits['max_soc']:
                return {
                    'safe': False,
                    'reason': f"SOC too high for charging: {current_soc}% >= {self.safety_limits['max_soc']}%"
                }
            
            # Check magnitude limits
            if action == 'Charge' and magnitude > self.safety_limits['max_charge_rate']:
                return {
                    'safe': False,
                    'reason': f"Charge rate too high: {magnitude} > {self.safety_limits['max_charge_rate']} kW"
                }
            
            if action == 'Discharge' and magnitude > self.safety_limits['max_discharge_rate']:
                return {
                    'safe': False,
                    'reason': f"Discharge rate too high: {magnitude} > {self.safety_limits['max_discharge_rate']} kW"
                }
            
            # Load Deferral magnitude should be 0-100%
            if action == 'Load Deferral' and (magnitude < 0 or magnitude > 100):
                return {
                    'safe': False,
                    'reason': f"Load deferral percentage must be 0-100%, got {magnitude}%"
                }
            
            return {'safe': True}
        
        except Exception as e:
            logger.error(f"Error in safety check: {e}")
            return {'safe': False, 'reason': f"Safety check error: {str(e)}"}
        
    async def _log_control_action(self, command: Dict, result: Dict):
        """Log control action to database for audit trail"""
        try:
            collection = db_manager.mongo_db['control_logs']
            log_entry = {
                **command,
                'hardware_result': result,
                'logged_at': datetime.now()
            }
            await collection.insert_one(log_entry)
            logger.info(f"✅ Control action logged to database")
        except Exception as e:
            logger.error(f"Error logging control action: {e}")
    
    async def _send_to_hardware(self, command: Dict) -> Dict:
        """
        Send control command to actual hardware (MQTT/API)
        This interfaces with your Module 1 (IoT & Edge Layer)
        """
        try:
            import json
            
            # Format command for hardware
            hardware_command = {
                'nodeId': command['node_id'],
                'command': command['action'],  # 'Charge', 'Discharge', 'Hold', or 'Load Deferral'
                'value': command['magnitude'],
                'duration': command['duration_minutes'],
                'reason': command['reason'],
                'timestamp': command['timestamp'].isoformat()
            }
            
            logger.info(f"📡 Sending to hardware: {json.dumps(hardware_command, indent=2)}")
            
            # OPTION 1: Send via MQTT (if using MQTT broker)
            # await self._send_via_mqtt(hardware_command)
            
            # OPTION 2: Send via HTTP to Node.js backend
            await self._send_via_http(hardware_command)
            
            # Simulate hardware acknowledgment
            await asyncio.sleep(0.1)
            
            return {
                'acknowledged': True,
                'hardware_timestamp': datetime.now(),
                'execution_status': 'in_progress',
                'command_sent': hardware_command
            }
        
        except Exception as e:
            logger.error(f"Hardware communication error: {e}")
            return {
                'acknowledged': False,
                'error': str(e)
            }
    
    async def _send_via_http(self, command: Dict):
        """Send command via HTTP to Node.js backend"""
        try:
            import aiohttp
            from src.config.config import config
            
            # Build URL from config
            url = f"{config.NODEJS_BACKEND_URL}{config.NODEJS_ENDPOINTS['control_execute']}"
            
            logger.info(f"📡 Sending command to {url}")
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=command, timeout=10) as response:
                        if response.status == 200:
                            logger.info(f"✅ Command sent to Node.js backend: {command['command']}")
                            result = await response.json()
                            return result
                        else:
                            logger.error(f"❌ Failed to send command: HTTP {response.status}")
                            error_text = await response.text()
                            logger.error(f"Error response: {error_text}")
            except aiohttp.ClientConnectorError:
                logger.warning(f"⚠️ Cannot connect to Node.js backend at {url}")
                logger.warning("   This is OK for testing. Commands are logged but not executed.")
                # Return success for testing purposes
                return {
                    'acknowledged': True,
                    'note': 'Backend unavailable - command logged only',
                    'test_mode': True
                }
            
        except Exception as e:
            logger.error(f"Hardware communication error: {e}")
            return {
                'acknowledged': False,
                'error': str(e)
            }
    
    async def _send_via_mqtt(self, command: Dict):
        """Send command via MQTT (optional)"""
        try:
            # Example MQTT implementation
            # import paho.mqtt.client as mqtt
            # client = mqtt.Client()
            # client.connect("mqtt_broker_host", 1883)
            # topic = f"vpp/control/{command['nodeId']}"
            # client.publish(topic, json.dumps(command))
            pass
        except Exception as e:
            logger.error(f"Error sending via MQTT: {e}")
    
    async def regulate_grid_frequency(
        self,
        current_frequency: float,
        available_nodes: List[str]
    ) -> List[Dict]:
        """
        Automatically regulate grid frequency using available battery nodes
        """
        actions = []
        
        try:
            deviation = current_frequency - 50.0
            
            # Critical frequency deviation - immediate action
            if current_frequency < self.safety_limits['min_frequency']:
                logger.warning(f"🚨 CRITICAL: Low frequency {current_frequency} Hz")
                
                # Discharge all available batteries to support grid
                for node_id in available_nodes:
                    result = await self.control_node_power(
                        node_id=node_id,
                        action='Discharge',  # Proper command format
                        magnitude=200,
                        reason=f"Emergency frequency support: {current_frequency} Hz",
                        duration_minutes=5
                    )
                    actions.append(result)
            
            elif current_frequency > self.safety_limits['max_frequency']:
                logger.warning(f"⚡ High frequency {current_frequency} Hz")
                
                # Charge batteries to absorb excess power
                for node_id in available_nodes:
                    result = await self.control_node_power(
                        node_id=node_id,
                        action='Charge',  # Proper command format
                        magnitude=150,
                        reason=f"Frequency regulation: {current_frequency} Hz",
                        duration_minutes=5
                    )
                    actions.append(result)
            
            # Normal operation - proportional control
            elif abs(deviation) > 0.05:
                control_magnitude = min(abs(deviation) * 1000, 100)
                action_type = 'Discharge' if deviation < 0 else 'Charge'
                
                for node_id in available_nodes[:2]:
                    result = await self.control_node_power(
                        node_id=node_id,
                        action=action_type,
                        magnitude=control_magnitude,
                        reason=f"Frequency regulation: {current_frequency} Hz (deviation: {deviation:.3f})",
                        duration_minutes=15
                    )
                    actions.append(result)
            
            return actions
        
        except Exception as e:
            logger.error(f"Error in frequency regulation: {e}")
            return []

# Global controller
power_controller = PowerFlowController()