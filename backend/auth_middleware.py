from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import User, UserRole, get_db
from jwt_utils import decode_jwt, get_username_from_token, get_user_id_from_token, verify_token
from user_models import TokenPayload

security = HTTPBearer()

def _get_user_from_token_info(user_info: dict, db: Session) -> User:
    """토큰 정보에서 사용자 조회"""
    username = user_info.get("username")
    user_id = user_info.get("user_id")
    
    user = db.query(User).filter(User.username == username, User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def _get_user_roles_from_db(user_id: int, db: Session) -> list:
    """DB에서 사용자 역할 조회"""
    db_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [role.role for role in db_roles]

async def get_current_user_legacy(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """현재 사용자 정보를 가져오는 의존성 함수 (레거시 호환성)"""
    token = credentials.credentials
    user_info = verify_token(token)
    
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = _get_user_from_token_info(user_info, db)
    role_names = _get_user_roles_from_db(user.id, db)
    
    return {
        "id": user.id,
        "username": user.username,
        "roles": role_names,
        "token_roles": user_info.get("roles", [])
    }

async def get_current_username_legacy(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """토큰에서 사용자명만 추출하는 의존성 함수 (레거시 호환성)"""
    token = credentials.credentials
    username = get_username_from_token(token)
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return username

def get_current_user_new(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> TokenPayload:
    """새로운 JWT 검증 시스템을 사용하는 의존성 함수"""
    try:
        payload = decode_jwt(credentials.credentials, is_refresh=False)
        
        if payload.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not an access token"
            )
        
        user = db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return payload
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        ) 