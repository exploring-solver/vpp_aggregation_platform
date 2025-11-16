"""
Phasor Measurement Unit (PMU) Interface
Collects real-time grid frequency and voltage measurements
Supports IEEE C37.118 protocol or simulated data
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import random

logger = logging.getLogger(__name__)


class GridZone(str, Enum):
    """Indian grid zones"""
    NORTHERN = "northern"
    EASTERN = "eastern"
    WESTERN = "western"
    SOUTHERN = "southern"
    NORTH_EASTERN = "north_eastern"


@dataclass
class PMUMeasurement:
    """Real-time PMU measurement"""
    timestamp: datetime
    frequency: float            # Grid frequency (Hz)
    rocof: float                # Rate of Change of Frequency (Hz/s)
    voltage_magnitude: float    # Voltage magnitude (kV)
    voltage_angle: float        # Voltage phase angle (degrees)
    current_magnitude: float    # Current magnitude (A)
    current_angle: float        # Current phase angle (degrees)

    # Quality indicators
    sync_locked: bool = True    # GPS sync status
    data_valid: bool = True     # Data validity flag

    # Location
    zone: GridZone = GridZone.WESTERN
    substation: str = "Unknown"


class PMUClient:
    """
    PMU data collector
    In production, this would connect to POSOCO WAMS or local PMU hardware
    """

    def __init__(self, pmu_host: str = "localhost", pmu_port: int = 4712):
        """
        Initialize PMU client

        Args:
            pmu_host: PMU server IP address
            pmu_port: PMU server port (IEEE C37.118 default: 4712)
        """
        self.pmu_host = pmu_host
        self.pmu_port = pmu_port
        self.connected = False

        # For simulation
        self.sim_base_frequency = 50.0
        self.sim_frequency = 50.0
        self.sim_trend = 0.0

    async def connect(self) -> bool:
        """Connect to PMU data stream"""
        # In production, this would establish IEEE C37.118 connection
        # For now, we'll simulate
        logger.info(f"[SIMULATED] Connected to PMU at {self.pmu_host}:{self.pmu_port}")
        self.connected = True
        return True

    async def disconnect(self):
        """Disconnect from PMU"""
        self.connected = False
        logger.info("Disconnected from PMU")

    async def get_measurement(self) -> Optional[PMUMeasurement]:
        """
        Get real-time PMU measurement

        Returns:
            PMUMeasurement or None if not available
        """
        if not self.connected:
            logger.error("Not connected to PMU")
            return None

        # In production, this would parse IEEE C37.118 synchrophasor data
        # For simulation, we generate realistic frequency variations
        return self._simulate_measurement()

    def _simulate_measurement(self) -> PMUMeasurement:
        """Simulate realistic grid frequency variations"""

        # Simulate frequency variations around 50 Hz
        # Include both random noise and systematic trends

        # Random walk with mean reversion
        noise = random.gauss(0, 0.01)  # ±10 mHz noise
        mean_reversion = (self.sim_base_frequency - self.sim_frequency) * 0.05

        # Occasional grid events (under-frequency/over-frequency)
        if random.random() < 0.01:  # 1% chance of grid event
            event_magnitude = random.choice([-0.2, 0.2])  # ±200 mHz event
            self.sim_trend = event_magnitude
            logger.warning(f"[SIMULATED] Grid frequency event: {event_magnitude:+.3f} Hz")

        # Decay trend
        self.sim_trend *= 0.9

        # Update frequency
        freq_delta = noise + mean_reversion + self.sim_trend * 0.1
        self.sim_frequency += freq_delta

        # Constrain to realistic limits (49.0 - 51.0 Hz)
        self.sim_frequency = max(49.0, min(51.0, self.sim_frequency))

        # Calculate ROCOF (Rate of Change of Frequency)
        rocof = freq_delta * 10.0  # Approximate Hz/s

        # Simulate voltage and current
        voltage_mag = 400.0 + random.gauss(0, 5.0)  # 400 kV ± 5 kV
        voltage_ang = random.uniform(-15, 15)  # Phase angle
        current_mag = 500.0 + random.gauss(0, 50.0)  # 500 A ± 50 A
        current_ang = voltage_ang - 30.0  # Lagging power factor

        return PMUMeasurement(
            timestamp=datetime.utcnow(),
            frequency=self.sim_frequency,
            rocof=rocof,
            voltage_magnitude=voltage_mag,
            voltage_angle=voltage_ang,
            current_magnitude=current_mag,
            current_angle=current_ang,
            sync_locked=True,
            data_valid=True,
            zone=GridZone.WESTERN,
            substation="Andheri 400kV"
        )

    async def stream_measurements(self, callback, interval: float = 0.1):
        """
        Stream PMU measurements at specified interval

        Args:
            callback: Async function to call with each measurement
            interval: Measurement interval in seconds (default 100ms for 10Hz)
        """
        while self.connected:
            try:
                measurement = await self.get_measurement()
                if measurement:
                    await callback(measurement)
            except Exception as e:
                logger.error(f"Error in PMU stream: {e}")

            await asyncio.sleep(interval)


class FrequencyMonitor:
    """
    Grid frequency monitor with alarm detection
    Implements IEGC frequency band detection
    """

    def __init__(self):
        # IEGC frequency bands (Indian Electricity Grid Code)
        self.FREQ_NORMAL_MIN = 49.90
        self.FREQ_NORMAL_MAX = 50.05
        self.FREQ_CRITICAL_LOW = 49.50
        self.FREQ_CRITICAL_HIGH = 50.50

        # State
        self.current_frequency = 50.0
        self.frequency_history = []
        self.max_history = 3000  # 5 minutes at 10Hz

        # Alarms
        self.in_alarm = False
        self.alarm_reason = None

    async def update(self, measurement: PMUMeasurement):
        """Update frequency monitor with new measurement"""
        self.current_frequency = measurement.frequency

        # Store history
        self.frequency_history.append({
            "timestamp": measurement.timestamp,
            "frequency": measurement.frequency,
            "rocof": measurement.rocof
        })

        # Limit history size
        if len(self.frequency_history) > self.max_history:
            self.frequency_history.pop(0)

        # Check alarm conditions
        self._check_alarms(measurement)

    def _check_alarms(self, measurement: PMUMeasurement):
        """Check for frequency alarm conditions"""
        freq = measurement.frequency

        if freq < self.FREQ_CRITICAL_LOW:
            self.in_alarm = True
            self.alarm_reason = f"CRITICAL LOW FREQUENCY: {freq:.3f} Hz"
            logger.error(self.alarm_reason)

        elif freq > self.FREQ_CRITICAL_HIGH:
            self.in_alarm = True
            self.alarm_reason = f"CRITICAL HIGH FREQUENCY: {freq:.3f} Hz"
            logger.error(self.alarm_reason)

        elif freq < self.FREQ_NORMAL_MIN:
            self.in_alarm = True
            self.alarm_reason = f"Low frequency: {freq:.3f} Hz (below 49.90 Hz)"
            logger.warning(self.alarm_reason)

        elif freq > self.FREQ_NORMAL_MAX:
            self.in_alarm = True
            self.alarm_reason = f"High frequency: {freq:.3f} Hz (above 50.05 Hz)"
            logger.warning(self.alarm_reason)

        else:
            # Frequency within normal range
            if self.in_alarm:
                logger.info(f"Frequency returned to normal: {freq:.3f} Hz")
            self.in_alarm = False
            self.alarm_reason = None

        # Check ROCOF (Rate of Change of Frequency)
        if abs(measurement.rocof) > 1.0:  # >1 Hz/s is abnormal
            logger.warning(f"High ROCOF detected: {measurement.rocof:.3f} Hz/s")

    def get_status(self) -> Dict[str, Any]:
        """Get current frequency monitor status"""
        # Calculate statistics
        if self.frequency_history:
            recent_freqs = [h["frequency"] for h in self.frequency_history[-600:]]  # Last 60 seconds
            avg_freq = sum(recent_freqs) / len(recent_freqs)
            min_freq = min(recent_freqs)
            max_freq = max(recent_freqs)
            std_dev = (sum((f - avg_freq) ** 2 for f in recent_freqs) / len(recent_freqs)) ** 0.5
        else:
            avg_freq = 50.0
            min_freq = 50.0
            max_freq = 50.0
            std_dev = 0.0

        return {
            "current_frequency": self.current_frequency,
            "in_alarm": self.in_alarm,
            "alarm_reason": self.alarm_reason,
            "statistics": {
                "avg_frequency_60s": avg_freq,
                "min_frequency_60s": min_freq,
                "max_frequency_60s": max_freq,
                "std_dev_60s": std_dev
            },
            "frequency_band": self._get_frequency_band(self.current_frequency),
            "history_size": len(self.frequency_history)
        }

    def _get_frequency_band(self, freq: float) -> str:
        """Classify frequency into IEGC bands"""
        if freq < self.FREQ_CRITICAL_LOW:
            return "CRITICAL_LOW"
        elif freq < self.FREQ_NORMAL_MIN:
            return "LOW"
        elif freq <= self.FREQ_NORMAL_MAX:
            return "NORMAL"
        elif freq <= self.FREQ_CRITICAL_HIGH:
            return "HIGH"
        else:
            return "CRITICAL_HIGH"

    def requires_response(self) -> bool:
        """Check if frequency requires active response"""
        # Response required if outside deadband
        return (self.current_frequency < self.FREQ_NORMAL_MIN or
                self.current_frequency > self.FREQ_NORMAL_MAX)

    def get_frequency_deviation(self) -> float:
        """Get frequency deviation from nominal (50 Hz)"""
        return self.current_frequency - 50.0
