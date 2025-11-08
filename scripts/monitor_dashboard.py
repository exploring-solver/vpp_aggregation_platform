#!/usr/bin/env python3
"""
Real-time Monitoring Dashboard for IoT Module 1
Displays live telemetry data in a terminal-based dashboard
"""

import asyncio
import websockets
import json
from datetime import datetime
import sys
import os

class MonitorDashboard:
    def __init__(self, server_uri="ws://localhost:8765"):
        self.server_uri = server_uri
        self.latest_data = {}
        self.message_count = 0
        self.start_time = datetime.utcnow()
    
    def clear_screen(self):
        """Clear terminal screen"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
    def format_uptime(self):
        """Format uptime duration"""
        uptime = datetime.utcnow() - self.start_time
        hours, remainder = divmod(int(uptime.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    def get_health_emoji(self, status):
        """Get emoji for health status"""
        emoji_map = {
            'healthy': '💚',
            'warning': '⚠️ ',
            'critical': '🔴'
        }
        return emoji_map.get(status, '❓')
    
    def get_power_state_emoji(self, state):
        """Get emoji for power state"""
        emoji_map = {
            'charging': '🔌',
            'discharging': '⚡',
            'idle': '⏸️ ',
            'full': '✅'
        }
        return emoji_map.get(state, '❓')
    
    def create_bar(self, value, max_value=100, width=20):
        """Create a text-based progress bar"""
        filled = int((value / max_value) * width)
        bar = '█' * filled + '░' * (width - filled)
        return bar
    
    def display_dashboard(self):
        """Display the monitoring dashboard"""
        self.clear_screen()
        
        print("═" * 80)
        print("🖥️  IoT MODULE 1 - REAL-TIME MONITORING DASHBOARD".center(80))
        print("═" * 80)
        
        # Header info
        print(f"\n⏱️  Uptime: {self.format_uptime()}")
        print(f"📊 Messages Received: {self.message_count}")
        print(f"🔗 Connected Nodes: {len(self.latest_data)}")
        print(f"🕐 Last Update: {datetime.utcnow().strftime('%H:%M:%S')}")
        
        if not self.latest_data:
            print("\n⏳ Waiting for telemetry data...\n")
            print("═" * 80)
            return
        
        # Display each node's data
        for dc_id, data in self.latest_data.items():
            print("\n" + "─" * 80)
            print(f"📍 DATA CENTER: {dc_id} ({data.get('hostname', 'unknown')})")
            print("─" * 80)
            
            # Power & Load Section
            print("\n⚡ POWER & LOAD")
            power_kw = data.get('power_kw', 0)
            load = data.get('load', 0)
            load_avg = data.get('load_average', 0)
            
            print(f"   Power:        {power_kw:.3f} kW")
            print(f"   CPU Load:     {load:.1f}%  {self.create_bar(load)}")
            print(f"   Load Average: {load_avg:.2f}")
            
            # Battery Section
            print("\n🔋 BATTERY STATUS")
            soc = data.get('soc', 0)
            voltage = data.get('voltage', 0)
            charging = data.get('charging', False)
            capacity = data.get('capacity_kwh', 0)
            
            charge_status = "🔌 Charging" if charging else "📉 Discharging"
            print(f"   State:        {charge_status}")
            print(f"   SOC:          {soc:.1f}%  {self.create_bar(soc)}")
            print(f"   Voltage:      {voltage:.2f} V")
            print(f"   Capacity:     {capacity:.1f} kWh")
            
            # Grid Section
            print("\n🌊 GRID STATUS")
            freq = data.get('freq', 0)
            power_state = data.get('power_state', 'unknown')
            health = data.get('health_status', 'unknown')
            
            print(f"   Frequency:    {freq:.3f} Hz")
            print(f"   Power State:  {self.get_power_state_emoji(power_state)} {power_state.title()}")
            print(f"   Health:       {self.get_health_emoji(health)} {health.title()}")
            
            # System Resources Section
            print("\n💻 SYSTEM RESOURCES")
            cpu_freq = data.get('cpu_freq_mhz', 0)
            mem_percent = data.get('memory_percent', 0)
            mem_used = data.get('memory_used_gb', 0)
            
            print(f"   CPU Freq:     {cpu_freq:.0f} MHz")
            print(f"   Memory:       {mem_percent:.1f}%  {self.create_bar(mem_percent)}")
            print(f"   Memory Used:  {mem_used:.2f} GB")
            
            # Network Section
            if 'network_sent_mb' in data:
                print("\n🌐 NETWORK")
                net_sent = data.get('network_sent_mb', 0)
                net_recv = data.get('network_recv_mb', 0)
                print(f"   Sent:         {net_sent:.2f} MB")
                print(f"   Received:     {net_recv:.2f} MB")
            
            # Timestamp
            timestamp = data.get('timestamp', '')
            if timestamp:
                print(f"\n🕐 Last Updated: {timestamp}")
        
        print("\n" + "═" * 80)
        print("Press Ctrl+C to exit".center(80))
        print("═" * 80)
    
    async def connect_and_monitor(self):
        """Connect to gateway and monitor telemetry"""
        retry_delay = 5
        
        while True:
            try:
                print(f"🔄 Connecting to gateway at {self.server_uri}...")
                
                async with websockets.connect(self.server_uri) as websocket:
                    print(f"✅ Connected! Starting monitor...\n")
                    
                    # Send a monitoring subscription message
                    subscribe_msg = {
                        'type': 'monitor',
                        'client': 'dashboard',
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    }
                    await websocket.send(json.dumps(subscribe_msg))
                    
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            
                            # Update latest data
                            dc_id = data.get('dc_id', 'unknown')
                            self.latest_data[dc_id] = data
                            self.message_count += 1
                            
                            # Update display
                            self.display_dashboard()
                            
                        except json.JSONDecodeError as e:
                            print(f"❌ Invalid JSON: {e}")
                            
            except ConnectionRefusedError:
                self.clear_screen()
                print(f"❌ Connection refused. Is the gateway running?")
                print(f"⏳ Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                
            except Exception as e:
                self.clear_screen()
                print(f"❌ Error: {e}")
                print(f"⏳ Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)


def main():
    """Entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='IoT Module 1 Monitoring Dashboard')
    parser.add_argument('--server', default='ws://localhost:8765',
                        help='WebSocket server URI (default: ws://localhost:8765)')
    args = parser.parse_args()
    
    print("=" * 80)
    print("🖥️  IoT MODULE 1 - MONITORING DASHBOARD")
    print("=" * 80)
    print(f"Server: {args.server}")
    print("=" * 80)
    
    dashboard = MonitorDashboard(server_uri=args.server)
    
    try:
        asyncio.run(dashboard.connect_and_monitor())
    except KeyboardInterrupt:
        dashboard.clear_screen()
        print("\n⛔ Dashboard stopped by user")
        print("\n📊 Session Statistics:")
        print(f"   Total Messages: {dashboard.message_count}")
        print(f"   Uptime: {dashboard.format_uptime()}")
        print(f"   Nodes Monitored: {len(dashboard.latest_data)}")


if __name__ == "__main__":
    main()