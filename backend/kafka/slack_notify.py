import json
import time
import logging
import os
from typing import Optional
from urllib import request, error

from sqlalchemy.orm import Session

from backend.database.database import SessionLocal, SlackSettings
from backend.utils.crypto_utils import decrypt_str

logger = logging.getLogger(__name__)


def _post_webhook(url: str, payload: dict, timeout: float = 5.0) -> int:
	data = json.dumps(payload).encode("utf-8")
	req = request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
	with request.urlopen(req, timeout=timeout) as resp:
		return resp.getcode()


def _load_slack_config(session: Session) -> Optional[tuple[str, Optional[str]]]:
	row = session.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if not row or not row.enabled:
		return None
	try:
		url = decrypt_str(row.webhook_url_enc)
	except Exception:
		return None
	channel = row.channel if row.channel else None
	return (url, channel)


def send_slack_alert(severity: str, trace_id: Optional[str] = None, summary: Optional[str] = None, host: Optional[str] = None) -> bool:
	session = SessionLocal()
	try:
		conf = _load_slack_config(session)
		if not conf:
			return False
		url, channel = conf

		origin = os.getenv("FRONTEND_ORIGIN") or "http://localhost:3000"
		alert_url = f"{origin}/alarms/{trace_id}" if trace_id else origin
		parts = [f"위험도가 {severity}인 알림이 발생했습니다"]
		if summary:
			parts.append(f"요약: {summary}")
		parts.append(f"<{alert_url}|알람 열기>")
		text = "\n".join(parts)

		payload = {"text": text}
		if channel:
			payload["channel"] = channel
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
	finally:
		session.close() 