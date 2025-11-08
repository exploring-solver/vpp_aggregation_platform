#!/usr/bin/env python3
"""
Edge Node Controller - IoT Client
Collects real-time telemetry from laptop and sends to Gateway Server
"""

import asyncio
import websockets
import json
import psutil
import platform
import time
from datetime import datetime
import random
import socket as sock

class EdgeNodeController:
    def __init__(self, dc_id="DC001", server_uri="ws://localhost:8765"):
        self.dc_id = dc_id
        self.server_uri = server_uri
        self.hostname = platform.node()
        
        # Battery simulation parameters (for BESS simulation)
        self.battery_soc = 75.0  # State of Charge (%)
        self.battery_capacity_kwh = 100.0  # Simulated battery capacity
        self.battery_voltage = 48.0  # Nominal voltage
        
    def get_system_metrics(self):
        """Collect real-time system metrics from laptop"""
        try:
            # CPU and Load
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_freq = psutil.cpu_freq().current if psutil.cpu_freq() else 0
            load_avg = psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else cpu_percent / 100
            
            # Memory
            memory = psutil.virtual_memory()
            
            # Network
            net_io = psutil.net_io_counters()
            
            # Power (if available on laptop)
            power_watts = 0
            battery_info = None
            if hasattr(psutil, 'sensors_battery'):
                battery_info = psutil.sensors_battery()
                if battery_info:
                    # Estimate power based on battery drain rate
                    power_watts = battery_info.power_plugged and 45 or 25  # Typical laptop power
            
            # Estimate power consumption based on CPU usage
            base_power = 15  # Idle power (watts)
            cpu_power = (cpu_percent / 100) * 50  # Max 50W for CPU under load
            memory_power = (memory.percent / 100) * 10  # Max 10W for memory
            estimated_power = base_power + cpu_power + memory_power
            
            return {
                'cpu_percent': round(cpu_percent, 2),
                'cpu_freq_mhz': round(cpu_freq, 2),
                'load_average': round(load_avg, 2),
                'memory_percent': round(memory.percent, 2),
                'memory_used_gb': round(memory.used / (1024**3), 2),
                'network_sent_mb': round(net_io.bytes_sent / (1024**2), 2),
                'network_recv_mb': round(net_io.bytes_recv / (1024**2), 2),
                'power_watts': round(estimated_power, 2),
                'battery_info': battery_info
            }
        except Exception as e:
            print(f"Error collecting metrics: {e}")
            return None
    
    def simulate_battery_metrics(self, system_metrics):
        """Simulate BESS (Battery Energy Storage System) metrics"""
        # Simulate battery behavior based on load
        power_kw = system_metrics['power_watts'] / 1000
        
        # Simulate discharge/charge based on load
        if system_metrics['cpu_percent'] > 70:
            # High load - battery discharging
            self.battery_soc -= random.uniform(0.1, 0.3)
            charging = False
        elif system_metrics['cpu_percent'] < 30:
            # Low load - battery charging
            self.battery_soc += random.uniform(0.1, 0.2)
            charging = True
        else:
            # Moderate load
            self.battery_soc -= random.uniform(0.0, 0.1)
            charging = False
        
        # Keep SOC within bounds
        self.battery_soc = max(20.0, min(100.0, self.battery_soc))
        
        # Simulate voltage variation based on SOC
        voltage_variation = (self.battery_soc - 50) / 100 * 5
        current_voltage = self.battery_voltage + voltage_variation
        
        # Simulate grid frequency (50Hz or 60Hz with small variations)
        base_frequency = 60.0  # Hz (use 50.0 for Europe/Asia)
        frequency = base_frequency + random.uniform(-0.2, 0.2)
        
        return {
            'soc': round(self.battery_soc, 2),
            'voltage': round(current_voltage, 2),
            'frequency': round(frequency, 3),
            'charging': charging,
            'capacity_kwh': self.battery_capacity_kwh
        }
    
    def create_telemetry_payload(self):
        """Create normalized telemetry payload"""
        system_metrics = self.get_system_metrics()
        if not system_metrics:
            return None
        
        battery_metrics = self.simulate_battery_metrics(system_metrics)
        
        # Normalized schema as per module specification
        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'dc_id': self.dc_id,
            'hostname': self.hostname,
            
            # Power and Load metrics
            'power_kw': round(system_metrics['power_watts'] / 1000, 3),
            'load': system_metrics['cpu_percent'],
            'load_average': system_metrics['load_average'],
            
            # Battery/BESS metrics
            'soc': battery_metrics['soc'],
            'voltage': battery_metrics['voltage'],
            'freq': battery_metrics['frequency'],
            'charging': battery_metrics['charging'],
            'capacity_kwh': battery_metrics['capacity_kwh'],
            
            # Additional system metrics
            'cpu_freq_mhz': system_metrics['cpu_freq_mhz'],
            'memory_percent': system_metrics['memory_percent'],
            'memory_used_gb': system_metrics['memory_used_gb'],
            'network_sent_mb': system_metrics['network_sent_mb'],
            'network_recv_mb': system_metrics['network_recv_mb'],
            
            # Metadata
            'node_type': 'edge_controller',
            'protocol': 'websocket'
        }
        
        return payload
    
    async def send_telemetry(self, websocket):
        """Send telemetry data every 5 seconds"""
        print(f"🚀 Edge Node {self.dc_id} started. Sending telemetry every 5 seconds...")
        
        while True:
            try:
                payload = self.create_telemetry_payload()
                if payload:
                    await websocket.send(json.dumps(payload))
                    print(f"📤 [{payload['timestamp']}] Sent: Power={payload['power_kw']}kW, "
                          f"SOC={payload['soc']}%, Load={payload['load']}%, "
                          f"Freq={payload['freq']}Hz")
                
                await asyncio.sleep(5)  # 5-second interval
                
            except Exception as e:
                print(f"❌ Error sending telemetry: {e}")
                break
    
    async def receive_commands(self, websocket):
        """Receive dispatch commands from server"""
        try:
            async for message in websocket:
                command = json.loads(message)
                print(f"📥 Received command: {command}")
                
                # Handle different command types
                if command.get('type') == 'setpoint':
                    print(f"⚡ Setpoint command: {command.get('action')} - "
                          f"Target: {command.get('target_power_kw')}kW")
                elif command.get('type') == 'config':
                    print(f"⚙️  Configuration update: {command.get('config')}")
                    
        except websockets.exceptions.ConnectionClosed:
            print("🔌 Server connection closed")
        except Exception as e:
            print(f"❌ Error receiving commands: {e}")
    
    async def run(self):
        """Main run loop with reconnection logic"""
        retry_delay = 5
        
        while True:
            try:
                print(f"🔄 Connecting to gateway at {self.server_uri}...")
                async with websockets.connect(self.server_uri) as websocket:
                    print(f"✅ Connected to gateway!")
                    
                    # Run send and receive concurrently
                    await asyncio.gather(
                        self.send_telemetry(websocket),
                        self.receive_commands(websocket)
                    )
                    
            except ConnectionRefusedError:
                print(f"❌ Connection refused. Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            except Exception as e:
                print(f"❌ Error: {e}. Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)


def main():
    """Entry point"""
    # Get local IP for display
    hostname = sock.gethostname()
    local_ip = sock.gethostbyname(hostname)
    
    print("=" * 60)
    print("🏭 EDGE NODE CONTROLLER - IoT Client")
    print("=" * 60)
    print(f"Hostname: {hostname}")
    print(f"Local IP: {local_ip}")
    print(f"Data Center ID: DC001")
    print("=" * 60)
    
    # Create and run edge node
    edge_node = EdgeNodeController(
        dc_id="DC001",
        server_uri="ws://localhost:8765"
    )
    
    try:
        asyncio.run(edge_node.run())
    except KeyboardInterrupt:
        print("\n⛔ Edge node stopped by user")


if __name__ == "__main__":
    main()