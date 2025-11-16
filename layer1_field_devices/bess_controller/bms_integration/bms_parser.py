"""
Battery Management System (BMS) Integration
Parses CAN bus messages from BMS for cell-level monitoring
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class BMSMessageID(Enum):
    """Standard CAN message IDs for BMS communication"""
    CELL_VOLTAGES_1 = 0x100     # Cells 1-4
    CELL_VOLTAGES_2 = 0x101     # Cells 5-8
    CELL_VOLTAGES_3 = 0x102     # Cells 9-12
    CELL_VOLTAGES_4 = 0x103     # Cells 13-16

    CELL_TEMPS_1 = 0x110        # Temps 1-4
    CELL_TEMPS_2 = 0x111        # Temps 5-8

    PACK_STATUS = 0x120         # Pack voltage, current, SOC
    PACK_LIMITS = 0x121         # Max charge/discharge current
    PACK_HEALTH = 0x122         # SOH, cycle count

    ALARMS = 0x130              # Alarm status
    FAULTS = 0x131              # Fault status
    WARNINGS = 0x132            # Warning status


@dataclass
class CellData:
    """Individual cell data"""
    cell_id: int
    voltage: float              # Voltage (V)
    temperature: Optional[float] = None  # Temperature (°C)
    balancing: bool = False     # Cell balancing active


@dataclass
class PackData:
    """Battery pack aggregate data"""
    pack_voltage: float         # Total pack voltage (V)
    pack_current: float         # Pack current (A, positive=charge)
    soc: float                  # State of Charge (%)
    soh: float                  # State of Health (%)
    max_charge_current: float   # Max allowed charge current (A)
    max_discharge_current: float # Max allowed discharge current (A)
    cycle_count: int            # Total charge cycles
    cells: List[CellData]       # Individual cell data

    # Derived metrics
    @property
    def min_cell_voltage(self) -> float:
        return min(cell.voltage for cell in self.cells)

    @property
    def max_cell_voltage(self) -> float:
        return max(cell.voltage for cell in self.cells)

    @property
    def voltage_delta(self) -> float:
        """Cell voltage imbalance"""
        return self.max_cell_voltage - self.min_cell_voltage

    @property
    def max_cell_temperature(self) -> Optional[float]:
        temps = [cell.temperature for cell in self.cells if cell.temperature is not None]
        return max(temps) if temps else None

    @property
    def is_balanced(self) -> bool:
        """Check if cells are balanced (< 50mV difference)"""
        return self.voltage_delta < 0.05


@dataclass
class BMSAlarms:
    """BMS alarm and fault status"""
    # Critical faults (require immediate shutdown)
    overvoltage_fault: bool = False
    undervoltage_fault: bool = False
    overcurrent_fault: bool = False
    overtemperature_fault: bool = False
    short_circuit_fault: bool = False

    # Warnings (reduce power, alert operator)
    high_voltage_warning: bool = False
    low_voltage_warning: bool = False
    high_current_warning: bool = False
    high_temperature_warning: bool = False
    cell_imbalance_warning: bool = False

    # Info
    balancing_active: bool = False

    def has_critical_fault(self) -> bool:
        """Check if any critical fault is active"""
        return any([
            self.overvoltage_fault,
            self.undervoltage_fault,
            self.overcurrent_fault,
            self.overtemperature_fault,
            self.short_circuit_fault
        ])

    def has_warnings(self) -> bool:
        """Check if any warning is active"""
        return any([
            self.high_voltage_warning,
            self.low_voltage_warning,
            self.high_current_warning,
            self.high_temperature_warning,
            self.cell_imbalance_warning
        ])


class BMSParser:
    """Parser for BMS CAN bus messages"""

    def __init__(self, num_cells: int = 16, num_temp_sensors: int = 8):
        self.num_cells = num_cells
        self.num_temp_sensors = num_temp_sensors

        # Buffers for multi-message data
        self.cell_voltages: Dict[int, float] = {}
        self.cell_temperatures: Dict[int, float] = {}

        self.pack_data: Optional[PackData] = None
        self.alarms: BMSAlarms = BMSAlarms()

    def parse_message(self, can_id: int, data: bytes) -> Optional[str]:
        """
        Parse a CAN message from BMS

        Args:
            can_id: CAN message ID
            data: CAN data payload (8 bytes)

        Returns:
            Message type parsed, or None if unknown
        """
        if can_id == BMSMessageID.CELL_VOLTAGES_1.value:
            return self._parse_cell_voltages(data, start_cell=1)
        elif can_id == BMSMessageID.CELL_VOLTAGES_2.value:
            return self._parse_cell_voltages(data, start_cell=5)
        elif can_id == BMSMessageID.CELL_VOLTAGES_3.value:
            return self._parse_cell_voltages(data, start_cell=9)
        elif can_id == BMSMessageID.CELL_VOLTAGES_4.value:
            return self._parse_cell_voltages(data, start_cell=13)
        elif can_id == BMSMessageID.CELL_TEMPS_1.value:
            return self._parse_cell_temperatures(data, start_sensor=1)
        elif can_id == BMSMessageID.CELL_TEMPS_2.value:
            return self._parse_cell_temperatures(data, start_sensor=5)
        elif can_id == BMSMessageID.PACK_STATUS.value:
            return self._parse_pack_status(data)
        elif can_id == BMSMessageID.PACK_HEALTH.value:
            return self._parse_pack_health(data)
        elif can_id == BMSMessageID.ALARMS.value:
            return self._parse_alarms(data)
        else:
            logger.debug(f"Unknown CAN ID: 0x{can_id:03X}")
            return None

    def _parse_cell_voltages(self, data: bytes, start_cell: int) -> str:
        """Parse cell voltage message (4 cells per message)"""
        for i in range(4):
            # Each voltage is 2 bytes (uint16), in millivolts
            offset = i * 2
            voltage_mv = int.from_bytes(data[offset:offset+2], byteorder='big')
            voltage_v = voltage_mv / 1000.0

            cell_id = start_cell + i
            if cell_id <= self.num_cells:
                self.cell_voltages[cell_id] = voltage_v

        return "cell_voltages"

    def _parse_cell_temperatures(self, data: bytes, start_sensor: int) -> str:
        """Parse cell temperature message (4 sensors per message)"""
        for i in range(4):
            # Each temp is 2 bytes (int16), in 0.1°C
            offset = i * 2
            temp_raw = int.from_bytes(data[offset:offset+2], byteorder='big', signed=True)
            temp_c = temp_raw / 10.0

            sensor_id = start_sensor + i
            if sensor_id <= self.num_temp_sensors:
                self.cell_temperatures[sensor_id] = temp_c

        return "cell_temperatures"

    def _parse_pack_status(self, data: bytes) -> str:
        """Parse pack voltage, current, SOC"""
        # Pack voltage (2 bytes, uint16, in 0.1V)
        pack_voltage = int.from_bytes(data[0:2], byteorder='big') / 10.0

        # Pack current (2 bytes, int16, in 0.1A, positive=charge)
        pack_current = int.from_bytes(data[2:4], byteorder='big', signed=True) / 10.0

        # SOC (1 byte, uint8, in %)
        soc = data[4]

        # Max charge current (1 byte, uint8, in A)
        max_charge_current = data[5]

        # Max discharge current (1 byte, uint8, in A)
        max_discharge_current = data[6]

        # Store partial pack data
        if not hasattr(self, '_pack_voltage'):
            self._pack_voltage = pack_voltage
            self._pack_current = pack_current
            self._soc = soc
            self._max_charge_current = max_charge_current
            self._max_discharge_current = max_discharge_current

        return "pack_status"

    def _parse_pack_health(self, data: bytes) -> str:
        """Parse SOH and cycle count"""
        # SOH (1 byte, uint8, in %)
        soh = data[0]

        # Cycle count (2 bytes, uint16)
        cycle_count = int.from_bytes(data[1:3], byteorder='big')

        # Store partial pack data
        self._soh = soh
        self._cycle_count = cycle_count

        # Build complete pack data
        self._build_pack_data()

        return "pack_health"

    def _parse_alarms(self, data: bytes) -> str:
        """Parse alarm and fault status"""
        # Fault bits (byte 0)
        fault_byte = data[0]
        self.alarms.overvoltage_fault = bool(fault_byte & 0x01)
        self.alarms.undervoltage_fault = bool(fault_byte & 0x02)
        self.alarms.overcurrent_fault = bool(fault_byte & 0x04)
        self.alarms.overtemperature_fault = bool(fault_byte & 0x08)
        self.alarms.short_circuit_fault = bool(fault_byte & 0x10)

        # Warning bits (byte 1)
        warning_byte = data[1]
        self.alarms.high_voltage_warning = bool(warning_byte & 0x01)
        self.alarms.low_voltage_warning = bool(warning_byte & 0x02)
        self.alarms.high_current_warning = bool(warning_byte & 0x04)
        self.alarms.high_temperature_warning = bool(warning_byte & 0x08)
        self.alarms.cell_imbalance_warning = bool(warning_byte & 0x10)

        # Info bits (byte 2)
        info_byte = data[2]
        self.alarms.balancing_active = bool(info_byte & 0x01)

        if self.alarms.has_critical_fault():
            logger.error(f"BMS CRITICAL FAULT: {self.alarms}")
        elif self.alarms.has_warnings():
            logger.warning(f"BMS WARNING: {self.alarms}")

        return "alarms"

    def _build_pack_data(self):
        """Build complete PackData from parsed messages"""
        if not hasattr(self, '_pack_voltage'):
            return  # Not enough data yet

        # Build cell data list
        cells = []
        for cell_id in range(1, self.num_cells + 1):
            voltage = self.cell_voltages.get(cell_id, 0.0)

            # Map cell to temperature sensor (e.g., 2 cells per sensor)
            temp_sensor_id = (cell_id - 1) // 2 + 1
            temperature = self.cell_temperatures.get(temp_sensor_id)

            # Check if balancing (example: based on voltage delta)
            balancing = self.alarms.balancing_active

            cells.append(CellData(
                cell_id=cell_id,
                voltage=voltage,
                temperature=temperature,
                balancing=balancing
            ))

        self.pack_data = PackData(
            pack_voltage=self._pack_voltage,
            pack_current=self._pack_current,
            soc=self._soc,
            soh=self._soh,
            max_charge_current=self._max_charge_current,
            max_discharge_current=self._max_discharge_current,
            cycle_count=self._cycle_count,
            cells=cells
        )

    def get_pack_data(self) -> Optional[PackData]:
        """Get complete pack data"""
        return self.pack_data

    def get_alarms(self) -> BMSAlarms:
        """Get current alarm status"""
        return self.alarms


# Simulated BMS for testing
class SimulatedBMS(BMSParser):
    """Simulated BMS for testing without hardware"""

    def __init__(self, num_cells: int = 16, num_temp_sensors: int = 8):
        super().__init__(num_cells, num_temp_sensors)

        # Initialize with simulated data
        self._simulate_data()

    def _simulate_data(self):
        """Generate simulated BMS data"""
        # Simulate cell voltages (3.6V - 3.7V per cell)
        import random
        for cell_id in range(1, self.num_cells + 1):
            self.cell_voltages[cell_id] = 3.65 + random.uniform(-0.05, 0.05)

        # Simulate cell temperatures (20-30°C)
        for sensor_id in range(1, self.num_temp_sensors + 1):
            self.cell_temperatures[sensor_id] = 25.0 + random.uniform(-5, 5)

        # Simulate pack data
        self._pack_voltage = sum(self.cell_voltages.values())
        self._pack_current = 0.0
        self._soc = 80.0
        self._soh = 95.0
        self._max_charge_current = 100.0
        self._max_discharge_current = 100.0
        self._cycle_count = 150

        self._build_pack_data()

    def update_simulation(self, power_kw: float):
        """Update simulated BMS based on power setpoint"""
        # Update current based on power
        if self._pack_voltage > 0:
            self._pack_current = (power_kw * 1000.0) / self._pack_voltage

        # Update SOC (very simplified)
        # Assuming 200 kWh capacity
        soc_delta = (power_kw / 200.0) * (1.0 / 3600.0) * 100.0  # per second
        self._soc = max(0.0, min(100.0, self._soc + soc_delta))

        # Rebuild pack data
        self._build_pack_data()
