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
            print("\n📭 No data received yet. Waiting for updates...")
            return
        
        # Display each node's data
        for dc_id, data in self.latest_data.items():
            print("\n" + "─" * 80)
            print(f"📍 Node: {dc_id} ({data.get('hostname', 'unknown')})")
            print("─" * 80)
            
            # Power & Load
            print(f"\n⚡ Power: {data['power_kw']:.2f} kW")
            print(f"📊 Load:  {self.create_bar(data['load'])} {data['load']:.1f}%")
            
            # Battery Status
            print(f"\n🔋 Battery SOC: {self.create_bar(data['soc'])} {data['soc']:.1f}%")
            print(f"⚡ Voltage: {data['voltage']:.1f}V")
            print(f"📊 State: {self.get_power_state_emoji(data['power_state'])} {data['power_state']}")
            
            # Grid Status
            print(f"\n🌊 Frequency: {data['freq']:.2f} Hz")
            print(f"💚 Health: {self.get_health_emoji(data['health_status'])} {data['health_status']}")

    async def connect_and_monitor(self):
        """Connect to WebSocket server and monitor data"""
        while True:
            try:
                async with websockets.connect(self.server_uri) as websocket:
                    print(f"🔗 Connected to {self.server_uri}")
                    
                    # Send initial identification message as monitor client
                    await websocket.send(json.dumps({
                        "type": "monitor",
                        "client_type": "dashboard",
                        "timestamp": datetime.utcnow().isoformat() + 'Z'
                    }))
                    
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            
                            # Extract dc_id and update latest data
                            if isinstance(data, dict) and 'dc_id' in data:
                                dc_id = data['dc_id']
                                self.latest_data[dc_id] = data
                                self.message_count += 1
                                
                                # Update display after each message
                                self.display_dashboard()
                                
                        except json.JSONDecodeError as e:
                            print(f"❌ Invalid JSON received: {e}")
                            continue
                        
            # If we get here, connection was closed
                    print("📡 Connection lost. Reconnecting in 5 seconds...")
                    await asyncio.sleep(5)
            
            except websockets.exceptions.ConnectionClosed:
                print("📡 Connection lost. Reconnecting in 5 seconds...")
                await asyncio.sleep(5)
            except Exception as e:
                print(f"❌ Error: {e}")
                await asyncio.sleep(5)

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
        print("\n👋 Dashboard stopped by user")

if __name__ == "__main__":
    main()