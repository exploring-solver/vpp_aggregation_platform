#!/usr/bin/env python3
"""
Run script for ML Pipeline Service
This script ensures the correct paths are set up before running the main application.
"""

import sys
from pathlib import Path

# Add the src directory to Python path
ml_pipeline_root = Path(__file__).resolve().parent
src_dir = ml_pipeline_root / "src"
sys.path.insert(0, str(src_dir))

# Now run the main application
if __name__ == "__main__":
    from api import main as app
    import uvicorn
    from config.config import config
    from utils.logger import logger
    
    logger.info("🚀 Starting ML Pipeline Service...")
    logger.info(f"📂 ML Pipeline Root: {ml_pipeline_root}")
    logger.info(f"📂 Source Directory: {src_dir}")
    
    uvicorn.run(
        app,
        host=config.ML_SERVICE_HOST,
        port=config.ML_SERVICE_PORT,
        reload=True,
        log_level="info",
        access_log=True
    )
