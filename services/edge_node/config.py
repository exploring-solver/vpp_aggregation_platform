from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Node Identity
    DC_ID: str = "DC01"
    
    # Server
    PORT: int = 8000
    
    # MQTT Configuration
    MQTT_ENABLED: bool = True
    MQTT_BROKER_URL: str = "mqtt://localhost:1883"
    MQTT_USERNAME: Optional[str] = None
    MQTT_PASSWORD: Optional[str] = None
    
    # HTTP Aggregator (fallback or alternative to MQTT)
    AGGREGATOR_URL: Optional[str] = "http://localhost:3000"
    
    # Telemetry
    TELEMETRY_INTERVAL: int = 5  # seconds
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
