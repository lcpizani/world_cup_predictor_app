import json
import sys
from datetime import datetime, timezone


class Logger:
    def _emit(self, severity: str, message: str, **kwargs) -> None:
        payload = {
            "severity": severity,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        payload.update(kwargs)
        print(json.dumps(payload, default=str), file=sys.stdout, flush=True)

    def debug(self, message: str, **kwargs) -> None:
        self._emit("DEBUG", message, **kwargs)

    def info(self, message: str, **kwargs) -> None:
        self._emit("INFO", message, **kwargs)

    def warning(self, message: str, **kwargs) -> None:
        self._emit("WARNING", message, **kwargs)

    def error(self, message: str, **kwargs) -> None:
        self._emit("ERROR", message, **kwargs)

    def critical(self, message: str, **kwargs) -> None:
        self._emit("CRITICAL", message, **kwargs)


logger = Logger()
