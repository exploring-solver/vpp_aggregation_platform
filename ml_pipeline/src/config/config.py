import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

class Config:
    # ============================================================================
    # DATABASE CONFIGURATION
    # ============================================================================
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "vpp_platform")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # ============================================================================
    # ML SERVICE CONFIGURATION (THIS SERVICE)
    # ============================================================================
    ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
    ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", 5000))
    
    # ============================================================================
    # NODE.JS BACKEND CONFIGURATION (WHERE TO SEND COMMANDS & GET DATA)
    # ============================================================================
    # This is your Node.js backend that manages the system
    NODEJS_BACKEND_URL = os.getenv("NODEJS_BACKEND_URL", "http://localhost:4000")
    
    # Specific endpoints on Node.js backend
    NODEJS_ENDPOINTS = {
        # Send control commands here
        'control_execute': '/api/control/execute',
        
        # Send forecasts here
        'forecast_update': '/api/ml/forecasts',
        
        # Send optimization results here
        'optimization_update': '/api/ml/optimization',
        
        # Get active nodes list
        'nodes_list': '/api/nodes',
        
        # Get node telemetry
        'node_telemetry': '/api/telemetry/{node_id}',
        
        # Health check
        'health': '/health'
    }
    
    # ============================================================================
    # IOT/EDGE LAYER CONFIGURATION (MQTT for direct hardware control)
    # ============================================================================
    # MQTT Broker (for direct communication with battery systems)
    MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
    MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
    MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
    
    # MQTT Topics
    MQTT_TOPICS = {
        'control_command': 'vpp/control/{node_id}/command',  # Send commands
        'telemetry_data': 'vpp/telemetry/{node_id}/data',    # Receive telemetry
        'status_update': 'vpp/status/{node_id}/update',      # Receive status
        'alarm': 'vpp/alarm/{node_id}/alert'                 # Receive alarms
    }
    
    # ============================================================================
    # DATA INGESTION CONFIGURATION
    # ============================================================================
    # Where ML service receives data FROM
    DATA_INGESTION_MODE = os.getenv("DATA_INGESTION_MODE", "pull")  # 'pull' or 'push'
    
    # If PULL mode: ML service queries Node.js backend
    PULL_INTERVAL_SECONDS = int(os.getenv("PULL_INTERVAL_SECONDS", 60))
    
    # If PUSH mode: Node.js pushes to ML service
    ML_WEBHOOK_PATH = "/webhook/telemetry"  # Node.js posts data here
    
    # ============================================================================
    # MODEL CONFIGURATION
    # ============================================================================
    MODEL_SAVE_PATH = Path(os.getenv("MODEL_SAVE_PATH", "saved_models"))
    
    # Foundation Model
    FOUNDATION_MODEL_ENABLED = os.getenv("FOUNDATION_MODEL_ENABLED", "true").lower() == "true"
    FOUNDATION_MODEL_SIZE = os.getenv("FOUNDATION_MODEL_SIZE", "small")  # small, base, large
    
    # RL Model
    RL_ALGORITHM = os.getenv("RL_ALGORITHM", "PPO")  # PPO or DQN
    RL_TRAINING_ENABLED = os.getenv("RL_TRAINING_ENABLED", "true").lower() == "true"
    
    # LLM for Strategic Decisions
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    LLM_ENABLED = bool(OPENAI_API_KEY)
    
    # ============================================================================
    # CONTROL MODE
    # ============================================================================
    # 'autonomous' - Automatically execute commands
    # 'advisory' - Only provide recommendations
    DEFAULT_CONTROL_MODE = os.getenv("DEFAULT_CONTROL_MODE", "advisory")
    
    # ============================================================================
    # SAFETY LIMITS
    # ============================================================================
    MIN_SOC = float(os.getenv("MIN_SOC", 20.0))
    MAX_SOC = float(os.getenv("MAX_SOC", 90.0))
    MAX_CHARGE_RATE = float(os.getenv("MAX_CHARGE_RATE", 250.0))
    MAX_DISCHARGE_RATE = float(os.getenv("MAX_DISCHARGE_RATE", 250.0))
    MIN_FREQUENCY = float(os.getenv("MIN_FREQUENCY", 49.7))
    MAX_FREQUENCY = float(os.getenv("MAX_FREQUENCY", 50.3))
    
    # ============================================================================
    # CORS & SECURITY
    # ============================================================================
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:4000").split(",")
    API_KEY = os.getenv("API_KEY", "")  # Optional API key for securing endpoints
    
    # ============================================================================
    # LOGGING
    # ============================================================================
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR = os.getenv("LOG_DIR", "logs")

config = Config()