"""
Frequency Droop Controller
Implements primary frequency response as per IEGC requirements
Droop control: 5% droop for frequency regulation
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ResponseMode(str, Enum):
    """Frequency response modes"""
    OFF = "off"                      # No response
    PRIMARY = "primary"              # Primary response (0-5 seconds)
    SECONDARY = "secondary"          # Secondary response (30s-15min, AGC-based)
    TERTIARY = "tertiary"            # Tertiary response (15min+, market-based)


@dataclass
class DroopSettings:
    """Frequency droop controller settings"""
    # Droop parameters
    droop_percent: float = 5.0       # Droop percentage (IEGC standard: 5%)
    deadband_low: float = 49.90      # Lower deadband (Hz)
    deadband_high: float = 50.05     # Upper deadband (Hz)

    # Power limits
    max_power_kw: float = 1000.0     # Maximum power available for frequency response
    ramp_rate_kw_per_s: float = 50.0 # Power ramping rate (kW/s)

    # Response parameters
    response_mode: ResponseMode = ResponseMode.PRIMARY
    enable_damping: bool = True      # Enable ROCOF damping
    damping_gain: float = 0.1        # ROCOF damping gain


class FrequencyDroopController:
    """
    Implements frequency droop control for grid frequency regulation

    Droop control equation:
    ΔP = - (P_max / droop) * (Δf / f_nominal)

    Where:
    - ΔP = Change in power output
    - P_max = Maximum power capacity
    - droop = Droop percentage (e.g., 0.05 for 5%)
    - Δf = Frequency deviation from nominal (50 Hz)
    - f_nominal = Nominal frequency (50 Hz)

    IEGC Requirements:
    - Deadband: 49.90-50.05 Hz (no action)
    - Droop: 5% (±2.5 Hz for full power range)
    - Response time: 0-5 seconds for primary response
    """

    def __init__(self, settings: DroopSettings):
        self.settings = settings

        # State
        self.enabled = False
        self.current_power_setpoint = 0.0
        self.last_frequency = 50.0

        # Nominal frequency
        self.f_nominal = 50.0

    def calculate_power_response(
        self,
        frequency: float,
        rocof: Optional[float] = None
    ) -> float:
        """
        Calculate power response based on frequency deviation

        Args:
            frequency: Current grid frequency (Hz)
            rocof: Rate of change of frequency (Hz/s), optional

        Returns:
            Power setpoint (kW), positive = discharge, negative = charge
        """
        if not self.enabled:
            return 0.0

        if self.settings.response_mode == ResponseMode.OFF:
            return 0.0

        # Calculate frequency deviation
        freq_deviation = frequency - self.f_nominal

        # Check deadband
        if self.settings.deadband_low <= frequency <= self.settings.deadband_high:
            # Within deadband - no action
            return 0.0

        # Calculate droop response
        # Power output inversely proportional to frequency
        # Low frequency → positive power (discharge)
        # High frequency → negative power (charge)

        droop_fraction = self.settings.droop_percent / 100.0  # Convert % to fraction

        # Droop equation: ΔP = - (P_max / droop) * (Δf / f_nominal)
        # Simplified for 50 Hz: ΔP ≈ - (P_max / droop) * (Δf / 50)

        power_response = - (self.settings.max_power_kw / droop_fraction) * (freq_deviation / self.f_nominal)

        # Add ROCOF damping if enabled
        if self.settings.enable_damping and rocof is not None:
            # Damping helps arrest frequency decline/rise
            damping_power = - self.settings.damping_gain * rocof * self.settings.max_power_kw
            power_response += damping_power

        # Limit to available power
        power_response = max(-self.settings.max_power_kw, min(self.settings.max_power_kw, power_response))

        # Apply ramping limit (rate of change constraint)
        max_ramp = self.settings.ramp_rate_kw_per_s  # Assuming 1 second intervals
        power_delta = power_response - self.current_power_setpoint

        if abs(power_delta) > max_ramp:
            # Limit ramp rate
            if power_delta > 0:
                power_response = self.current_power_setpoint + max_ramp
            else:
                power_response = self.current_power_setpoint - max_ramp

        # Update state
        self.current_power_setpoint = power_response
        self.last_frequency = frequency

        # Log significant responses
        if abs(power_response) > 10.0:
            logger.info(
                f"Frequency response: f={frequency:.3f} Hz, "
                f"Δf={freq_deviation:+.3f} Hz, "
                f"P={power_response:+.2f} kW"
            )

        return power_response

    def enable(self):
        """Enable droop controller"""
        self.enabled = True
        logger.info("Frequency droop controller enabled")

    def disable(self):
        """Disable droop controller"""
        self.enabled = False
        self.current_power_setpoint = 0.0
        logger.info("Frequency droop controller disabled")

    def update_settings(self, settings: DroopSettings):
        """Update droop controller settings"""
        self.settings = settings
        logger.info(f"Droop controller settings updated: {settings}")

    def get_status(self) -> Dict[str, Any]:
        """Get controller status"""
        return {
            "enabled": self.enabled,
            "mode": self.settings.response_mode.value,
            "current_setpoint_kw": self.current_power_setpoint,
            "last_frequency": self.last_frequency,
            "settings": {
                "droop_percent": self.settings.droop_percent,
                "deadband_low": self.settings.deadband_low,
                "deadband_high": self.settings.deadband_high,
                "max_power_kw": self.settings.max_power_kw,
                "ramp_rate_kw_per_s": self.settings.ramp_rate_kw_per_s,
                "enable_damping": self.settings.enable_damping
            }
        }


class AdaptiveDroopController(FrequencyDroopController):
    """
    Advanced droop controller with adaptive features
    - SOC-dependent droop (adjust response based on battery state)
    - Load-dependent droop
    - Temperature-dependent limits
    """

    def __init__(self, settings: DroopSettings):
        super().__init__(settings)
        self.soc = 80.0  # Default SOC
        self.temperature = 25.0  # Default temperature

    def calculate_power_response_adaptive(
        self,
        frequency: float,
        rocof: Optional[float] = None,
        soc: Optional[float] = None,
        temperature: Optional[float] = None
    ) -> float:
        """
        Calculate adaptive power response

        Args:
            frequency: Grid frequency (Hz)
            rocof: Rate of change of frequency (Hz/s)
            soc: State of Charge (%)
            temperature: Battery temperature (°C)

        Returns:
            Power setpoint (kW)
        """
        # Update state
        if soc is not None:
            self.soc = soc
        if temperature is not None:
            self.temperature = temperature

        # Calculate base response
        base_power = super().calculate_power_response(frequency, rocof)

        # Apply SOC-dependent scaling
        soc_factor = self._get_soc_factor(self.soc, frequency)

        # Apply temperature-dependent scaling
        temp_factor = self._get_temperature_factor(self.temperature)

        # Adaptive power response
        adaptive_power = base_power * soc_factor * temp_factor

        logger.debug(
            f"Adaptive response: base={base_power:.2f} kW, "
            f"SOC_factor={soc_factor:.2f}, temp_factor={temp_factor:.2f}, "
            f"final={adaptive_power:.2f} kW"
        )

        return adaptive_power

    def _get_soc_factor(self, soc: float, frequency: float) -> float:
        """
        Calculate SOC-dependent scaling factor

        Logic:
        - At high SOC: Full discharge capability, limited charge
        - At low SOC: Full charge capability, limited discharge
        """
        freq_deviation = frequency - self.f_nominal

        if freq_deviation < 0:  # Low frequency → need to discharge
            # Scale discharge capability based on SOC
            if soc > 80:
                return 1.0  # Full discharge
            elif soc > 50:
                return 0.7  # Reduced discharge
            elif soc > 20:
                return 0.3  # Minimal discharge
            else:
                return 0.0  # No discharge (preserve battery)

        else:  # High frequency → need to charge
            # Scale charge capability based on available capacity
            if soc < 20:
                return 1.0  # Full charge
            elif soc < 50:
                return 0.7  # Reduced charge
            elif soc < 80:
                return 0.3  # Minimal charge
            else:
                return 0.0  # No charge (battery full)

    def _get_temperature_factor(self, temperature: float) -> float:
        """
        Calculate temperature-dependent scaling factor

        Logic:
        - Optimal temperature range: 15-35°C → full power
        - Cold (<15°C) → reduced power
        - Hot (>35°C) → reduced power
        - Critical (>50°C) → minimal power
        """
        if 15 <= temperature <= 35:
            return 1.0  # Optimal temperature

        elif temperature < 15:
            # Cold - reduce power linearly
            return max(0.5, 1.0 - (15 - temperature) * 0.02)

        elif temperature < 50:
            # Warm - reduce power gradually
            return max(0.5, 1.0 - (temperature - 35) * 0.02)

        else:
            # Critical temperature - minimal power
            return 0.2


# IEGC compliance checker
class IEGCComplianceChecker:
    """
    Verify compliance with IEGC frequency response requirements
    """

    def __init__(self):
        self.response_history = []

    def check_response_time(self, event_time: float, response_time: float) -> bool:
        """
        Check if response time meets IEGC requirements

        Args:
            event_time: Time of frequency event (seconds)
            response_time: Time when response started (seconds)

        Returns:
            True if compliant (response within 5 seconds)
        """
        delay = response_time - event_time

        if delay <= 5.0:
            logger.info(f"IEGC COMPLIANT: Response time {delay:.2f}s <= 5s")
            return True
        else:
            logger.warning(f"IEGC NON-COMPLIANT: Response time {delay:.2f}s > 5s")
            return False

    def check_droop_accuracy(
        self,
        frequency: float,
        power_response: float,
        max_power: float,
        droop_percent: float = 5.0
    ) -> bool:
        """
        Check if droop response matches required droop characteristic

        Returns:
            True if within ±5% of expected response
        """
        freq_deviation = frequency - 50.0
        droop_fraction = droop_percent / 100.0

        # Expected power response
        expected_power = - (max_power / droop_fraction) * (freq_deviation / 50.0)

        # Check tolerance (±5%)
        tolerance = abs(expected_power) * 0.05
        error = abs(power_response - expected_power)

        if error <= tolerance:
            logger.debug(f"Droop response accurate: error={error:.2f} kW")
            return True
        else:
            logger.warning(
                f"Droop response inaccurate: "
                f"expected={expected_power:.2f} kW, "
                f"actual={power_response:.2f} kW, "
                f"error={error:.2f} kW"
            )
            return False
