import psutil
import random
import time
from datetime import datetime
from typing import Dict, Any

class TelemetrySimulator:
    """Simulates edge node telemetry including battery, power, and system metrics"""
    
    def __init__(self, dc_id: str):
        self.dc_id = dc_id
        self.start_time = time.time()
        
        # Battery state
        self.soc = random.uniform(60.0, 90.0)  # State of Charge %
        self.battery_kwh = random.uniform(150, 250)  # Total capacity
        self.charge_rate = 0.0  # kW charging/discharging
        
        # Power state
        self.power_kw = random.uniform(80.0, 120.0)
        self.base_power = self.power_kw
        
        # Grid frequency
        self.freq = 50.0 + random.uniform(-0.1, 0.1)
        
        # Load state
        self.load_factor = random.uniform(0.6, 0.9)
        
        # Network baseline
        self.net_io_start = psutil.net_io_counters()
        
        # System capacity (for node registration)
        self.capacity_kw = random.uniform(100, 200)  # Node capacity in kW
        
    def get_uptime(self) -> float:
        return time.time() - self.start_time
    
    def apply_control(self, action: str, params: Dict[str, Any]):
        """Apply control actions to modify simulator state"""
        if action == "charge":
            target_kw = params.get("kw", 20)
            self.charge_rate = min(target_kw, self.battery_kwh * 0.2)  # Max 20% C-rate
            print(f"Charging at {self.charge_rate} kW")
            
        elif action == "discharge":
            target_kw = params.get("kw", 20)
            self.charge_rate = -min(target_kw, self.battery_kwh * 0.2)
            print(f"Discharging at {abs(self.charge_rate)} kW")
            
        elif action == "defer_load":
            defer_pct = params.get("percent", 10)
            self.load_factor = max(0.1, self.load_factor - defer_pct / 100)
            print(f"Load deferred by {defer_pct}%")
            
        elif action == "hold":
            self.charge_rate = 0.0
            print("Holding current state")
    
    def generate_telemetry(self) -> Dict[str, Any]:
        """Generate realistic telemetry data"""
        
        # Update SOC based on charge rate (every 5 seconds assumed)
        interval_hours = 5 / 3600  # 5 seconds to hours
        if self.battery_kwh > 0:
            soc_delta = (self.charge_rate * interval_hours / self.battery_kwh) * 100
            self.soc = max(0.0, min(100.0, self.soc + soc_delta))
        
        # Simulate frequency variation
        self.freq += random.uniform(-0.02, 0.02)
        self.freq = max(49.7, min(50.3, self.freq))
        
        # Power consumption varies with load factor
        self.power_kw = self.base_power * self.load_factor + random.uniform(-5, 5)
        
        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=0.1)
        
        # Network I/O
        net_io = psutil.net_io_counters()
        net_sent_mb = (net_io.bytes_sent - self.net_io_start.bytes_sent) / (1024 * 1024)
        net_recv_mb = (net_io.bytes_recv - self.net_io_start.bytes_recv) / (1024 * 1024)
        
        # Get system stats using psutil
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            
            # Memory
            memory = psutil.virtual_memory()
            ram_total_gb = memory.total / (1024**3)
            ram_used_gb = memory.used / (1024**3)
            ram_percent = memory.percent
            
            # Disk
            disk = psutil.disk_usage('/')
            disk_total_gb = disk.total / (1024**3)
            disk_used_gb = disk.used / (1024**3)
            disk_percent = disk.percent
            
            # Battery (if available, e.g., on laptops)
            battery_info = None
            try:
                battery = psutil.sensors_battery()
                if battery:
                    battery_info = {
                        "percent": battery.percent,
                        "plugged": battery.power_plugged,
                        "secsleft": battery.secsleft if battery.secsleft else None
                    }
            except (AttributeError, NotImplementedError):
                pass  # Battery not available on this system
            
            # System load (Unix-like systems)
            try:
                load_avg = psutil.getloadavg()
            except (AttributeError, OSError):
                load_avg = None
            
        except Exception as e:
            # Fallback if psutil fails
            cpu_percent = cpu_usage
            cpu_count = 1
            ram_total_gb = 16.0
            ram_used_gb = 8.0
            ram_percent = 50.0
            disk_total_gb = 500.0
            disk_used_gb = 250.0
            disk_percent = 50.0
            battery_info = None
            load_avg = None
        
        # Construct telemetry payload
        telemetry = {
            "dc_id": self.dc_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "cpu_usage": round(cpu_usage, 2),
            "network_mb_sent": round(net_sent_mb, 4),
            "network_mb_recv": round(net_recv_mb, 4),
            "soc": round(self.soc, 2),
            "power_kw": round(self.power_kw, 2),
            "freq": round(self.freq, 3),
            "load_factor": round(self.load_factor, 3),
            "charge_rate_kw": round(self.charge_rate, 2),
            # System stats
            "system": {
                "cpu": {
                    "percent": round(cpu_percent, 2),
                    "count": cpu_count,
                    "load_avg": list(load_avg) if load_avg else None
                },
                "memory": {
                    "total_gb": round(ram_total_gb, 2),
                    "used_gb": round(ram_used_gb, 2),
                    "percent": round(ram_percent, 2),
                    "available_gb": round(ram_total_gb - ram_used_gb, 2)
                },
                "disk": {
                    "total_gb": round(disk_total_gb, 2),
                    "used_gb": round(disk_used_gb, 2),
                    "percent": round(disk_percent, 2),
                    "free_gb": round(disk_total_gb - disk_used_gb, 2)
                },
                "battery": battery_info
            },
            "meta": {
                "sim": True,
                "battery_kwh": self.battery_kwh,
                "capacity_kw": self.capacity_kw,
                "uptime": int(self.get_uptime())
            }
        }
        
        return telemetry
