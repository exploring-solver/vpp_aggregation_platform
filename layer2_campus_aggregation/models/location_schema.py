"""
Location Hierarchy Schema
Defines geographic and organizational hierarchy for BESS deployment
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class LocationLevel(str, Enum):
    """Hierarchical location levels"""
    COUNTRY = "country"
    STATE = "state"
    CITY = "city"
    CAMPUS = "campus"
    BUILDING = "building"
    NODE = "node"


class NodeType(str, Enum):
    """Type of edge node"""
    BESS = "bess"                    # Battery Energy Storage System
    DATA_CENTER = "data_center"      # Data center facility
    SOLAR = "solar"                  # Solar PV plant
    WIND = "wind"                    # Wind farm
    HYBRID = "hybrid"                # Hybrid facility


class NodeStatus(str, Enum):
    """Node operational status"""
    ONLINE = "online"
    OFFLINE = "offline"
    FAULT = "fault"
    MAINTENANCE = "maintenance"
    STANDBY = "standby"


class GeoLocation(BaseModel):
    """Geographic coordinates"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None  # meters above sea level


class NodeCapacity(BaseModel):
    """Node capacity specifications"""
    rated_power_kw: float            # Maximum power (kW)
    energy_capacity_kwh: float       # Energy storage capacity (kWh)
    available_power_kw: float        # Currently available power
    available_energy_kwh: float      # Currently available energy


class Node(BaseModel):
    """Individual BESS or edge node"""
    node_id: str = Field(..., description="Unique node identifier")
    name: str
    type: NodeType
    status: NodeStatus = NodeStatus.OFFLINE

    # Hierarchy
    building_id: str
    campus_id: str
    city_id: str
    state_id: str
    country_id: str

    # Technical specifications
    capacity: NodeCapacity
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    installation_date: Optional[datetime] = None

    # Current state
    soc: Optional[float] = None      # State of Charge (%)
    soh: Optional[float] = None      # State of Health (%)
    power_kw: Optional[float] = None # Current power output
    temperature: Optional[float] = None

    # Connection info
    endpoint_url: Optional[str] = None
    last_seen: Optional[datetime] = None

    # Metadata
    tags: Dict[str, str] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Building(BaseModel):
    """Building within a campus"""
    building_id: str
    name: str
    campus_id: str

    # Location
    geo_location: Optional[GeoLocation] = None
    address: Optional[str] = None

    # Nodes
    nodes: List[Node] = Field(default_factory=list)

    # Aggregate capacity
    total_capacity_kwh: float = 0.0
    total_power_kw: float = 0.0

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def aggregate_capacity(self) -> NodeCapacity:
        """Calculate aggregate capacity of all nodes"""
        total_power = sum(node.capacity.rated_power_kw for node in self.nodes)
        total_energy = sum(node.capacity.energy_capacity_kwh for node in self.nodes)
        available_power = sum(node.capacity.available_power_kw for node in self.nodes if node.status == NodeStatus.ONLINE)
        available_energy = sum(node.capacity.available_energy_kwh for node in self.nodes if node.status == NodeStatus.ONLINE)

        return NodeCapacity(
            rated_power_kw=total_power,
            energy_capacity_kwh=total_energy,
            available_power_kw=available_power,
            available_energy_kwh=available_energy
        )


class Campus(BaseModel):
    """Data center campus (multiple buildings/BESS units)"""
    campus_id: str
    name: str
    city_id: str
    state_id: str
    country_id: str

    # Location
    geo_location: GeoLocation
    address: str
    timezone: str = "UTC"

    # Infrastructure
    buildings: List[Building] = Field(default_factory=list)

    # Grid connection
    grid_connection_point: Optional[str] = None  # Substation name
    grid_voltage_kv: Optional[float] = None      # Connection voltage (kV)

    # Aggregate stats
    total_nodes: int = 0
    online_nodes: int = 0

    # Metadata
    operator: Optional[str] = None
    contact_email: Optional[str] = None
    tags: Dict[str, str] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def aggregate_capacity(self) -> NodeCapacity:
        """Calculate aggregate capacity of entire campus"""
        total_power = 0.0
        total_energy = 0.0
        available_power = 0.0
        available_energy = 0.0

        for building in self.buildings:
            cap = building.aggregate_capacity()
            total_power += cap.rated_power_kw
            total_energy += cap.energy_capacity_kwh
            available_power += cap.available_power_kw
            available_energy += cap.available_energy_kwh

        return NodeCapacity(
            rated_power_kw=total_power,
            energy_capacity_kwh=total_energy,
            available_power_kw=available_power,
            available_energy_kwh=available_energy
        )

    def get_all_nodes(self) -> List[Node]:
        """Get all nodes across all buildings"""
        nodes = []
        for building in self.buildings:
            nodes.extend(building.nodes)
        return nodes


class City(BaseModel):
    """City with multiple campuses"""
    city_id: str
    name: str
    state_id: str
    country_id: str

    campuses: List[Campus] = Field(default_factory=list)

    # Metadata
    population: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class State(BaseModel):
    """State/Province"""
    state_id: str
    name: str
    country_id: str

    cities: List[City] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class Country(BaseModel):
    """Country (top level)"""
    country_id: str
    name: str
    code: str  # ISO country code

    states: List[State] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# Aggregate telemetry schemas
class CampusTelemetry(BaseModel):
    """Aggregated telemetry for a campus"""
    campus_id: str
    timestamp: datetime

    # Aggregate power
    total_power_kw: float
    total_capacity_kwh: float
    average_soc: float
    average_soh: float

    # Node counts
    total_nodes: int
    online_nodes: int
    fault_nodes: int

    # Statistics
    min_soc: float
    max_soc: float
    total_energy_available_kwh: float


class RegionalTelemetry(BaseModel):
    """Aggregated telemetry for a region (city/state)"""
    region_id: str
    region_level: LocationLevel
    timestamp: datetime

    # Aggregate metrics
    total_power_kw: float
    total_capacity_kwh: float
    average_soc: float

    # Campus breakdown
    num_campuses: int
    num_online_nodes: int
    num_total_nodes: int

    campuses: List[CampusTelemetry] = Field(default_factory=list)
