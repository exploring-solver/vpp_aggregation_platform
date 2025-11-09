from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import asyncio
from datetime import datetime
import sys
from pathlib import Path

# Add the src directory to the Python path
src_dir = Path(__file__).resolve().parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

# Import from src level packages
from controllers import workload_orchestrator
from services.data_ingestion_service import data_ingestion_service
from config import db
from config.config import config
from utils.logger import logger
from training.scheduler import training_scheduler
from orchestrator.hybrid_orchestrator import hybrid_orchestrator
from models.foundation_forecaster import foundation_forecaster
from controllers.power_flow_controller import power_controller

# Import routes from the api.routes package (relative to current api folder)
from api.routes import forecast, optimization, training, control, insights, webhook

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("=" * 80)
    logger.info("🚀 Starting Intelligent VPP Control System")
    logger.info("=" * 80)
    
    try:
        # Connect to databases
        logger.info("📊 Connecting to databases...")
        await db.db_manager.connect_mongodb()
        await db.db_manager.connect_redis()
        logger.info("✅ Database connections established")
        
        # Initialize foundation forecaster
        logger.info("🧠 Loading foundation models...")
        if foundation_forecaster.pipeline:
            logger.info("✅ Foundation model loaded (zero-shot forecasting enabled)")
        else:
            logger.warning("⚠️  Foundation model unavailable (using fallback)")
        
        # Initialize hybrid orchestrator
        logger.info("🎯 Initializing hybrid orchestrator...")
        await hybrid_orchestrator.initialize()
        logger.info("✅ Hybrid orchestrator ready")
        
        # Start training scheduler
        logger.info("⏰ Starting training scheduler...")
        training_scheduler.start()
        logger.info("✅ Training scheduler started")
        
        # Start data ingestion service
        logger.info("📥 Starting data ingestion service...")
        await data_ingestion_service.start()
        if config.DATA_INGESTION_MODE == 'pull':
            logger.info(f"✅ Data ingestion started (PULL mode - interval: {config.PULL_INTERVAL_SECONDS}s)")
        else:
            logger.info("✅ Data ingestion started (PUSH mode - webhook ready)")
        
        # Log system capabilities
        logger.info("=" * 80)
        logger.info("🎉 Intelligent VPP System Ready")
        logger.info("=" * 80)
        logger.info("📡 Capabilities:")
        logger.info("  • Zero-shot forecasting (Day 1)")
        logger.info("  • Fine-tuned forecasting (after 7 days)")
        logger.info("  • RL-based optimization")
        logger.info("  • LLM strategic decisions")
        logger.info("  • Autonomous power control")
        logger.info("  • Workload orchestration")
        logger.info("  • Grid frequency regulation")
        logger.info("\n🔧 Configuration:")
        logger.info(f"  • Control Mode: {hybrid_orchestrator.control_mode.upper()}")
        logger.info(f"  • Valid Commands: {', '.join(power_controller.valid_commands)}")
        logger.info(f"  • Node.js Backend: {config.NODEJS_BACKEND_URL}")
        logger.info(f"  • Data Ingestion: {config.DATA_INGESTION_MODE.upper()} mode")
        logger.info(f"  • ML Service Port: {config.ML_SERVICE_PORT}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}", exc_info=True)
        raise
    
    yield
    
    # Shutdown
    logger.info("=" * 80)
    logger.info("⏹️  Shutting down Intelligent VPP System...")
    logger.info("=" * 80)
    
    try:
        # Stop data ingestion service
        logger.info("⏸️  Stopping data ingestion service...")
        await data_ingestion_service.stop()
        logger.info("✅ Data ingestion stopped")
        
        # Stop training scheduler
        logger.info("⏸️  Stopping training scheduler...")
        training_scheduler.stop()
        logger.info("✅ Training scheduler stopped")
        
        # Close database connections
        logger.info("🔌 Closing database connections...")
        await db.db_manager.close()
        logger.info("✅ Database connections closed")
        
        logger.info("=" * 80)
        logger.info("✅ Shutdown complete")
        logger.info("=" * 80)
    except Exception as e:
        logger.error(f"⚠️  Error during shutdown: {e}")
        
# Create FastAPI app
app = FastAPI(
    title="Intelligent VPP Control System",
    description="""
    # 🧠 Module 6: AI/ML Training, Continuous Learning & Autonomous Control
    
    ## Features
    
    ### 🔮 Forecasting
    - **Zero-shot predictions** from Day 1 using pretrained foundation models
    - **Fine-tuned predictions** after 7-14 days of data collection
    - Power output, price, and demand forecasting
    
    ### 🎯 Optimization
    - **RL-based** real-time decision making
    - **Strategic LLM** assessments for market participation
    - **Workload orchestration** for cost savings
    
    ### ⚡ Control
    - **Autonomous execution** of power commands
    - **4 Command Types**: Charge, Discharge, Hold, Load Deferral
    - **Safety validation** before every action
    - **Grid frequency regulation** in real-time
    
    ### 📊 Intelligence
    - **Pattern learning** from historical data
    - **Anomaly detection** and explanation
    - **Daily insights** generation
    - **Performance monitoring** and suggestions
    
    ## Quick Start
    
    1. **Orchestrate System**: `POST /control/orchestrate`
    2. **Execute Command**: `POST /control/power/execute`
    3. **Get Insights**: `GET /insights/daily-summary`
    4. **View Health**: `GET /health`
    
    ## Safety Features
    - SOC limits (20%-90%)
    - Rate limits (250 kW max)
    - Frequency bounds (49.7-50.3 Hz)
    - Command validation
    - Automatic fallbacks
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware

# If CORS_ORIGINS contains "*", we need to handle it specially
# FastAPI doesn't allow "*" with allow_credentials=True
cors_origins = config.CORS_ORIGINS
if cors_origins == ["*"]:
    # Allow all origins but disable credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Use specific origins with credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"📤 {request.method} {request.url.path} - Status: {response.status_code}")
    return response

# Include routers
app.include_router(forecast.router)
app.include_router(optimization.router)
app.include_router(training.router)
app.include_router(control.router)
app.include_router(insights.router)
app.include_router(webhook.router)

# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """
    Root endpoint - System information
    """
    return {
        "service": "Intelligent VPP Control System",
        "version": "2.0.0",
        "module": "Module 6 - Enhanced",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "capabilities": {
            "forecasting": {
                "type": "Foundation models + fine-tuning",
                "bootstrap_time": "0 days (zero-shot)",
                "optimal_after": "7-14 days"
            },
            "optimization": {
                "type": "RL-based real-time optimization",
                "algorithm": "PPO/DQN"
            },
            "intelligence": {
                "type": "LLM-powered strategic decisions",
                "provider": "Groq Mixtral-8x7b"
            },
            "control": {
                "type": "Autonomous power flow control",
                "mode": hybrid_orchestrator.control_mode,
                "commands": power_controller.valid_commands
            },
            "workload": {
                "type": "Intelligent workload orchestration",
                "features": ["pattern learning", "deferral suggestions", "schedule optimization"]
            }
        },
        "endpoints": {
            "forecast": {
                "path": "/forecast",
                "description": "Power and price forecasting"
            },
            "optimization": {
                "path": "/optimization",
                "description": "RL-based optimization recommendations"
            },
            "training": {
                "path": "/training",
                "description": "Model training and management"
            },
            "control": {
                "path": "/control",
                "description": "Power flow control and orchestration"
            },
            "insights": {
                "path": "/insights",
                "description": "AI-generated insights and analytics"
            },
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health"
        },
        "safety": {
            "soc_limits": f"{power_controller.safety_limits['min_soc']}-{power_controller.safety_limits['max_soc']}%",
            "frequency_bounds": f"{power_controller.safety_limits['min_frequency']}-{power_controller.safety_limits['max_frequency']} Hz",
            "max_charge_rate": f"{power_controller.safety_limits['max_charge_rate']} kW",
            "max_discharge_rate": f"{power_controller.safety_limits['max_discharge_rate']} kW"
        }
    }

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """
    Comprehensive health check for all system components
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": time.time(),
        "services": {},
        "capabilities": {},
        "statistics": {}
    }
    
    # Check MongoDB
    try:
        await db.db_manager.mongo_db.command('ping')
        health_status["services"]["mongodb"] = {
            "status": "connected",
            "host": config.MONGO_URI.split('@')[-1] if '@' in config.MONGO_URI else "localhost"
        }
    except Exception as e:
        health_status["services"]["mongodb"] = {
            "status": "disconnected",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        if db.db_manager.redis_client:
            await db.db_manager.redis_client.ping()
            health_status["services"]["redis"] = {
                "status": "connected",
                "url": config.REDIS_URL
            }
        else:
            health_status["services"]["redis"] = {
                "status": "not_configured",
                "note": "Redis is optional for caching"
            }
    except Exception as e:
        health_status["services"]["redis"] = {
            "status": "disconnected",
            "error": str(e)
        }
    
    # Check training scheduler
    scheduler_running = training_scheduler.scheduler.running if hasattr(training_scheduler, 'scheduler') else False
    health_status["services"]["scheduler"] = {
        "status": "running" if scheduler_running else "stopped",
        "active_jobs": len(training_scheduler.scheduler.get_jobs()) if scheduler_running else 0
    }
    
    # Check orchestrator
    health_status["capabilities"]["orchestrator"] = {
        "status": "initialized",
        "control_mode": hybrid_orchestrator.control_mode,
        "valid_commands": power_controller.valid_commands
    }
    
    # Check foundation model
    if foundation_forecaster.pipeline:
        health_status["capabilities"]["foundation_model"] = {
            "status": "loaded",
            "model": "chronos",
            "features": ["zero-shot", "fine-tuning"]
        }
    else:
        health_status["capabilities"]["foundation_model"] = {
            "status": "unavailable",
            "fallback": "simple_forecasting",
            "note": "System works without foundation model"
        }
    
    # Check RL model
    try:
        rl_loaded = hybrid_orchestrator.rl_optimizer.model is not None
        health_status["capabilities"]["rl_optimizer"] = {
            "status": "loaded" if rl_loaded else "not_trained",
            "fallback": "heuristic_rules" if not rl_loaded else None
        }
    except:
        health_status["capabilities"]["rl_optimizer"] = {
            "status": "error",
            "fallback": "heuristic_rules"
        }
    
    # Get active controls count
    try:
        active_controls = await power_controller.get_active_controls()
        health_status["statistics"]["active_controls"] = len(active_controls)
    except:
        health_status["statistics"]["active_controls"] = 0
    
    # Get learned patterns count
    health_status["statistics"]["learned_patterns"] = len(workload_orchestrator.learned_patterns) if hasattr(workload_orchestrator, 'learned_patterns') else 0
    
    # Overall status
    if health_status["services"]["mongodb"]["status"] != "connected":
        health_status["status"] = "critical"
    elif health_status["status"] == "degraded":
        health_status["status"] = "degraded"
    else:
        health_status["status"] = "healthy"
    
    return health_status

# Status endpoint
@app.get("/status", tags=["System"])
async def system_status():
    """
    Quick system status check
    """
    try:
        active_controls = await power_controller.get_active_controls()
        
        return {
            "online": True,
            "control_mode": hybrid_orchestrator.control_mode,
            "active_controls": len(active_controls),
            "valid_commands": power_controller.valid_commands,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "online": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# System info endpoint
@app.get("/info", tags=["System"])
async def system_info():
    """
    Detailed system information
    """
    return {
        "system": {
            "name": "Intelligent VPP Control System",
            "version": "2.0.0",
            "module": "Module 6",
            "description": "AI/ML Training, Continuous Learning & Autonomous Control"
        },
        "components": {
            "foundation_forecaster": {
                "enabled": foundation_forecaster.pipeline is not None,
                "type": "Chronos (Amazon)",
                "capabilities": ["zero-shot", "fine-tuning"]
            },
            "rl_optimizer": {
                "algorithms": ["PPO", "DQN"],
                "state_space": 6,
                "action_space": 5
            },
            "power_controller": {
                "commands": power_controller.valid_commands,
                "safety_limits": power_controller.safety_limits
            },
            "workload_orchestrator": {
                "features": ["pattern learning", "deferral suggestions", "schedule optimization"]
            },
            "intelligent_agent": {
                "type": "LLM-powered",
                "capabilities": ["strategic decisions", "explanations", "insights"]
            }
        },
        "configuration": {
            "ml_service_port": config.ML_SERVICE_PORT,
            "mongodb_connected": db.db_manager.mongo_db is not None,
            "redis_configured": config.REDIS_URL is not None,
            "nodejs_backend": config.NODEJS_BACKEND_URL
        }
    }

# Quick orchestration endpoint
@app.post("/quick-orchestrate/{node_id}", tags=["Quick Actions"])
async def quick_orchestrate_single_node(node_id: str):
    """
    Quick orchestration for a single node
    """
    try:
        results = await hybrid_orchestrator.orchestrate_complete_cycle(
            node_ids=[node_id],
            execute_controls=False  # Advisory mode for safety
        )
        
        return {
            "status": "success",
            "node_id": node_id,
            "results": results['nodes'].get(node_id, {}),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in quick orchestration: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Emergency stop endpoint
@app.post("/emergency-stop", tags=["Emergency"])
async def emergency_stop():
    """
    Emergency stop - Hold all nodes immediately
    """
    try:
        logger.warning("🚨 EMERGENCY STOP TRIGGERED")
        
        # Get all nodes with active controls
        active_controls = await power_controller.get_active_controls()
        
        results = []
        for node_id in active_controls.keys():
            result = await power_controller.control_node_power(
                node_id=node_id,
                action='Hold',
                magnitude=0,
                reason='EMERGENCY STOP',
                duration_minutes=60
            )
            results.append(result)
        
        return {
            "status": "emergency_stop_executed",
            "nodes_stopped": len(results),
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in emergency stop: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"❌ Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": str(request.url.path),
            "timestamp": datetime.now().isoformat()
        }
    )

# 404 handler
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not found",
            "message": f"Endpoint {request.url.path} not found",
            "available_endpoints": {
                "root": "/",
                "health": "/health",
                "docs": "/docs",
                "forecast": "/forecast",
                "optimization": "/optimization",
                "training": "/training",
                "control": "/control",
                "insights": "/insights"
            },
            "timestamp": datetime.now().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting server...")
    
    uvicorn.run(
        "api.main:app",
        host=config.ML_SERVICE_HOST,
        port=config.ML_SERVICE_PORT,
        reload=True,
        log_level="info",
        access_log=True
    )