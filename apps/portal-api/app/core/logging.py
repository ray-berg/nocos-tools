import logging
import sys

from app.core.settings import settings


def setup_logging() -> logging.Logger:
    level = logging.DEBUG if settings.debug else logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    logger = logging.getLogger("portal")
    logger.setLevel(level)

    # Reduce noise from third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    return logger


logger = setup_logging()
