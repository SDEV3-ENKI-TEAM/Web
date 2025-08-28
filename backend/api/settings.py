from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
import httpx

from database.database import get_db, SlackSettings
from utils.auth_deps import get_current_user_with_roles
from utils.crypto_utils import encrypt_str, decrypt_str

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user_with_roles)])

class SlackSettingsIn(BaseModel):
	webhook_url: HttpUrl
	channel: Optional[str] = None
	enabled: bool

class SlackSettingsOut(BaseModel):
	webhook_url_masked: str
	channel: Optional[str]
	enabled: bool

@router.get("/slack", response_model=SlackSettingsOut)
async def get_slack_settings(db: Session = Depends(get_db)):
	row = db.query(SlackSettings).order_by(SlackSettings.id.asc()).first()
	if not row:
		return SlackSettingsOut(webhook_url_masked="", channel=None, enabled=False)
	try:
		dec = decrypt_str(row.webhook_url_enc)
	except Exception:
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
	except Exception:
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