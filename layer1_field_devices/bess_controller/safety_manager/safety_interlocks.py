"""
BESS Safety Manager
Implements safety interlocks and emergency shutdown procedures
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class SafetyLevel(Enum):
    """Safety alarm severity levels"""
    NORMAL = 0
    INFO = 1
    WARNING = 2
    CRITICAL = 3
    EMERGENCY = 4


class SafetyAction(Enum):
    """Actions to take on safety violations"""
    NONE = "none"
    LOG = "log"
    REDUCE_POWER = "reduce_power"
    STOP = "stop"
    EMERGENCY_SHUTDOWN = "emergency_shutdown"


@dataclass
class SafetyLimits:
    """BESS safety operating limits"""
    # Voltage limits (V)
    min_cell_voltage: float = 2.8
    max_cell_voltage: float = 4.2
    min_pack_voltage: float = 44.8
    max_pack_voltage: float = 67.2

    # Current limits (A)
    max_charge_current: float = 100.0
    max_discharge_current: float = 100.0

    # Temperature limits (°C)
    min_temperature: float = -10.0
    max_temperature: float = 55.0
    critical_temperature: float = 60.0

    # SOC limits (%)
    min_soc: float = 10.0
    max_soc: float = 95.0

    # Rate limits
    max_soc_change_rate: float = 1.0  # % per minute
    max_power_ramp_rate: float = 10.0  # kW per second

    # Cell balancing
    max_cell_voltage_delta: float = 0.1  # V

    # Degradation
    min_soh: float = 70.0


@dataclass
class SafetyViolation:
    """Record of a safety violation"""
    timestamp: datetime
    level: SafetyLevel
    category: str
    message: str
    value: Optional[float] = None
    limit: Optional[float] = None
    action: SafetyAction = SafetyAction.NONE


class SafetyManager:
    """
    Safety manager for BESS operations
    Monitors telemetry and enforces safety limits
    """

    def __init__(self, limits: Optional[SafetyLimits] = None):
        self.limits = limits or SafetyLimits()
        self.violations: List[SafetyViolation] = []
        self.is_emergency_stopped = False
        self.power_reduction_factor = 1.0

        # State tracking
        self.last_soc: Optional[float] = None
        self.last_soc_time: Optional[datetime] = None
        self.last_power: Optional[float] = None
        self.last_power_time: Optional[datetime] = None

    def check_safety(self, telemetry: Dict[str, Any]) -> List[SafetyViolation]:
        """
        Check all safety conditions

        Args:
            telemetry: BESS telemetry data

        Returns:
            List of safety violations (empty if all OK)
        """
        violations = []

        # Extract telemetry
        soc = telemetry.get('soc', 0.0)
        soh = telemetry.get('soh', 100.0)
        pack_voltage = telemetry.get('voltage', 0.0)
        pack_current = telemetry.get('current', 0.0)
        temperature = telemetry.get('temperature', 25.0)
        power_kw = telemetry.get('power_kw', 0.0)

        # Cell-level data (if available)
        cells = telemetry.get('cells', [])
        alarms = telemetry.get('alarms', {})

        # 1. Check cell voltages
        if cells:
            violations.extend(self._check_cell_voltages(cells))

        # 2. Check pack voltage
        violations.extend(self._check_pack_voltage(pack_voltage))

        # 3. Check current
        violations.extend(self._check_current(pack_current))

        # 4. Check temperature
        violations.extend(self._check_temperature(temperature, cells))

        # 5. Check SOC
        violations.extend(self._check_soc(soc))

        # 6. Check SOH
        violations.extend(self._check_soh(soh))

        # 7. Check rate limits
        violations.extend(self._check_rate_limits(soc, power_kw))

        # 8. Check BMS alarms
        if alarms:
            violations.extend(self._check_bms_alarms(alarms))

        # Store violations
        self.violations.extend(violations)

        # Take actions
        self._handle_violations(violations)

        return violations

    def _check_cell_voltages(self, cells: List[Dict]) -> List[SafetyViolation]:
        """Check individual cell voltages"""
        violations = []

        voltages = [cell.get('voltage', 0.0) for cell in cells]
        if not voltages:
            return violations

        min_voltage = min(voltages)
        max_voltage = max(voltages)
        voltage_delta = max_voltage - min_voltage

        # Check min voltage
        if min_voltage < self.limits.min_cell_voltage:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="cell_undervoltage",
                message=f"Cell undervoltage: {min_voltage:.3f}V < {self.limits.min_cell_voltage:.3f}V",
                value=min_voltage,
                limit=self.limits.min_cell_voltage,
                action=SafetyAction.STOP
            ))

        # Check max voltage
        if max_voltage > self.limits.max_cell_voltage:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="cell_overvoltage",
                message=f"Cell overvoltage: {max_voltage:.3f}V > {self.limits.max_cell_voltage:.3f}V",
                value=max_voltage,
                limit=self.limits.max_cell_voltage,
                action=SafetyAction.STOP
            ))

        # Check cell imbalance
        if voltage_delta > self.limits.max_cell_voltage_delta:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.WARNING,
                category="cell_imbalance",
                message=f"Cell voltage imbalance: {voltage_delta:.3f}V > {self.limits.max_cell_voltage_delta:.3f}V",
                value=voltage_delta,
                limit=self.limits.max_cell_voltage_delta,
                action=SafetyAction.REDUCE_POWER
            ))

        return violations

    def _check_pack_voltage(self, pack_voltage: float) -> List[SafetyViolation]:
        """Check pack voltage"""
        violations = []

        if pack_voltage < self.limits.min_pack_voltage:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="pack_undervoltage",
                message=f"Pack undervoltage: {pack_voltage:.1f}V",
                value=pack_voltage,
                limit=self.limits.min_pack_voltage,
                action=SafetyAction.STOP
            ))

        if pack_voltage > self.limits.max_pack_voltage:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="pack_overvoltage",
                message=f"Pack overvoltage: {pack_voltage:.1f}V",
                value=pack_voltage,
                limit=self.limits.max_pack_voltage,
                action=SafetyAction.STOP
            ))

        return violations

    def _check_current(self, pack_current: float) -> List[SafetyViolation]:
        """Check pack current"""
        violations = []

        # Positive current = charging
        if pack_current > self.limits.max_charge_current:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="overcurrent_charge",
                message=f"Charge overcurrent: {pack_current:.1f}A",
                value=pack_current,
                limit=self.limits.max_charge_current,
                action=SafetyAction.REDUCE_POWER
            ))

        # Negative current = discharging
        if abs(pack_current) > self.limits.max_discharge_current and pack_current < 0:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="overcurrent_discharge",
                message=f"Discharge overcurrent: {abs(pack_current):.1f}A",
                value=abs(pack_current),
                limit=self.limits.max_discharge_current,
                action=SafetyAction.REDUCE_POWER
            ))

        return violations

    def _check_temperature(self, pack_temperature: float, cells: List[Dict]) -> List[SafetyViolation]:
        """Check temperatures"""
        violations = []

        # Check pack temperature
        if pack_temperature > self.limits.critical_temperature:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.EMERGENCY,
                category="critical_temperature",
                message=f"CRITICAL TEMPERATURE: {pack_temperature:.1f}°C",
                value=pack_temperature,
                limit=self.limits.critical_temperature,
                action=SafetyAction.EMERGENCY_SHUTDOWN
            ))
        elif pack_temperature > self.limits.max_temperature:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.CRITICAL,
                category="overtemperature",
                message=f"Overtemperature: {pack_temperature:.1f}°C",
                value=pack_temperature,
                limit=self.limits.max_temperature,
                action=SafetyAction.REDUCE_POWER
            ))
        elif pack_temperature < self.limits.min_temperature:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.WARNING,
                category="undertemperature",
                message=f"Undertemperature: {pack_temperature:.1f}°C",
                value=pack_temperature,
                limit=self.limits.min_temperature,
                action=SafetyAction.REDUCE_POWER
            ))

        # Check individual cell temperatures
        if cells:
            cell_temps = [cell.get('temperature') for cell in cells if cell.get('temperature') is not None]
            if cell_temps:
                max_temp = max(cell_temps)
                if max_temp > self.limits.critical_temperature:
                    violations.append(SafetyViolation(
                        timestamp=datetime.utcnow(),
                        level=SafetyLevel.EMERGENCY,
                        category="cell_critical_temperature",
                        message=f"CELL CRITICAL TEMPERATURE: {max_temp:.1f}°C",
                        value=max_temp,
                        limit=self.limits.critical_temperature,
                        action=SafetyAction.EMERGENCY_SHUTDOWN
                    ))

        return violations

    def _check_soc(self, soc: float) -> List[SafetyViolation]:
        """Check State of Charge"""
        violations = []

        if soc < self.limits.min_soc:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.WARNING,
                category="low_soc",
                message=f"Low SOC: {soc:.1f}%",
                value=soc,
                limit=self.limits.min_soc,
                action=SafetyAction.REDUCE_POWER
            ))

        if soc > self.limits.max_soc:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.WARNING,
                category="high_soc",
                message=f"High SOC: {soc:.1f}%",
                value=soc,
                limit=self.limits.max_soc,
                action=SafetyAction.REDUCE_POWER
            ))

        return violations

    def _check_soh(self, soh: float) -> List[SafetyViolation]:
        """Check State of Health"""
        violations = []

        if soh < self.limits.min_soh:
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.WARNING,
                category="low_soh",
                message=f"Low SOH: {soh:.1f}% - Battery degraded",
                value=soh,
                limit=self.limits.min_soh,
                action=SafetyAction.LOG
            ))

        return violations

    def _check_rate_limits(self, soc: float, power_kw: float) -> List[SafetyViolation]:
        """Check rate of change limits"""
        violations = []
        now = datetime.utcnow()

        # Check SOC rate of change
        if self.last_soc is not None and self.last_soc_time is not None:
            time_delta = (now - self.last_soc_time).total_seconds() / 60.0  # minutes
            if time_delta > 0:
                soc_rate = abs(soc - self.last_soc) / time_delta  # % per minute

                if soc_rate > self.limits.max_soc_change_rate:
                    violations.append(SafetyViolation(
                        timestamp=now,
                        level=SafetyLevel.WARNING,
                        category="soc_rate_limit",
                        message=f"SOC changing too fast: {soc_rate:.2f}%/min",
                        value=soc_rate,
                        limit=self.limits.max_soc_change_rate,
                        action=SafetyAction.REDUCE_POWER
                    ))

        # Check power ramp rate
        if self.last_power is not None and self.last_power_time is not None:
            time_delta = (now - self.last_power_time).total_seconds()  # seconds
            if time_delta > 0:
                power_ramp = abs(power_kw - self.last_power) / time_delta  # kW per second

                if power_ramp > self.limits.max_power_ramp_rate:
                    violations.append(SafetyViolation(
                        timestamp=now,
                        level=SafetyLevel.WARNING,
                        category="power_ramp_limit",
                        message=f"Power ramping too fast: {power_ramp:.2f} kW/s",
                        value=power_ramp,
                        limit=self.limits.max_power_ramp_rate,
                        action=SafetyAction.LOG
                    ))

        # Update state
        self.last_soc = soc
        self.last_soc_time = now
        self.last_power = power_kw
        self.last_power_time = now

        return violations

    def _check_bms_alarms(self, alarms: Dict) -> List[SafetyViolation]:
        """Check BMS alarm flags"""
        violations = []

        # Critical faults
        if alarms.get('overvoltage_fault'):
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.EMERGENCY,
                category="bms_overvoltage_fault",
                message="BMS overvoltage fault",
                action=SafetyAction.EMERGENCY_SHUTDOWN
            ))

        if alarms.get('overcurrent_fault'):
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.EMERGENCY,
                category="bms_overcurrent_fault",
                message="BMS overcurrent fault",
                action=SafetyAction.EMERGENCY_SHUTDOWN
            ))

        if alarms.get('overtemperature_fault'):
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.EMERGENCY,
                category="bms_overtemperature_fault",
                message="BMS overtemperature fault",
                action=SafetyAction.EMERGENCY_SHUTDOWN
            ))

        if alarms.get('short_circuit_fault'):
            violations.append(SafetyViolation(
                timestamp=datetime.utcnow(),
                level=SafetyLevel.EMERGENCY,
                category="bms_short_circuit_fault",
                message="BMS short circuit fault",
                action=SafetyAction.EMERGENCY_SHUTDOWN
            ))

        return violations

    def _handle_violations(self, violations: List[SafetyViolation]):
        """Take action on safety violations"""
        if not violations:
            return

        # Find highest severity action
        max_action = SafetyAction.NONE
        for violation in violations:
            if violation.action == SafetyAction.EMERGENCY_SHUTDOWN:
                max_action = SafetyAction.EMERGENCY_SHUTDOWN
                break
            elif violation.action == SafetyAction.STOP and max_action != SafetyAction.EMERGENCY_SHUTDOWN:
                max_action = SafetyAction.STOP
            elif violation.action == SafetyAction.REDUCE_POWER and max_action not in [SafetyAction.EMERGENCY_SHUTDOWN, SafetyAction.STOP]:
                max_action = SafetyAction.REDUCE_POWER

        # Execute action
        if max_action == SafetyAction.EMERGENCY_SHUTDOWN:
            logger.critical("EMERGENCY SHUTDOWN TRIGGERED")
            self.emergency_shutdown()
        elif max_action == SafetyAction.STOP:
            logger.error("SAFETY STOP TRIGGERED")
            self.stop()
        elif max_action == SafetyAction.REDUCE_POWER:
            logger.warning("REDUCING POWER DUE TO SAFETY")
            self.reduce_power(factor=0.5)

        # Log all violations
        for violation in violations:
            if violation.level == SafetyLevel.EMERGENCY or violation.level == SafetyLevel.CRITICAL:
                logger.error(f"SAFETY: {violation.message}")
            elif violation.level == SafetyLevel.WARNING:
                logger.warning(f"SAFETY: {violation.message}")
            else:
                logger.info(f"SAFETY: {violation.message}")

    def emergency_shutdown(self):
        """EMERGENCY SHUTDOWN - Immediately stop all operations"""
        self.is_emergency_stopped = True
        self.power_reduction_factor = 0.0
        logger.critical("=== EMERGENCY SHUTDOWN ACTIVATED ===")

    def stop(self):
        """Stop BESS operations (can be restarted)"""
        self.power_reduction_factor = 0.0
        logger.error("BESS operations stopped")

    def reduce_power(self, factor: float = 0.5):
        """Reduce power output"""
        self.power_reduction_factor = min(self.power_reduction_factor, factor)
        logger.warning(f"Power reduced to {factor * 100:.0f}%")

    def apply_safety_limits(self, requested_power_kw: float) -> float:
        """
        Apply safety limits to requested power

        Args:
            requested_power_kw: Requested power setpoint

        Returns:
            Safe power setpoint
        """
        if self.is_emergency_stopped:
            return 0.0

        # Apply power reduction
        safe_power = requested_power_kw * self.power_reduction_factor

        return safe_power

    def reset(self):
        """Reset safety manager (after resolving issues)"""
        if self.is_emergency_stopped:
            logger.warning("Cannot reset from emergency stop - manual intervention required")
            return False

        self.power_reduction_factor = 1.0
        logger.info("Safety manager reset")
        return True

    def get_violation_history(self, limit: int = 100) -> List[SafetyViolation]:
        """Get recent safety violations"""
        return self.violations[-limit:]

    def clear_violation_history(self):
        """Clear violation history"""
        self.violations.clear()
