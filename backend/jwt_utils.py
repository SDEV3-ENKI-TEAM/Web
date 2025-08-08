import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import jwt
import redis
from dotenv import load_dotenv
from fastapi import HTTPException, status
from passlib.context import CryptContext

from user_models import TokenPayload

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, encoding="utf-8-sig", override=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY")

if not SECRET_KEY or not isinstance(SECRET_KEY, str):
    raise RuntimeError("JWT_SECRET_KEY not set or invalid")
if not REFRESH_SECRET_KEY or not isinstance(REFRESH_SECRET_KEY, str):
    raise RuntimeError("JWT_REFRESH_SECRET_KEY not set or invalid")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30
ISSUER = "shitftx"
AUDIENCE = "shitftx-users"

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해시화"""
    return pwd_context.hash(password)

def add_to_blacklist(token: str, expires_in: int = 86400):
    """토큰을 블랙리스트에 추가"""
    try:
        redis_client.setex(f"blacklist:{token}", expires_in, "1")
        return True
    except Exception:
        return False

def is_blacklisted(token: str) -> bool:
    """토큰이 블랙리스트에 있는지 확인"""
    try:
        return redis_client.exists(f"blacklist:{token}") == 1
    except Exception:
        return False

def decode_jwt(token: str, is_refresh: bool = False) -> TokenPayload:
    """JWT 토큰 디코드 및 검증"""
    try:
        if is_blacklisted(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Token has been revoked"
            )
        
        secret_key = REFRESH_SECRET_KEY if is_refresh else SECRET_KEY
        payload = jwt.decode(
            token, 
            secret_key, 
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["exp", "sub", "user_id"]}
        )
        
        return TokenPayload(**payload)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid token"
        )

def _create_token_payload(data: dict, token_type: str, expires_delta: timedelta) -> dict:
    """토큰 페이로드 생성 헬퍼 함수"""
    if "user_id" not in data:
        raise ValueError("user_id must be included in token data")
    
    payload = data.copy()
    payload.update({
        "exp": datetime.utcnow() + expires_delta,
        "type": token_type,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": datetime.utcnow(),
        "nbf": datetime.utcnow()
    })
    return payload

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT Access Token 생성"""
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = _create_token_payload(data, "access", delta)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """JWT Refresh Token 생성"""
    payload = _create_token_payload(data, "refresh", timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    return jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """JWT Access Token 검증 - 사용자 정보 반환"""
    try:
        payload = decode_jwt(token, is_refresh=False)
        return {
            "username": payload.sub,
            "user_id": payload.user_id,
            "roles": payload.roles
        }
    except HTTPException:
        return None

def verify_refresh_token(token: str) -> Optional[dict]:
    """JWT Refresh Token 검증 - 사용자 정보 반환"""
    try:
        payload = decode_jwt(token, is_refresh=True)
        return {
            "username": payload.sub,
            "user_id": payload.user_id,
            "roles": payload.roles
        }
    except HTTPException:
        return None

def get_user_id_from_token(token: str) -> Optional[int]:
    """토큰에서 사용자 ID 추출"""
    try:
        payload = decode_jwt(token, is_refresh=False)
        return payload.user_id
    except HTTPException:
        return None

def get_username_from_token(token: str) -> Optional[str]:
    """토큰에서 사용자명 추출"""
    try:
        payload = decode_jwt(token, is_refresh=False)
        return payload.sub
    except HTTPException:
        return None

def invalidate_token(token: str) -> bool:
    """토큰 무효화 (블랙리스트에 추가)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
        exp = payload.get("exp")
        if exp:
            expires_in = exp - datetime.utcnow().timestamp()
            if expires_in > 0:
                return add_to_blacklist(token, int(expires_in))
        return add_to_blacklist(token, 86400)
    except Exception:
        return False 