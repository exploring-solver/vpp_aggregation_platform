"""
Modbus TCP/RTU Client for BESS Communication
Supports reading telemetry and writing control commands to BESS controllers
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

# For production, install: pip install pymodbus
try:
    from pymodbus.client import ModbusTcpClient, ModbusSerialClient
    from pymodbus.exceptions import ModbusException
    MODBUS_AVAILABLE = True
except ImportError:
    MODBUS_AVAILABLE = False
    logging.warning("pymodbus not installed. Running in simulation mode.")

logger = logging.getLogger(__name__)


class ModbusRegisterMap(Enum):
    """Standard Modbus register mappings for BESS controllers"""
    # Read-only registers (Input Registers - Function Code 4)
    SOC = 0x1000                    # State of Charge (%)
    SOH = 0x1001                    # State of Health (%)
    VOLTAGE = 0x1002                # Battery voltage (V * 10)
    CURRENT = 0x1003                # Battery current (A * 10, signed)
    TEMPERATURE = 0x1004            # Battery temperature (°C * 10)
    POWER = 0x1005                  # Active power (kW * 10, signed)
    REACTIVE_POWER = 0x1006         # Reactive power (kVAR * 10)
    FREQUENCY = 0x1007              # Grid frequency (Hz * 100)

    # Status registers
    STATUS_WORD = 0x1010            # Status bits
    ALARM_WORD = 0x1011             # Alarm bits
    FAULT_WORD = 0x1012             # Fault bits

    # Capacity info
    CAPACITY_KWH = 0x1020           # Total capacity (kWh * 10)
    CAPACITY_KW = 0x1021            # Max power (kW * 10)
    CYCLE_COUNT = 0x1022            # Charge cycles

    # Write registers (Holding Registers - Function Code 3/6/16)
    POWER_SETPOINT = 0x2000         # Power setpoint (kW * 10, signed)
    REACTIVE_SETPOINT = 0x2001      # Reactive power setpoint (kVAR * 10)
    CONTROL_MODE = 0x2002           # 0=Off, 1=Charge, 2=Discharge, 3=Auto
    ENABLE = 0x2003                 # 0=Disable, 1=Enable
    RESET_ALARM = 0x2004            # Write 1 to reset alarms


@dataclass
class BESSStatus:
    """BESS telemetry and status"""
    soc: float                      # State of Charge (%)
    soh: float                      # State of Health (%)
    voltage: float                  # Voltage (V)
    current: float                  # Current (A)
    temperature: float              # Temperature (°C)
    power_kw: float                 # Active power (kW)
    reactive_power_kvar: float      # Reactive power (kVAR)
    frequency: float                # Grid frequency (Hz)
    status: int                     # Status word
    alarms: int                     # Alarm word
    faults: int                     # Fault word
    capacity_kwh: float             # Capacity (kWh)
    max_power_kw: float             # Max power (kW)
    cycle_count: int                # Charge cycles

    def has_alarms(self) -> bool:
        return self.alarms != 0

    def has_faults(self) -> bool:
        return self.faults != 0

    def is_healthy(self) -> bool:
        return not self.has_faults() and self.soh > 70.0


class ModbusBESSClient:
    """Modbus client for BESS hardware communication"""

    def __init__(self, host: str, port: int = 502, unit_id: int = 1, timeout: int = 5):
        """
        Initialize Modbus client

        Args:
            host: Modbus server IP address
            port: Modbus TCP port (default 502)
            unit_id: Modbus unit/slave ID
            timeout: Connection timeout in seconds
        """
        self.host = host
        self.port = port
        self.unit_id = unit_id
        self.timeout = timeout
        self.client: Optional[ModbusTcpClient] = None
        self.connected = False

    async def connect(self) -> bool:
        """Establish Modbus connection"""
        if not MODBUS_AVAILABLE:
            logger.error("pymodbus not installed. Cannot connect to real hardware.")
            return False

        try:
            self.client = ModbusTcpClient(
                host=self.host,
                port=self.port,
                timeout=self.timeout
            )
            self.connected = self.client.connect()

            if self.connected:
                logger.info(f"Connected to BESS at {self.host}:{self.port}")
            else:
                logger.error(f"Failed to connect to BESS at {self.host}:{self.port}")

            return self.connected
        except Exception as e:
            logger.error(f"Modbus connection error: {e}")
            return False

    async def disconnect(self):
        """Close Modbus connection"""
        if self.client:
            self.client.close()
            self.connected = False
            logger.info(f"Disconnected from BESS at {self.host}:{self.port}")

    async def read_bess_status(self) -> Optional[BESSStatus]:
        """Read complete BESS telemetry"""
        if not self.connected:
            logger.error("Not connected to Modbus server")
            return None

        try:
            # Read input registers (telemetry data)
            result = self.client.read_input_registers(
                address=ModbusRegisterMap.SOC.value,
                count=35,  # Read all telemetry registers
                unit=self.unit_id
            )

            if result.isError():
                logger.error(f"Modbus read error: {result}")
                return None

            registers = result.registers

            # Parse registers
            status = BESSStatus(
                soc=registers[0] / 10.0,
                soh=registers[1] / 10.0,
                voltage=registers[2] / 10.0,
                current=self._to_signed(registers[3]) / 10.0,
                temperature=registers[4] / 10.0,
                power_kw=self._to_signed(registers[5]) / 10.0,
                reactive_power_kvar=self._to_signed(registers[6]) / 10.0,
                frequency=registers[7] / 100.0,
                status=registers[16],
                alarms=registers[17],
                faults=registers[18],
                capacity_kwh=registers[32] / 10.0,
                max_power_kw=registers[33] / 10.0,
                cycle_count=registers[34]
            )

            return status

        except Exception as e:
            logger.error(f"Error reading BESS status: {e}")
            return None

    async def write_power_setpoint(self, power_kw: float) -> bool:
        """
        Write power setpoint to BESS

        Args:
            power_kw: Power setpoint in kW (positive=charge, negative=discharge)

        Returns:
            True if successful
        """
        if not self.connected:
            logger.error("Not connected to Modbus server")
            return False

        try:
            # Convert to register value (kW * 10)
            setpoint_raw = int(power_kw * 10)

            # Write single holding register
            result = self.client.write_register(
                address=ModbusRegisterMap.POWER_SETPOINT.value,
                value=setpoint_raw,
                unit=self.unit_id
            )

            if result.isError():
                logger.error(f"Modbus write error: {result}")
                return False

            logger.info(f"Power setpoint written: {power_kw} kW")
            return True

        except Exception as e:
            logger.error(f"Error writing power setpoint: {e}")
            return False

    async def set_control_mode(self, mode: int) -> bool:
        """
        Set BESS control mode

        Args:
            mode: 0=Off, 1=Charge, 2=Discharge, 3=Auto

        Returns:
            True if successful
        """
        if not self.connected:
            return False

        try:
            result = self.client.write_register(
                address=ModbusRegisterMap.CONTROL_MODE.value,
                value=mode,
                unit=self.unit_id
            )

            if result.isError():
                logger.error(f"Modbus write error: {result}")
                return False

            logger.info(f"Control mode set to: {mode}")
            return True

        except Exception as e:
            logger.error(f"Error setting control mode: {e}")
            return False

    async def enable_bess(self, enable: bool = True) -> bool:
        """Enable or disable BESS"""
        if not self.connected:
            return False

        try:
            result = self.client.write_register(
                address=ModbusRegisterMap.ENABLE.value,
                value=1 if enable else 0,
                unit=self.unit_id
            )

            if result.isError():
                return False

            logger.info(f"BESS {'enabled' if enable else 'disabled'}")
            return True

        except Exception as e:
            logger.error(f"Error enabling BESS: {e}")
            return False

    async def reset_alarms(self) -> bool:
        """Reset BESS alarms"""
        if not self.connected:
            return False

        try:
            result = self.client.write_register(
                address=ModbusRegisterMap.RESET_ALARM.value,
                value=1,
                unit=self.unit_id
            )

            if result.isError():
                return False

            logger.info("Alarms reset")
            return True

        except Exception as e:
            logger.error(f"Error resetting alarms: {e}")
            return False

    @staticmethod
    def _to_signed(value: int) -> int:
        """Convert unsigned 16-bit to signed"""
        if value > 32767:
            return value - 65536
        return value


# Simulated Modbus client for development
class SimulatedModbusClient(ModbusBESSClient):
    """Simulated Modbus client for testing without hardware"""

    def __init__(self, host: str, port: int = 502, unit_id: int = 1, timeout: int = 5):
        super().__init__(host, port, unit_id, timeout)
        self.sim_soc = 80.0
        self.sim_power = 0.0
        self.sim_temperature = 25.0

    async def connect(self) -> bool:
        """Simulate connection"""
        logger.info(f"[SIMULATED] Connected to BESS at {self.host}:{self.port}")
        self.connected = True
        return True

    async def read_bess_status(self) -> Optional[BESSStatus]:
        """Return simulated telemetry"""
        if not self.connected:
            return None

        # Simulate SOC change based on power
        if self.sim_power != 0:
            # Assuming 200 kWh capacity, update every second
            soc_delta = (self.sim_power / 200.0) * (1.0 / 3600.0) * 100.0
            self.sim_soc = max(0.0, min(100.0, self.sim_soc + soc_delta))

        return BESSStatus(
            soc=self.sim_soc,
            soh=95.0,
            voltage=480.0,
            current=self.sim_power / 0.48 if self.sim_power != 0 else 0.0,
            temperature=self.sim_temperature,
            power_kw=self.sim_power,
            reactive_power_kvar=0.0,
            frequency=50.0,
            status=0x01,  # Online
            alarms=0x00,
            faults=0x00,
            capacity_kwh=200.0,
            max_power_kw=100.0,
            cycle_count=150
        )

    async def write_power_setpoint(self, power_kw: float) -> bool:
        """Simulate power setpoint"""
        if not self.connected:
            return False

        self.sim_power = max(-100.0, min(100.0, power_kw))
        logger.info(f"[SIMULATED] Power setpoint: {self.sim_power} kW")
        return True

    async def set_control_mode(self, mode: int) -> bool:
        """Simulate control mode"""
        logger.info(f"[SIMULATED] Control mode: {mode}")
        return True

    async def enable_bess(self, enable: bool = True) -> bool:
        """Simulate enable/disable"""
        logger.info(f"[SIMULATED] BESS {'enabled' if enable else 'disabled'}")
        return True

    async def reset_alarms(self) -> bool:
        """Simulate alarm reset"""
        logger.info(f"[SIMULATED] Alarms reset")
        return True
