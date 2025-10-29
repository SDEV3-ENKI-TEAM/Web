import sys
from pathlib import Path
from typing import Optional

backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
import httpx
import logging

from database.database import get_db, SlackSettings
from utils.auth_deps import get_current_user_with_roles
from utils.crypto_utils import encrypt_str, decrypt_str

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user_with_roles)])
logger = logging.getLogger(__name__)

class SlackSettingsIn(BaseModel):
	webhook_url: HttpUrl
	channel: Optional[str] = None
	enabled: bool

class SlackSettingsOut(BaseModel):
	webhook_url_masked: str
	channel: Optional[str]
	enabled: bool

class SlackEnabledIn(BaseModel):
	enabled: bool

@router.get("/slack", response_model=SlackSettingsOut)
async def get_slack_settings(db: Session = Depends(get_db)):
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if not row:
		return SlackSettingsOut(webhook_url_masked="", channel=None, enabled=False)
	try:
		dec = decrypt_str(row.webhook_url_enc)
	except (ValueError, TypeError) as e:
		logger.warning(f"Slack webhook URL 복호화 오류: {e}")
		dec = ""
	except Exception as e:
		logger.warning(f"Slack webhook URL 복호화 중 예상치 못한 오류: {e}")
		dec = ""
	masked = dec[:16] + "****" if dec else ""
	return SlackSettingsOut(webhook_url_masked=masked, channel=row.channel, enabled=row.enabled)

@router.put("/slack", response_model=SlackSettingsOut)
async def put_slack_settings(payload: SlackSettingsIn, db: Session = Depends(get_db)):
	enc = encrypt_str(str(payload.webhook_url))
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if row:
		row.webhook_url_enc = enc
		row.channel = payload.channel
		row.enabled = payload.enabled
	else:
		row = SlackSettings(webhook_url_enc=enc, channel=payload.channel, enabled=payload.enabled)
		db.add(row)
	db.commit()
	db.refresh(row)
	masked = str(payload.webhook_url)[:16] + "****"
	return SlackSettingsOut(webhook_url_masked=masked, channel=row.channel, enabled=row.enabled)

@router.patch("/slack/enabled", response_model=SlackSettingsOut)
async def patch_slack_enabled(payload: SlackEnabledIn, db: Session = Depends(get_db)):
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if not row:
		if payload.enabled:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack webhook required")
		row = SlackSettings(webhook_url_enc="", channel=None, enabled=False)
		db.add(row)
	else:
		if payload.enabled and not row.webhook_url_enc:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack webhook required")
	row.enabled = payload.enabled
	db.commit()
	db.refresh(row)
	try:
		dec = decrypt_str(row.webhook_url_enc) if row.webhook_url_enc else ""
	except (ValueError, TypeError) as e:
		logger.warning(f"Slack webhook URL 복호화 오류 (PUT): {e}")
		dec = ""
	except Exception as e:
		logger.warning(f"Slack webhook URL 복호화 중 예상치 못한 오류 (PUT): {e}")
		dec = ""
	masked = dec[:16] + "****" if dec else ""
	return SlackSettingsOut(webhook_url_masked=masked, channel=row.channel, enabled=row.enabled)

class SlackTestOut(BaseModel):
	success: bool
	status_code: Optional[int] = None
	message: Optional[str] = None

@router.post("/slack/test", response_model=SlackTestOut)
async def test_slack(db: Session = Depends(get_db)):
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if not row or not row.enabled:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack not configured or disabled")
	try:
		webhook = decrypt_str(row.webhook_url_enc)
	except (ValueError, TypeError) as e:
		logger.error(f"Slack webhook URL 복호화 오류 (TEST): {e}")
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack webhook invalid")
	except Exception as e:
		logger.error(f"Slack webhook URL 복호화 중 예상치 못한 오류 (TEST): {e}")
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack webhook invalid")
	payload = {
		"text": "Slack 설정 테스트",
	}
	if row.channel:
		payload["channel"] = row.channel
	try:
		async with httpx.AsyncClient(timeout=10.0) as client:
			resp = await client.post(webhook, json=payload)
			ok = 200 <= resp.status_code < 300
			return SlackTestOut(success=ok, status_code=resp.status_code, message=resp.text if not ok else None)
	except httpx.HTTPError as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Slack request failed: {e}")

@router.delete("/slack")
async def delete_slack_settings(db: Session = Depends(get_db)):
	"""Slack 설정 완전 삭제"""
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if row:
		db.delete(row)
		db.commit()
	return {"message": "Slack 설정이 삭제되었습니다"}

@router.post("/slack/reset")
async def reset_slack_settings(db: Session = Depends(get_db)):
	"""Slack 설정 초기화 (POST 메서드)"""
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if row:
		db.delete(row)
		db.commit()
	return {"message": "Slack 설정이 초기화되었습니다"} 