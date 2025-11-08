import sys
from pathlib import Path
from loguru import logger
from src.config.config import config

# Remove default handler
logger.remove()

# Ensure log directory exists
log_dir = Path(config.LOG_DIR)
log_dir.mkdir(parents=True, exist_ok=True)

# Add console handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level=config.LOG_LEVEL,
    colorize=True
)

# Add file handler
log_file = log_dir / "ml_pipeline_{time:YYYY-MM-DD}.log"
logger.add(
    str(log_file),
    rotation="1 day",
    retention="30 days",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
    level=config.LOG_LEVEL
)