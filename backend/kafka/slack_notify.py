import os
import json
import time
import logging
from typing import Optional
from urllib import request, error

logger = logging.getLogger(__name__)


def _try_load_env() -> None:
    if os.getenv("SLACK_WEBHOOK_URL"):
        return
    cwd = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.join(cwd, ".env"),
        os.path.abspath(os.path.join(cwd, "..", ".env")),
        os.path.abspath(os.path.join(cwd, "..", "..", ".env")),
        os.path.abspath(os.path.join(cwd, "..", "..", "..", ".env")),
    ]
    for path in candidates:
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and v and not os.getenv(k):
                            os.environ[k] = v
                break
        except Exception:
            continue


def _post_webhook(url: str, payload: dict, timeout: float = 5.0) -> int:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with request.urlopen(req, timeout=timeout) as resp:
        return resp.getcode()


def send_slack_alert(severity: str, trace_id: Optional[str] = None, summary: Optional[str] = None, host: Optional[str] = None) -> bool:
    _try_load_env()
    url = os.getenv("SLACK_WEBHOOK_URL", "").strip()
    if not url:
        logger.warning("SLACK_WEBHOOK_URL not set")
        return False
    text = f"위험도가 {severity}인 알림이 발생했습니다"
    payload = {"text": text}
    delay = 1.0
    for attempt in range(3):
        try:
            code = _post_webhook(url, payload)
            ok = 200 <= code < 300
            if not ok:
                logger.warning(f"Slack webhook non-2xx: {code}")
            return ok
        except error.HTTPError as e:
            if e.code == 429:
                wait = 0
                try:
                    wait = int(e.headers.get("Retry-After", "1"))
                except Exception:
                    wait = 1
                time.sleep(max(0, wait))
                continue
            if 500 <= e.code < 600:
                time.sleep(delay)
                delay = min(delay * 2, 8.0)
                continue
            logger.warning(f"Slack webhook HTTPError: {e.code}")
            return False
        except Exception as ex:
            time.sleep(delay)
            delay = min(delay * 2, 8.0)
            if attempt == 2:
                logger.warning(f"Slack webhook error: {ex}")
    return False 