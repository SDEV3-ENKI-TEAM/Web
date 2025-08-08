import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
import redis
from fastapi import HTTPException, status
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
        
        # 알고리즘 고정으로 alg=none 공격 방지
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

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWT Access Token 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    if "user_id" not in to_encode:
        raise ValueError("user_id must be included in access token data")
    
    # 표준 클레임 추가
    to_encode.update({
        "exp": expire, 
        "type": "access",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": datetime.utcnow(),
        "nbf": datetime.utcnow()
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """JWT Refresh Token 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    if "user_id" not in to_encode:
        raise ValueError("user_id must be included in refresh token data")
    
    # 표준 클레임 추가
    to_encode.update({
        "exp": expire, 
        "type": "refresh",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": datetime.utcnow(),
        "nbf": datetime.utcnow()
    })
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """JWT Access Token 검증 - 사용자 정보 전체 반환 (레거시 호환성)"""
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
    """JWT Refresh Token 검증 - 사용자 정보 전체 반환 (레거시 호환성)"""
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
    """토큰에서 사용자 ID 추출 (레거시 호환성)"""
    try:
        payload = decode_jwt(token, is_refresh=False)
        return payload.user_id
    except HTTPException:
        return None

def get_username_from_token(token: str) -> Optional[str]:
    """토큰에서 사용자명 추출 (레거시 호환성)"""
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