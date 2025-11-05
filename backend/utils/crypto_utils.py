import os
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

# .env 파일 직접 로드 (다른 모듈이 로드하기 전에 실행될 수 있으므로)
_env_loaded = False
def _ensure_env_loaded():
	global _env_loaded
	if _env_loaded:
		return
	env_path = Path(__file__).resolve().parent.parent / ".env"
	try:
		load_dotenv(env_path, encoding="utf-8-sig")
	except Exception:
		try:
			load_dotenv(env_path, encoding="utf-8")
		except Exception:
			try:
				load_dotenv(env_path, encoding="cp949")
			except Exception:
				load_dotenv()
	_env_loaded = True

_key: Optional[bytes] = None
_cipher: Optional[Fernet] = None

def _load_key() -> Fernet:
	global _key, _cipher
	if _cipher is not None:
		return _cipher
	_ensure_env_loaded()
	key_str = os.getenv("SLACK_ENC_KEY")
	if not key_str:
		raise RuntimeError("Missing SLACK_ENC_KEY for Slack settings encryption")
	try:
		_key = key_str.encode("utf-8")
		_cipher = Fernet(_key)
		return _cipher
	except Exception as e:
		raise RuntimeError(f"Invalid SLACK_ENC_KEY: {e}")

def encrypt_str(plain_text: str) -> str:
	cipher = _load_key()
	return cipher.encrypt(plain_text.encode("utf-8")).decode("utf-8")

def decrypt_str(token_str: str) -> str:
	cipher = _load_key()
	try:
		return cipher.decrypt(token_str.encode("utf-8")).decode("utf-8")
	except InvalidToken:
		raise RuntimeError("Failed to decrypt stored Slack webhook URL") 