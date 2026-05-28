import os
from slowapi import Limiter
from slowapi.util import get_remote_address

_enabled = os.environ.get("RATELIMIT_ENABLED", "1") not in ("0", "false", "False")
limiter = Limiter(key_func=get_remote_address, enabled=_enabled)
