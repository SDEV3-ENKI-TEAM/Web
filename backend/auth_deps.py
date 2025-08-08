from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, User, UserRole
from jwt_utils import decode_jwt
from user_models import TokenPayload

# HTTPBearer 스키마 설정
bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> TokenPayload:
    """현재 사용자 토큰 페이로드 반환"""
    
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    payload = decode_jwt(credentials.credentials, is_refresh=False)
    
    # Access 토큰인지 확인
    if payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not an access token"
        )
    
    # DB에서 사용자 존재 여부 확인 (추가 검증)
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return payload

def get_current_active_user(
    payload: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> TokenPayload:
    """활성 사용자만 허용"""
    # DB에서 사용자 활성 상태 확인
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user or not user.is_active:  # is_active 필드가 있다고 가정
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return payload

def get_current_user_with_roles(
    payload: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """사용자 정보와 역할을 포함한 딕셔너리 반환"""
    
    # DB에서 역할 정보 가져오기
    db_roles = db.query(UserRole).filter(UserRole.user_id == payload.user_id).all()
    role_names = [role.role for role in db_roles]
    
    result = {
        "id": payload.user_id,
        "username": payload.sub,
        "roles": role_names,
        "token_roles": payload.roles
    }
    
    return result

def get_current_username(
    payload: TokenPayload = Depends(get_current_user)
) -> str:
    """토큰에서 사용자명만 반환"""
    return payload.sub

def get_current_user_id(
    payload: TokenPayload = Depends(get_current_user)
) -> int:
    """토큰에서 사용자 ID만 반환"""
    return payload.user_id

def require_role(required_role: str):
    """특정 역할이 필요한 의존성 팩토리"""
    def role_checker(
        payload: TokenPayload = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> TokenPayload:
        db_roles = db.query(UserRole).filter(UserRole.user_id == payload.user_id).all()
        role_names = [role.role for role in db_roles]
        
        if required_role not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return payload
    
    return role_checker

def require_any_role(required_roles: list[str]):
    """여러 역할 중 하나라도 있으면 허용하는 의존성 팩토리"""
    def role_checker(
        payload: TokenPayload = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> TokenPayload:
        # DB에서 실제 역할 확인
        db_roles = db.query(UserRole).filter(UserRole.user_id == payload.user_id).all()
        role_names = [role.role for role in db_roles]
        
        if not any(role in role_names for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of roles {required_roles} required"
            )
        return payload
    
    return role_checker 