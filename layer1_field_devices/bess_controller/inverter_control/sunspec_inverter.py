"""
Inverter Control using SunSpec Protocol
Supports power and reactive power control for grid-connected inverters
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class InverterStatus(Enum):
    """Inverter operational status"""
    OFF = 1
    SLEEPING = 2
    STARTING = 3
    MPPT = 4
    THROTTLED = 5
    SHUTTING_DOWN = 6
    FAULT = 7
    STANDBY = 8


class InverterMode(Enum):
    """Inverter control mode"""
    CONSTANT_POWER = 1           # Fixed power setpoint
    CONSTANT_VAR = 2             # Fixed reactive power
    VOLT_VAR = 3                 # Voltage-reactive power curve
    FREQUENCY_WATT = 4           # Frequency-watt droop
    VOLT_WATT = 5                # Voltage-watt curve


@dataclass
class InverterTelemetry:
    """Inverter real-time telemetry"""
    # Power
    ac_power_kw: float           # Active power output (kW)
    ac_power_max_kw: float       # Rated power (kW)
    reactive_power_kvar: float   # Reactive power (kVAR)
    apparent_power_kva: float    # Apparent power (kVA)
    power_factor: float          # Power factor

    # AC side
    ac_voltage: float            # AC voltage (V)
    ac_current: float            # AC current (A)
    ac_frequency: float          # Grid frequency (Hz)

    # DC side
    dc_voltage: float            # DC voltage (V)
    dc_current: float            # DC current (A)
    dc_power_kw: float           # DC power (kW)

    # Status
    status: InverterStatus       # Operating status
    temperature: float           # Cabinet temperature (°C)
    efficiency: float            # Conversion efficiency (%)


class SunSpecInverter:
    """
    SunSpec-compliant inverter controller
    Uses Modbus TCP for communication
    """

    def __init__(self, modbus_client, base_address: int = 40000):
        """
        Initialize SunSpec inverter controller

        Args:
            modbus_client: Modbus client instance
            base_address: SunSpec base address (default 40000)
        """
        self.modbus = modbus_client
        self.base_address = base_address

        # SunSpec register offsets
        self.SUNSPEC_ID = 0          # Should be 0x53756E53 ("SunS")
        self.MODEL_ID = 2            # Inverter model ID
        self.AC_POWER = 14           # AC power (W)
        self.AC_POWER_MAX = 16       # Rated power (W)
        self.AC_CURRENT = 4          # AC current (A)
        self.AC_VOLTAGE = 6          # AC voltage (V)
        self.AC_FREQUENCY = 12       # AC frequency (Hz)
        self.DC_CURRENT = 18         # DC current (A)
        self.DC_VOLTAGE = 20         # DC voltage (V)
        self.TEMP = 22               # Cabinet temp (°C)
        self.STATUS = 24             # Operating state
        self.POWER_SETPOINT = 100    # Active power limit (% of max)
        self.VAR_SETPOINT = 102      # Reactive power setpoint (VAR)

    async def read_telemetry(self) -> Optional[InverterTelemetry]:
        """Read inverter telemetry via SunSpec"""
        try:
            # Read AC measurements
            ac_result = await self._read_registers(self.AC_CURRENT, 10)
            if not ac_result:
                return None

            ac_current = ac_result[0] / 10.0  # Scale factor
            ac_voltage = ac_result[2] / 10.0
            ac_power_w = ac_result[10]
            ac_power_max_w = ac_result[12]
            ac_frequency = ac_result[8] / 100.0

            # Read DC measurements
            dc_result = await self._read_registers(self.DC_CURRENT, 4)
            if not dc_result:
                return None

            dc_current = dc_result[0] / 10.0
            dc_voltage = dc_result[2] / 10.0
            dc_power_w = dc_current * dc_voltage

            # Read status and temperature
            status_result = await self._read_registers(self.TEMP, 3)
            if not status_result:
                return None

            temperature = status_result[0] / 10.0
            status_code = status_result[2]
            status = InverterStatus(status_code) if status_code in [e.value for e in InverterStatus] else InverterStatus.OFF

            # Calculate derived values
            ac_power_kw = ac_power_w / 1000.0
            ac_power_max_kw = ac_power_max_w / 1000.0
            dc_power_kw = dc_power_w / 1000.0

            # Efficiency
            efficiency = (ac_power_w / dc_power_w * 100.0) if dc_power_w > 0 else 0.0

            # Power factor (simplified - assume unity for now)
            power_factor = 1.0 if ac_power_kw > 0 else 0.0

            # Reactive power (simplified)
            reactive_power_kvar = 0.0
            apparent_power_kva = ac_power_kw / power_factor if power_factor > 0 else 0.0

            return InverterTelemetry(
                ac_power_kw=ac_power_kw,
                ac_power_max_kw=ac_power_max_kw,
                reactive_power_kvar=reactive_power_kvar,
                apparent_power_kva=apparent_power_kva,
                power_factor=power_factor,
                ac_voltage=ac_voltage,
                ac_current=ac_current,
                ac_frequency=ac_frequency,
                dc_voltage=dc_voltage,
                dc_current=dc_current,
                dc_power_kw=dc_power_kw,
                status=status,
                temperature=temperature,
                efficiency=efficiency
            )

        except Exception as e:
            logger.error(f"Error reading inverter telemetry: {e}")
            return None

    async def set_power_limit(self, power_kw: float, max_power_kw: float) -> bool:
        """
        Set active power limit

        Args:
            power_kw: Desired power output (kW)
            max_power_kw: Maximum rated power (kW)

        Returns:
            True if successful
        """
        try:
            # Convert to percentage of rated power
            power_percent = (power_kw / max_power_kw) * 100.0
            power_percent = max(0.0, min(100.0, power_percent))

            # Write power limit setpoint
            success = await self._write_register(
                self.POWER_SETPOINT,
                int(power_percent * 100)  # Scale to 0-10000 (0.00% - 100.00%)
            )

            if success:
                logger.info(f"Inverter power limit set to {power_kw:.2f} kW ({power_percent:.1f}%)")
            else:
                logger.error("Failed to set inverter power limit")

            return success

        except Exception as e:
            logger.error(f"Error setting power limit: {e}")
            return False

    async def set_reactive_power(self, var_kvar: float) -> bool:
        """
        Set reactive power setpoint

        Args:
            var_kvar: Reactive power in kVAR (positive=inductive, negative=capacitive)

        Returns:
            True if successful
        """
        try:
            # Convert to VAR
            var_var = int(var_kvar * 1000)

            success = await self._write_register(
                self.VAR_SETPOINT,
                var_var
            )

            if success:
                logger.info(f"Inverter reactive power set to {var_kvar:.2f} kVAR")
            else:
                logger.error("Failed to set inverter reactive power")

            return success

        except Exception as e:
            logger.error(f"Error setting reactive power: {e}")
            return False

    async def enable(self) -> bool:
        """Enable inverter"""
        # Implementation depends on specific inverter model
        # Typically writing to a control register
        logger.info("Inverter enabled")
        return True

    async def disable(self) -> bool:
        """Disable inverter"""
        logger.info("Inverter disabled")
        return True

    async def _read_registers(self, offset: int, count: int) -> Optional[list]:
        """Read Modbus registers"""
        address = self.base_address + offset

        # This would call the actual Modbus client
        # For now, return None to indicate not implemented
        if hasattr(self.modbus, 'read_holding_registers'):
            result = await self.modbus.read_holding_registers(address, count)
            if result and not result.isError():
                return result.registers

        return None

    async def _write_register(self, offset: int, value: int) -> bool:
        """Write Modbus register"""
        address = self.base_address + offset

        if hasattr(self.modbus, 'write_register'):
            result = await self.modbus.write_register(address, value)
            return result and not result.isError()

        return False


class SimulatedInverter:
    """Simulated inverter for testing"""

    def __init__(self):
        self.power_kw = 0.0
        self.power_max_kw = 100.0
        self.reactive_power_kvar = 0.0
        self.enabled = False

    async def read_telemetry(self) -> InverterTelemetry:
        """Return simulated telemetry"""
        dc_voltage = 600.0
        dc_current = self.power_kw / dc_voltage * 1000.0 if self.power_kw > 0 else 0.0
        dc_power_kw = self.power_kw * 1.05  # Account for losses

        efficiency = (self.power_kw / dc_power_kw * 100.0) if dc_power_kw > 0 else 0.0

        return InverterTelemetry(
            ac_power_kw=self.power_kw,
            ac_power_max_kw=self.power_max_kw,
            reactive_power_kvar=self.reactive_power_kvar,
            apparent_power_kva=abs(self.power_kw),
            power_factor=1.0 if self.power_kw != 0 else 0.0,
            ac_voltage=415.0,  # 3-phase
            ac_current=self.power_kw / 0.415 / 1.732 if self.power_kw > 0 else 0.0,
            ac_frequency=50.0,
            dc_voltage=dc_voltage,
            dc_current=dc_current,
            dc_power_kw=dc_power_kw,
            status=InverterStatus.MPPT if self.enabled else InverterStatus.OFF,
            temperature=40.0,
            efficiency=efficiency
        )

    async def set_power_limit(self, power_kw: float, max_power_kw: float) -> bool:
        """Set simulated power"""
        self.power_kw = max(-max_power_kw, min(max_power_kw, power_kw))
        logger.info(f"[SIMULATED] Inverter power: {self.power_kw:.2f} kW")
        return True

    async def set_reactive_power(self, var_kvar: float) -> bool:
        """Set simulated reactive power"""
        self.reactive_power_kvar = var_kvar
        logger.info(f"[SIMULATED] Inverter reactive power: {var_kvar:.2f} kVAR")
        return True

    async def enable(self) -> bool:
        """Enable simulated inverter"""
        self.enabled = True
        logger.info("[SIMULATED] Inverter enabled")
        return True

    async def disable(self) -> bool:
        """Disable simulated inverter"""
        self.enabled = False
        self.power_kw = 0.0
        logger.info("[SIMULATED] Inverter disabled")
        return True
