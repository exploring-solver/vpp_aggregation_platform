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
            
            # Disk I/O (affects power)
            disk_io = psutil.disk_io_counters()
            
            # Get real battery information
            battery_info = None
            battery_percent = None
            is_plugged = False
            
            if hasattr(psutil, 'sensors_battery'):
                battery_info = psutil.sensors_battery()
                if battery_info:
                    battery_percent = battery_info.percent
                    is_plugged = battery_info.power_plugged
            
            # Calculate REALISTIC power consumption
            power_watts = self._calculate_realistic_power(
                cpu_percent, 
                memory.percent,
                cpu_freq,
                disk_io,
                is_plugged,
                battery_percent
            )
            
            return {
                'cpu_percent': round(cpu_percent, 2),
                'cpu_freq_mhz': round(cpu_freq, 2),
                'load_average': round(load_avg, 2),
                'memory_percent': round(memory.percent, 2),
                'memory_used_gb': round(memory.used / (1024**3), 2),
                'network_sent_mb': round(net_io.bytes_sent / (1024**2), 2),
                'network_recv_mb': round(net_io.bytes_recv / (1024**2), 2),
                'disk_read_mb': round(disk_io.read_bytes / (1024**2), 2) if disk_io else 0,
                'disk_write_mb': round(disk_io.write_bytes / (1024**2), 2) if disk_io else 0,
                'power_watts': round(power_watts, 2),
                'battery_info': battery_info,
                'battery_percent': battery_percent,
                'is_plugged': is_plugged
            }
        except Exception as e:
            print(f"Error collecting metrics: {e}")
            return None
    
    def _calculate_realistic_power(self, cpu_percent, memory_percent, cpu_freq, 
                                   disk_io, is_plugged, battery_percent):
        """
        Calculate realistic power consumption based on actual system state
        
        Laptop power breakdown:
        - Display: 5-15W (we'll assume 10W average)
        - CPU: 5-45W (based on utilization and frequency)
        - Memory: 2-8W (based on usage)
        - Disk: 2-5W (based on I/O)
        - Motherboard/Chipset: 5-10W (base)
        - Network/WiFi: 1-3W
        - Charging overhead: +5-10W when plugged in
        """
        
        # Base system power (motherboard, chipset, idle components)
        base_power = 8.0
        
        # Display power (assume on)
        display_power = 10.0
        
        # CPU power (based on usage and frequency)
        # Modern laptops: 5W idle, up to 45W under full load
        cpu_base = 5.0
        cpu_load_factor = cpu_percent / 100
        
        # Frequency scaling factor (higher frequency = more power)
        if cpu_freq > 0:
            # Normalize to typical 2.5 GHz base
            freq_factor = (cpu_freq / 2500) ** 2  # Power scales with frequency squared
        else:
            freq_factor = 1.0
        
        cpu_power = cpu_base + (cpu_load_factor * 40 * freq_factor)
        
        # Memory power (based on usage)
        # DDR4: ~3W per 8GB stick at moderate use
        memory_base = 2.0
        memory_active = (memory_percent / 100) * 6
        memory_power = memory_base + memory_active
        
        # Disk I/O power
        # SSD: 2-3W idle, up to 5W during heavy I/O
        # HDD: 5-8W (we'll assume SSD)
        disk_power = 2.5
        if disk_io:
            # Check if there's significant I/O activity
            # This is a heuristic - more I/O = more power
            disk_power = 3.5
        
        # Network power (WiFi)
        network_power = 2.0
        
        # Total system power
        total_power = base_power + display_power + cpu_power + memory_power + disk_power + network_power
        
        # Charging overhead (battery charging is inefficient)
        if is_plugged and battery_percent and battery_percent < 100:
            # Add charging overhead
            charging_rate = (100 - battery_percent) / 100  # More charging needed = more overhead
            charging_overhead = 5 + (charging_rate * 5)
            total_power += charging_overhead
        
        # Add some realistic variance (sensors aren't perfect)
        variance = random.uniform(-2, 2)
        total_power += variance
        
        # Clamp to realistic laptop range (10W - 100W)
        total_power = max(10, min(100, total_power))
        
        return total_power
    
    def simulate_battery_metrics(self, system_metrics):
        """Simulate BESS (Battery Energy Storage System) metrics based on real system state"""
        power_kw = system_metrics['power_watts'] / 1000
        
        # Use real battery data if available
        if system_metrics['battery_percent'] is not None:
            # Use actual battery percentage
            actual_battery = system_metrics['battery_percent']
            is_plugged = system_metrics['is_plugged']
            
            # For BESS simulation, we scale the laptop battery to data center scale
            # Laptop battery: 50-100Wh, Data center BESS: 100kWh
            # We'll use the actual battery percentage as SOC
            
            if is_plugged:
                # Plugged in - battery is charging or full
                if actual_battery < 100:
                    # Charging - SOC increases
                    charge_rate = (100 - actual_battery) / 100 * 0.5  # Slower charging at higher SOC
                    self.battery_soc = min(100, actual_battery + charge_rate)
                    charging = True
                else:
                    # Full - maintain
                    self.battery_soc = 100.0
                    charging = False
            else:
                # On battery - discharging based on power consumption
                # Higher power = faster discharge
                discharge_rate = (power_kw / self.battery_capacity_kwh) * 100 * 5  # Scale factor
                self.battery_soc = max(20, actual_battery - discharge_rate)
                charging = False
            
            # Add small variance to show it's working
            self.battery_soc += random.uniform(-0.05, 0.05)
            
        else:
            # No real battery data - simulate based on load
            if system_metrics['cpu_percent'] > 70 or power_kw > 0.05:
                # High load - battery discharging
                discharge_rate = (power_kw / self.battery_capacity_kwh) * 100 * 5
                self.battery_soc -= discharge_rate + random.uniform(0, 0.2)
                charging = False
            elif system_metrics['cpu_percent'] < 30 and power_kw < 0.03:
                # Low load - battery charging
                self.battery_soc += random.uniform(0.1, 0.3)
                charging = True
            else:
                # Moderate load - slight discharge
                self.battery_soc -= random.uniform(0.0, 0.15)
                charging = False
        
        # Keep SOC within realistic bounds
        self.battery_soc = max(20.0, min(100.0, self.battery_soc))
        
        # Simulate voltage variation based on SOC and load
        # Battery voltage typically drops under load and at low SOC
        base_voltage = self.battery_voltage
        
        # SOC effect: voltage drops at low SOC
        soc_factor = (self.battery_soc - 50) / 100  # -0.5 to +0.5
        voltage_soc_variation = soc_factor * 3  # ±3V based on SOC
        
        # Load effect: voltage drops under high load
        load_factor = system_metrics['cpu_percent'] / 100
        voltage_load_drop = -load_factor * 2  # Up to -2V under load
        
        # Power draw effect
        power_factor = power_kw / 0.1  # Normalize around 0.1kW
        voltage_power_drop = -power_factor * 1.5
        
        current_voltage = base_voltage + voltage_soc_variation + voltage_load_drop + voltage_power_drop
        
        # Add small random fluctuation
        current_voltage += random.uniform(-0.3, 0.3)
        
        # Clamp voltage to realistic range (40-52V for 48V system)
        current_voltage = max(40.0, min(52.0, current_voltage))
        
        # Simulate grid frequency (60Hz in US, 50Hz in EU/Asia)
        # Frequency varies with grid load
        base_frequency = 60.0  # Hz
        
        # Grid frequency drops when grid is under stress (high load)
        # Our local load is a proxy for grid conditions
        load_factor = system_metrics['cpu_percent'] / 100
        freq_deviation = -load_factor * 0.3  # Up to -0.3Hz under heavy load
        
        # Add realistic random walk (grid frequency isn't constant)
        freq_deviation += random.uniform(-0.15, 0.15)
        
        frequency = base_frequency + freq_deviation
        
        # Clamp to realistic grid frequency range (59.5-60.5 Hz for US grid)
        frequency = max(59.5, min(60.5, frequency))
        
        return {
            'soc': round(self.battery_soc, 2),
            'voltage': round(current_voltage, 2),
            'frequency': round(frequency, 3),
            'charging': charging,
            'capacity_kwh': self.battery_capacity_kwh,
            'is_plugged': system_metrics.get('is_plugged', False),
            'actual_battery_percent': system_metrics.get('battery_percent')
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
            'power_watts': system_metrics['power_watts'],  # Include watts for clarity
            'load': system_metrics['cpu_percent'],
            'load_average': system_metrics['load_average'],
            
            # Battery/BESS metrics
            'soc': battery_metrics['soc'],
            'voltage': battery_metrics['voltage'],
            'freq': battery_metrics['frequency'],
            'charging': battery_metrics['charging'],
            'is_plugged': battery_metrics['is_plugged'],
            'capacity_kwh': battery_metrics['capacity_kwh'],
            'actual_battery_percent': battery_metrics.get('actual_battery_percent'),
            
            # Additional system metrics
            'cpu_freq_mhz': system_metrics['cpu_freq_mhz'],
            'memory_percent': system_metrics['memory_percent'],
            'memory_used_gb': system_metrics['memory_used_gb'],
            'network_sent_mb': system_metrics['network_sent_mb'],
            'network_recv_mb': system_metrics['network_recv_mb'],
            'disk_read_mb': system_metrics.get('disk_read_mb', 0),
            'disk_write_mb': system_metrics.get('disk_write_mb', 0),
            
            # Metadata
            'node_type': 'edge_controller',
            'protocol': 'websocket'
        }
        
        return payload
    
    async def send_telemetry(self, websocket):
        """Send telemetry data every 5 seconds"""
        print(f"🚀 Edge Node {self.dc_id} started. Sending telemetry every 5 seconds...")
        print(f"📊 System: {platform.system()} | CPU Cores: {psutil.cpu_count()}")
        
        # Check if we have battery
        has_battery = hasattr(psutil, 'sensors_battery') and psutil.sensors_battery() is not None
        if has_battery:
            print(f"🔋 Real battery detected - using actual battery data")
        else:
            print(f"🔌 No battery detected - simulating battery metrics")
        print()
        
        while True:
            try:
                payload = self.create_telemetry_payload()
                if payload:
                    await websocket.send(json.dumps(payload))
                    
                    # Enhanced console output
                    plugged_status = "🔌" if payload.get('is_plugged', False) else "🔋"
                    charging_status = "⚡Charging" if payload.get('charging', False) else "📉Discharging"
                    
                    print(f"📤 [{payload['timestamp']}]")
                    print(f"   Power: {payload['power_kw']:.3f}kW ({payload.get('power_watts', 0):.1f}W) | "
                          f"SOC: {payload['soc']:.1f}% {plugged_status} | "
                          f"Load: {payload['load']:.1f}% | "
                          f"Freq: {payload['freq']:.3f}Hz")
                    print(f"   Voltage: {payload['voltage']:.2f}V | "
                          f"Status: {charging_status} | "
                          f"CPU: {payload.get('cpu_freq_mhz', 0):.0f}MHz | "
                          f"Mem: {payload.get('memory_percent', 0):.1f}%")
                    
                    if has_battery and payload.get('actual_battery_percent'):
                        print(f"   💡 Actual laptop battery: {payload['actual_battery_percent']:.0f}%")
                    print()
                
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