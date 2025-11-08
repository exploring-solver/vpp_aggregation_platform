#!/usr/bin/env python3
"""
Data Center Gateway & Telemetry Normalizer - IoT Server
Receives, validates, and aggregates telemetry from edge nodes
"""

import asyncio
import websockets
import json
from datetime import datetime
from datetime import datetime, timezone
from collections import defaultdict
import statistics

class DataCenterGateway:
    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        self.connected_nodes = {}
        self.monitor_clients = set()  # Track connected monitor clients
        self.telemetry_buffer = defaultdict(list)
        self.max_buffer_size = 100
        
        # Statistics tracking
        self.stats = {
            'total_messages': 0,
            'total_nodes': 0,
            'messages_per_node': defaultdict(int)
        }
        
    def validate_telemetry(self, payload):
        """Validate telemetry payload schema"""
        required_fields = [
            'timestamp', 'dc_id', 'power_kw', 'soc', 
            'freq', 'voltage', 'load'
        ]
        
        for field in required_fields:
            if field not in payload:
                return False, f"Missing required field: {field}"
        
        # Validate data types and ranges
        try:
            if not (0 <= payload['soc'] <= 100):
                return False, "SOC must be between 0 and 100"
            if not (0 <= payload['voltage'] <= 1000):
                return False, "Voltage out of reasonable range"
            if not (40 <= payload['freq'] <= 70):
                return False, "Frequency out of reasonable range"
            if payload['power_kw'] < 0:
                return False, "Power cannot be negative"
                
        except (TypeError, ValueError) as e:
            return False, f"Invalid data type: {e}"
        
        return True, "Valid"
    
    def normalize_telemetry(self, payload):
        """Normalize and enrich telemetry data"""
        normalized = {
            # Core telemetry (as per module spec)
            'timestamp': payload['timestamp'],
            'dc_id': payload['dc_id'],
            'power_kw': round(payload['power_kw'], 3),
            'soc': round(payload['soc'], 2),
            'freq': round(payload['freq'], 3),
            'voltage': round(payload['voltage'], 2),
            'load': round(payload['load'], 2),
            
            # Additional normalized fields
            'hostname': payload.get('hostname', 'unknown'),
            'charging': payload.get('charging', False),
            'capacity_kwh': payload.get('capacity_kwh', 0),
            
            # Computed fields
            'power_state': self._determine_power_state(payload),
            'health_status': self._assess_health(payload),
            'processed_at': datetime.utcnow().isoformat() + 'Z'
        }
        
        return normalized
    
    def _determine_power_state(self, payload):
        """Determine power state based on telemetry"""
        power_kw = payload['power_kw']
        soc = payload['soc']
        
        if payload.get('charging', False):
            return 'charging'
        elif power_kw > 0.05:
            return 'discharging'
        elif soc > 95:
            return 'full'
        else:
            return 'idle'
    
    def _assess_health(self, payload):
        """Assess system health based on metrics"""
        issues = []
        
        if payload['soc'] < 20:
            issues.append('low_battery')
        if payload['freq'] < 59.5 or payload['freq'] > 60.5:
            issues.append('frequency_deviation')
        if payload['voltage'] < 45 or payload['voltage'] > 52:
            issues.append('voltage_abnormal')
        if payload.get('load', 0) > 90:
            issues.append('high_load')
        
        if not issues:
            return 'healthy'
        elif len(issues) == 1:
            return 'warning'
        else:
            return 'critical'
    
    def store_telemetry(self, normalized_data):
        """Store telemetry in buffer (simulates MongoDB/TimescaleDB)"""
        dc_id = normalized_data['dc_id']
        self.telemetry_buffer[dc_id].append(normalized_data)
        
        # Maintain buffer size
        if len(self.telemetry_buffer[dc_id]) > self.max_buffer_size:
            self.telemetry_buffer[dc_id].pop(0)
        
        # Update statistics
        self.stats['total_messages'] += 1
        self.stats['messages_per_node'][dc_id] += 1
    
    def get_aggregated_metrics(self, dc_id):
        """Get aggregated metrics for a data center"""
        if dc_id not in self.telemetry_buffer or not self.telemetry_buffer[dc_id]:
            return None
        
        recent_data = self.telemetry_buffer[dc_id][-20:]  # Last 20 readings
        
        return {
            'dc_id': dc_id,
            'avg_power_kw': round(statistics.mean([d['power_kw'] for d in recent_data]), 3),
            'avg_soc': round(statistics.mean([d['soc'] for d in recent_data]), 2),
            'avg_load': round(statistics.mean([d['load'] for d in recent_data]), 2),
            'avg_freq': round(statistics.mean([d['freq'] for d in recent_data]), 3),
            'min_soc': min([d['soc'] for d in recent_data]),
            'max_load': max([d['load'] for d in recent_data]),
            'health_status': recent_data[-1]['health_status'],
            'sample_count': len(recent_data)
        }
    
    async def send_dispatch_command(self, websocket, dc_id, command_type, **kwargs):
        """Send dispatch command to edge node"""
        command = {
            'type': command_type,
            'dc_id': dc_id,
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            **kwargs
        }
        
        await websocket.send(json.dumps(command))
        print(f"📤 Sent command to {dc_id}: {command_type}")
    
    async def handle_edge_node(self, websocket, path):
        """Handle connection from an edge node or monitor"""
        try:
            # Get initial message to identify client type
            initial_message = await websocket.recv()
            initial_data = json.loads(initial_message)
            
            # Handle monitor clients
            if initial_data.get('client_type') == 'dashboard':
                print(f"\n📊 Monitor client connected")
                self.monitor_clients.add(websocket)
                try:
                    while True:
                        # Keep connection alive
                        await websocket.recv()
                except:
                    self.monitor_clients.remove(websocket)
                    print("📊 Monitor client disconnected")
                return
            
            # Handle edge nodes
            node_id = initial_data.get('dc_id', 'unknown')
            
            self.connected_nodes[node_id] = {
                'websocket': websocket,
                'connected_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'hostname': initial_data.get('hostname', 'unknown')
            }
            
            self.stats['total_nodes'] = len(self.connected_nodes)
            
            print(f"\n✅ Node connected: {node_id} ({initial_data.get('hostname')})")
            print(f"   Total active nodes: {len(self.connected_nodes)}")
            
            # Process initial message
            await self.process_telemetry(initial_data, websocket)
            
            # Handle subsequent messages
            async for message in websocket:
                data = json.loads(message)
                await self.process_telemetry(data, websocket)
                
        except websockets.exceptions.ConnectionClosed:
            print(f"🔌 Node disconnected: {node_id}")
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON from {node_id}: {e}")
        except Exception as e:
            print(f"❌ Error handling node {node_id}: {e}")
        finally:
            if node_id and node_id in self.connected_nodes:
                del self.connected_nodes[node_id]
                self.stats['total_nodes'] = len(self.connected_nodes)
                print(f"🔻 Node removed: {node_id}. Active nodes: {len(self.connected_nodes)}")
    
    async def process_telemetry(self, data, websocket):
        """Process incoming telemetry data"""
        # Validate
        is_valid, message = self.validate_telemetry(data)
        if not is_valid:
            print(f"⚠️  Validation failed for {data.get('dc_id')}: {message}")
            return
        
        # Normalize
        normalized = self.normalize_telemetry(data)
        
        # Store
        self.store_telemetry(normalized)
        
        # Display
        print(f"📥 [{normalized['timestamp']}] {normalized['dc_id']}: "
              f"⚡{normalized['power_kw']}kW | "
              f"🔋{normalized['soc']}% | "
              f"📊{normalized['load']}% | "
              f"🌊{normalized['freq']}Hz | "
              f"💚{normalized['health_status']}")
        
        # Broadcast to all monitor clients
        for monitor in self.monitor_clients.copy():
            try:
                await monitor.send(json.dumps(normalized))
            except:
                self.monitor_clients.remove(monitor)
        
        # Check if we need to send dispatch commands
        await self.check_and_dispatch(normalized, websocket)
        
        # Display aggregated metrics every 10 messages
        if self.stats['messages_per_node'][data['dc_id']] % 10 == 0:
            self.display_aggregated_metrics(data['dc_id'])
    
    async def check_and_dispatch(self, normalized, websocket):
        """Check conditions and send dispatch commands if needed"""
        dc_id = normalized['dc_id']
        
        # Example dispatch logic
        if normalized['soc'] < 25:
            await self.send_dispatch_command(
                websocket, dc_id, 'setpoint',
                action='charge',
                target_power_kw=5.0,
                reason='Low SOC detected'
            )
        elif normalized['soc'] > 80:
            await self.send_dispatch_command(
                websocket, dc_id, 'setpoint',
                action='discharge',
                target_power_kw=10.0,
                reason='High load and full battery'
            )
    
    def display_aggregated_metrics(self, dc_id):
        """Display aggregated metrics for a data center"""
        metrics = self.get_aggregated_metrics(dc_id)
        if metrics:
            print(f"\n📊 AGGREGATED METRICS - {dc_id}")
            print(f"   Avg Power: {metrics['avg_power_kw']} kW")
            print(f"   Avg SOC: {metrics['avg_soc']}% (Min: {metrics['min_soc']}%)")
            print(f"   Avg Load: {metrics['avg_load']}% (Max: {metrics['max_load']}%)")
            print(f"   Avg Frequency: {metrics['avg_freq']} Hz")
            print(f"   Health: {metrics['health_status']}")
            print(f"   Samples: {metrics['sample_count']}\n")
    
    def display_statistics(self):
        """Display gateway statistics"""
        print("\n" + "="*60)
        print("📈 GATEWAY STATISTICS")
        print("="*60)
        print(f"Total Messages Processed: {self.stats['total_messages']}")
        print(f"Active Nodes: {self.stats['total_nodes']}")
        print("\nMessages per Node:")
        for node_id, count in self.stats['messages_per_node'].items():
            print(f"  {node_id}: {count} messages")
        print("="*60 + "\n")
    
    async def statistics_reporter(self):
        """Periodic statistics reporter"""
        while True:
            await asyncio.sleep(60)  # Report every minute
            self.display_statistics()
    
    async def start(self):
        """Start the gateway server"""
        print("="*60)
        print("🏢 DATA CENTER GATEWAY & TELEMETRY NORMALIZER")
        print("="*60)
        print(f"Started at: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}")
        print(f"Listening on: ws://{self.host}:{self.port}")
        print(f"Started at: {datetime.utcnow().isoformat()}Z")
        print("="*60)
        print("\n⏳ Waiting for edge nodes to connect...\n")
        
        async with websockets.serve(self.handle_edge_node, self.host, self.port):
            # Run statistics reporter in background
            await self.statistics_reporter()


def main():
    """Entry point"""
    gateway = DataCenterGateway(host="0.0.0.0", port=8765)
    
    try:
        asyncio.run(gateway.start())
    except KeyboardInterrupt:
        print("\n⛔ Gateway server stopped by user")
        gateway.display_statistics()


if __name__ == "__main__":
    main()