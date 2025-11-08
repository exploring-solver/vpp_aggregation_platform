"""
Utility to format commands for hardware
Ensures consistent command format across the system
"""
from typing import Dict, Any
from datetime import datetime

class CommandFormatter:
    """Format commands for hardware execution"""
    
    VALID_COMMANDS = ['Charge', 'Discharge', 'Hold', 'Load Deferral']
    
    @staticmethod
    def format_for_hardware(
        node_id: str,
        action: str,
        magnitude: float,
        duration_minutes: int = 15,
        reason: str = ""
    ) -> Dict[str, Any]:
        """
        Format command in exact format expected by hardware
        
        Args:
            node_id: Target node identifier
            action: One of ['Charge', 'Discharge', 'Hold', 'Load Deferral']
            magnitude: Value (kW or %)
            duration_minutes: Duration
            reason: Human-readable reason
        
        Returns:
            Formatted command dictionary
        """
        # Validate action
        if action not in CommandFormatter.VALID_COMMANDS:
            raise ValueError(f"Invalid action: {action}. Must be one of {CommandFormatter.VALID_COMMANDS}")
        
        return {
            'nodeId': node_id,
            'command': action,  # Exact match to dropdown
            'value': magnitude,
            'duration': duration_minutes,
            'reason': reason,
            'timestamp': datetime.now().isoformat(),
            'unit': 'kW' if action in ['Charge', 'Discharge'] else '%' if action == 'Load Deferral' else 'N/A'
        }
    
    @staticmethod
    def validate_command(command: Dict) -> tuple[bool, str]:
        """
        Validate command format
        
        Returns:
            (is_valid, error_message)
        """
        required_fields = ['nodeId', 'command', 'value', 'duration']
        
        # Check required fields
        for field in required_fields:
            if field not in command:
                return False, f"Missing required field: {field}"
        
        # Validate action
        if command['command'] not in CommandFormatter.VALID_COMMANDS:
            return False, f"Invalid command: {command['command']}"
        
        # Validate magnitude ranges
        action = command['command']
        value = command['value']
        
        if action in ['Charge', 'Discharge'] and (value < 0 or value > 250):
            return False, f"{action} value must be 0-250 kW"
        
        if action == 'Load Deferral' and (value < 0 or value > 100):
            return False, "Load Deferral value must be 0-100%"
        
        return True, ""
    
    @staticmethod
    def command_to_string(command: Dict) -> str:
        """Convert command to human-readable string"""
        action = command.get('command', 'Unknown')
        value = command.get('value', 0)
        node = command.get('nodeId', 'Unknown')
        
        unit = 'kW' if action in ['Charge', 'Discharge'] else '%' if action == 'Load Deferral' else ''
        
        return f"{action} {value}{unit} on {node}"

# Global formatter
command_formatter = CommandFormatter()