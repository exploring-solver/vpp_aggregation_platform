from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Node Identity - Used for identifier-based authentication
    NODE_ID: str = Field(..., description="Unique node identifier (e.g., DC01, DC02)")
    NODE_NAME: str = Field("", description="Human-readable node name")
    NODE_KEY: str = Field(..., description="Secret key for authenticating this node with the aggregator")
    NODE_LOCATION: str = Field("", description="Geographic location of this node")

    # Legacy field for backward compatibility (maps to NODE_ID)
    @property
    def DC_ID(self):
        return self.NODE_ID

    # Server
    PORT: int = 8000

    # MQTT Configuration
    MQTT_ENABLED: bool = True
    MQTT_BROKER_URL: str = "mqtt://localhost:1883"
    MQTT_USERNAME: str | None = None
    MQTT_PASSWORD: str | None = None

    # HTTP Aggregator
    AGGREGATOR_URL: str = "http://localhost:3000"

    # Telemetry
    TELEMETRY_INTERVAL: int = 5  # seconds

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
