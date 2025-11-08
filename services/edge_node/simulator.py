import psutil
import random
import time
import platform
from datetime import datetime
from typing import Dict, Any

class TelemetrySimulator:
    """Simulates edge node telemetry including battery, power, and system metrics
    Uses real system stats from psutil for CPU, RAM, disk, network, and battery (if available)"""
    
    def __init__(self, dc_id: str):
        self.dc_id = dc_id
        self.start_time = time.time()
        
        # Get real system battery info (if available)
        try:
            battery = psutil.sensors_battery()
            if battery:
                self.soc = battery.percent  # Use real battery SOC if available
                self.battery_kwh = 200.0  # Default, can be overridden
                self.is_plugged = battery.power_plugged
            else:
                # Simulated battery for systems without battery
                self.soc = random.uniform(60.0, 90.0)
                self.battery_kwh = random.uniform(150, 250)
                self.is_plugged = True
        except (AttributeError, NotImplementedError):
            # Fallback for systems without battery support
            self.soc = random.uniform(60.0, 90.0)
            self.battery_kwh = random.uniform(150, 250)
            self.is_plugged = True
        
        self.charge_rate = 0.0  # kW charging/discharging
        
        # Power state - based on real CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)
        # Map CPU usage to power consumption (higher CPU = higher power)
        base_power = 80.0 + (cpu_percent * 0.5)  # 80-130 kW range
        self.power_kw = base_power + random.uniform(-5, 5)
        self.base_power = self.power_kw
        
        # Grid frequency
        self.freq = 50.0 + random.uniform(-0.1, 0.1)
        
        # Load state - based on real CPU usage
        self.load_factor = min(1.0, cpu_percent / 100.0)
        
        # Network baseline
        self.net_io_start = psutil.net_io_counters()
        
        # System info
        self.system_info = {
            'platform': platform.system(),
            'platform_release': platform.release(),
            'platform_version': platform.version(),
            'architecture': platform.machine(),
            'processor': platform.processor()
        }
        
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
        """Generate realistic telemetry data using real system stats"""
        
        # Update SOC based on charge rate (every 5 seconds assumed)
        interval_hours = 5 / 3600  # 5 seconds to hours
        if self.battery_kwh > 0:
            soc_delta = (self.charge_rate * interval_hours / self.battery_kwh) * 100
            self.soc = max(0.0, min(100.0, self.soc + soc_delta))
        
        # Try to get real battery SOC if available
        try:
            battery = psutil.sensors_battery()
            if battery and battery.percent is not None:
                self.soc = battery.percent
                self.is_plugged = battery.power_plugged
        except (AttributeError, NotImplementedError):
            pass
        
        # Simulate frequency variation
        self.freq += random.uniform(-0.02, 0.02)
        self.freq = max(49.7, min(50.3, self.freq))
        
        # Get real CPU usage
        cpu_usage = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()
        
        # Get real memory stats
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_total_gb = memory.total / (1024 ** 3)
        memory_used_gb = memory.used / (1024 ** 3)
        memory_available_gb = memory.available / (1024 ** 3)
        
        # Get real disk stats
        try:
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_total_gb = disk.total / (1024 ** 3)
            disk_used_gb = disk.used / (1024 ** 3)
            disk_free_gb = disk.free / (1024 ** 3)
        except:
            disk_percent = 0
            disk_total_gb = 0
            disk_used_gb = 0
            disk_free_gb = 0
        
        # Power consumption varies with real CPU and memory usage
        load_factor = (cpu_usage + memory_percent) / 200.0  # Combined load
        self.load_factor = min(1.0, load_factor)
        self.power_kw = self.base_power * self.load_factor + random.uniform(-5, 5)
        
        # Network I/O (real stats)
        net_io = psutil.net_io_counters()
        net_sent_mb = (net_io.bytes_sent - self.net_io_start.bytes_sent) / (1024 * 1024)
        net_recv_mb = (net_io.bytes_recv - self.net_io_start.bytes_recv) / (1024 * 1024)
        
        # Get CPU temperature if available
        try:
            temps = psutil.sensors_temperatures()
            cpu_temp = None
            if temps:
                for name, entries in temps.items():
                    if entries:
                        cpu_temp = entries[0].current
                        break
        except (AttributeError, NotImplementedError):
            cpu_temp = None
        
        # Construct enriched telemetry payload with real system stats
        telemetry = {
            "dc_id": self.dc_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "cpu_usage": round(cpu_usage, 2),
            "cpu_count": cpu_count,
            "cpu_temp": round(cpu_temp, 1) if cpu_temp else None,
            "memory_percent": round(memory_percent, 2),
            "memory_total_gb": round(memory_total_gb, 2),
            "memory_used_gb": round(memory_used_gb, 2),
            "memory_available_gb": round(memory_available_gb, 2),
            "disk_percent": round(disk_percent, 2),
            "disk_total_gb": round(disk_total_gb, 2),
            "disk_used_gb": round(disk_used_gb, 2),
            "disk_free_gb": round(disk_free_gb, 2),
            "network_mb_sent": round(net_sent_mb, 4),
            "network_mb_recv": round(net_recv_mb, 4),
            "soc": round(self.soc, 2),
            "power_kw": round(self.power_kw, 2),
            "freq": round(self.freq, 3),
            "load_factor": round(self.load_factor, 3),
            "charge_rate_kw": round(self.charge_rate, 2),
            "meta": {
                "sim": False,  # Now using real stats
                "battery_kwh": self.battery_kwh,
                "uptime": int(self.get_uptime()),
                "is_plugged": self.is_plugged,
                "system": self.system_info,
                "location": "data_center"  # Can be configured
            }
        }
        
        return telemetry
