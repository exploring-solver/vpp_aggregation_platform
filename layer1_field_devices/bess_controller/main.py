"""
BESS Controller - Main Service
Integrates Modbus, BMS, Inverter, and Safety systems
Provides unified interface for BESS hardware control
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

# Import BESS subsystems
from modbus_interface.modbus_client import ModbusBESSClient, SimulatedModbusClient, BESSStatus
from bms_integration.bms_parser import BMSParser, SimulatedBMS, PackData
from inverter_control.sunspec_inverter import SunSpecInverter, SimulatedInverter
from safety_manager.safety_interlocks import SafetyManager, SafetyLimits, SafetyViolation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
BESS_ID = os.getenv("BESS_ID", "BESS_DC01_01")
CAMPUS_ID = os.getenv("CAMPUS_ID", "CAMPUS_MUMBAI_ANDHERI")
MODE = os.getenv("MODE", "simulation")  # 'hardware' or 'simulation'
MQTT_BROKER = os.getenv("MQTT_BROKER_URL", "mqtt://localhost:1883")
AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", "http://localhost:3000")
TELEMETRY_INTERVAL = int(os.getenv("TELEMETRY_INTERVAL", "5"))

# Modbus configuration (for hardware mode)
MODBUS_HOST = os.getenv("MODBUS_HOST", "192.168.1.100")
MODBUS_PORT = int(os.getenv("MODBUS_PORT", "502"))
MODBUS_UNIT_ID = int(os.getenv("MODBUS_UNIT_ID", "1"))


# FastAPI app
app = FastAPI(title="BESS Controller", version="1.0.0")


# Request models
class PowerSetpoint(BaseModel):
    power_kw: float
    reactive_power_kvar: float = 0.0


class ControlCommand(BaseModel):
    action: str  # 'enable', 'disable', 'reset_alarms', 'emergency_stop'
    params: Dict[str, Any] = {}


# BESS Controller class
class BESSController:
    """Main BESS controller integrating all subsystems"""

    def __init__(self):
        self.bess_id = BESS_ID
        self.campus_id = CAMPUS_ID
        self.mode = MODE

        # Initialize subsystems
        if MODE == "simulation":
            logger.info("Starting in SIMULATION mode")
            self.modbus = SimulatedModbusClient(MODBUS_HOST, MODBUS_PORT, MODBUS_UNIT_ID)
            self.bms = SimulatedBMS(num_cells=16, num_temp_sensors=8)
            self.inverter = SimulatedInverter()
        else:
            logger.info("Starting in HARDWARE mode")
            self.modbus = ModbusBESSClient(MODBUS_HOST, MODBUS_PORT, MODBUS_UNIT_ID)
            self.bms = BMSParser(num_cells=16, num_temp_sensors=8)
            self.inverter = SunSpecInverter(self.modbus)

        # Safety manager
        self.safety = SafetyManager(limits=SafetyLimits())

        # State
        self.last_telemetry: Optional[Dict] = None
        self.is_running = False
        self.enabled = False

        # MQTT client (if available)
        self.mqtt_client = None

    async def start(self):
        """Start BESS controller"""
        logger.info(f"Starting BESS Controller: {self.bess_id}")

        # Connect to hardware
        connected = await self.modbus.connect()
        if not connected and MODE == "hardware":
            logger.error("Failed to connect to BESS hardware")
            raise ConnectionError("Cannot connect to BESS")

        # Enable inverter
        await self.inverter.enable()

        # Register with aggregator
        await self.register_with_aggregator()

        self.is_running = True
        logger.info("BESS Controller started successfully")

    async def stop(self):
        """Stop BESS controller"""
        logger.info("Stopping BESS Controller")

        # Disable inverter
        await self.inverter.disable()

        # Disconnect from hardware
        await self.modbus.disconnect()

        self.is_running = False
        logger.info("BESS Controller stopped")

    async def register_with_aggregator(self):
        """Register this BESS with the aggregator backend"""
        try:
            # Get BESS capacity
            status = await self.modbus.read_bess_status()
            capacity_kwh = status.capacity_kwh if status else 200.0
            max_power_kw = status.max_power_kw if status else 100.0

            payload = {
                "node_id": self.bess_id,
                "campus_id": self.campus_id,
                "type": "bess",
                "mode": self.mode,
                "capacity_kwh": capacity_kwh,
                "max_power_kw": max_power_kw,
                "status": "online"
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{AGGREGATOR_URL}/api/nodes/register",
                    json=payload,
                    timeout=10.0
                )

                if response.status_code == 200:
                    logger.info(f"Registered with aggregator: {self.bess_id}")
                else:
                    logger.warning(f"Failed to register with aggregator: {response.status_code}")

        except Exception as e:
            logger.error(f"Error registering with aggregator: {e}")

    async def collect_telemetry(self) -> Dict[str, Any]:
        """Collect complete BESS telemetry"""

        # Read Modbus telemetry
        modbus_status = await self.modbus.read_bess_status()
        if not modbus_status:
            logger.error("Failed to read Modbus telemetry")
            return None

        # Read BMS data
        pack_data = self.bms.get_pack_data()
        bms_alarms = self.bms.get_alarms()

        # Read inverter telemetry
        inverter_data = await self.inverter.read_telemetry()

        # Build telemetry payload
        telemetry = {
            "bess_id": self.bess_id,
            "campus_id": self.campus_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "mode": self.mode,

            # Battery state
            "soc": modbus_status.soc,
            "soh": modbus_status.soh,
            "voltage": modbus_status.voltage,
            "current": modbus_status.current,
            "temperature": modbus_status.temperature,
            "power_kw": modbus_status.power_kw,
            "reactive_power_kvar": modbus_status.reactive_power_kvar if inverter_data else 0.0,
            "frequency": modbus_status.frequency,

            # Capacity
            "capacity_kwh": modbus_status.capacity_kwh,
            "max_power_kw": modbus_status.max_power_kw,
            "cycle_count": modbus_status.cycle_count,

            # Status
            "status": {
                "enabled": self.enabled,
                "online": True,
                "alarms": modbus_status.alarms,
                "faults": modbus_status.faults
            },

            # BMS details (if available)
            "bms": None,

            # Inverter details
            "inverter": None,

            # Safety status
            "safety": {
                "emergency_stopped": self.safety.is_emergency_stopped,
                "power_reduction_factor": self.safety.power_reduction_factor
            }
        }

        # Add BMS details if available
        if pack_data:
            telemetry["bms"] = {
                "pack_voltage": pack_data.pack_voltage,
                "pack_current": pack_data.pack_current,
                "min_cell_voltage": pack_data.min_cell_voltage,
                "max_cell_voltage": pack_data.max_cell_voltage,
                "voltage_delta": pack_data.voltage_delta,
                "max_cell_temperature": pack_data.max_cell_temperature,
                "is_balanced": pack_data.is_balanced,
                "num_cells": len(pack_data.cells),
                "alarms": {
                    "critical_fault": bms_alarms.has_critical_fault(),
                    "warnings": bms_alarms.has_warnings()
                }
            }

        # Add inverter details if available
        if inverter_data:
            telemetry["inverter"] = {
                "ac_power_kw": inverter_data.ac_power_kw,
                "ac_voltage": inverter_data.ac_voltage,
                "ac_current": inverter_data.ac_current,
                "ac_frequency": inverter_data.ac_frequency,
                "dc_voltage": inverter_data.dc_voltage,
                "dc_current": inverter_data.dc_current,
                "efficiency": inverter_data.efficiency,
                "temperature": inverter_data.temperature,
                "status": inverter_data.status.name
            }

        # Run safety checks
        violations = self.safety.check_safety(telemetry)
        if violations:
            telemetry["safety"]["violations"] = [
                {
                    "level": v.level.name,
                    "category": v.category,
                    "message": v.message,
                    "action": v.action.value
                }
                for v in violations
            ]

        self.last_telemetry = telemetry
        return telemetry

    async def set_power(self, power_kw: float, reactive_power_kvar: float = 0.0) -> bool:
        """
        Set BESS power setpoint

        Args:
            power_kw: Active power (positive=charge, negative=discharge)
            reactive_power_kvar: Reactive power

        Returns:
            True if successful
        """
        if self.safety.is_emergency_stopped:
            logger.error("Cannot set power: Emergency stop active")
            return False

        if not self.enabled:
            logger.error("Cannot set power: BESS not enabled")
            return False

        # Apply safety limits
        safe_power_kw = self.safety.apply_safety_limits(power_kw)

        # Write to Modbus
        success = await self.modbus.write_power_setpoint(safe_power_kw)
        if not success:
            return False

        # Write to inverter
        max_power_kw = self.last_telemetry.get('max_power_kw', 100.0) if self.last_telemetry else 100.0
        await self.inverter.set_power_limit(abs(safe_power_kw), max_power_kw)
        await self.inverter.set_reactive_power(reactive_power_kvar)

        # Update BMS simulation (if simulated)
        if isinstance(self.bms, SimulatedBMS):
            self.bms.update_simulation(safe_power_kw)

        logger.info(f"Power setpoint: {safe_power_kw:.2f} kW (requested: {power_kw:.2f} kW)")
        return True

    async def enable(self) -> bool:
        """Enable BESS"""
        if self.safety.is_emergency_stopped:
            logger.error("Cannot enable: Emergency stop active")
            return False

        await self.modbus.enable_bess(True)
        await self.inverter.enable()
        self.enabled = True
        logger.info("BESS enabled")
        return True

    async def disable(self) -> bool:
        """Disable BESS"""
        await self.modbus.enable_bess(False)
        await self.inverter.disable()
        self.enabled = False
        logger.info("BESS disabled")
        return True

    async def reset_alarms(self) -> bool:
        """Reset BESS alarms"""
        await self.modbus.reset_alarms()
        self.safety.reset()
        logger.info("Alarms reset")
        return True

    async def emergency_stop(self):
        """Emergency stop"""
        self.safety.emergency_shutdown()
        await self.disable()
        await self.set_power(0.0)
        logger.critical("EMERGENCY STOP ACTIVATED")

    async def publish_telemetry(self, telemetry: Dict[str, Any]):
        """Publish telemetry to aggregator"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{AGGREGATOR_URL}/api/telemetry",
                    json=telemetry,
                    timeout=5.0
                )

                if response.status_code != 200:
                    logger.warning(f"Failed to publish telemetry: {response.status_code}")

        except Exception as e:
            logger.error(f"Error publishing telemetry: {e}")


# Global controller instance
controller = BESSController()


# Background telemetry task
async def telemetry_loop():
    """Background task to collect and publish telemetry"""
    while controller.is_running:
        try:
            telemetry = await controller.collect_telemetry()
            if telemetry:
                await controller.publish_telemetry(telemetry)
        except Exception as e:
            logger.error(f"Error in telemetry loop: {e}")

        await asyncio.sleep(TELEMETRY_INTERVAL)


# FastAPI routes
@app.on_event("startup")
async def startup():
    """Start controller and background tasks"""
    await controller.start()
    asyncio.create_task(telemetry_loop())


@app.on_event("shutdown")
async def shutdown():
    """Stop controller"""
    await controller.stop()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "bess_id": controller.bess_id,
        "mode": controller.mode,
        "enabled": controller.enabled,
        "emergency_stopped": controller.safety.is_emergency_stopped
    }


@app.get("/telemetry")
async def get_telemetry():
    """Get latest telemetry"""
    if not controller.last_telemetry:
        raise HTTPException(status_code=503, detail="Telemetry not available yet")

    return controller.last_telemetry


@app.post("/power")
async def set_power_endpoint(setpoint: PowerSetpoint):
    """Set power setpoint"""
    success = await controller.set_power(setpoint.power_kw, setpoint.reactive_power_kvar)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to set power")

    return {"status": "success", "power_kw": setpoint.power_kw}


@app.post("/control")
async def control_endpoint(command: ControlCommand):
    """Execute control command"""
    if command.action == "enable":
        success = await controller.enable()
    elif command.action == "disable":
        success = await controller.disable()
    elif command.action == "reset_alarms":
        success = await controller.reset_alarms()
    elif command.action == "emergency_stop":
        await controller.emergency_stop()
        success = True
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {command.action}")

    return {"status": "success" if success else "failed", "action": command.action}


@app.get("/safety/violations")
async def get_safety_violations():
    """Get recent safety violations"""
    violations = controller.safety.get_violation_history(limit=50)

    return {
        "count": len(violations),
        "violations": [
            {
                "timestamp": v.timestamp.isoformat(),
                "level": v.level.name,
                "category": v.category,
                "message": v.message,
                "value": v.value,
                "limit": v.limit,
                "action": v.action.value
            }
            for v in violations
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
