from typing import List, Optional

from fastapi import Depends, HTTPException, status, Request, Cookie
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database.database import User, UserRole, get_db
from utils.jwt_utils import decode_jwt
from database.user_models import TokenPayload

bearer_scheme = HTTPBearer(auto_error=False)

def _get_user_from_db(user_id: int, db: Session) -> Optional[User]:
    """DB에서 사용자 조회"""
    return db.query(User).filter(User.id == user_id).first()

def _get_user_roles_from_db(user_id: int, db: Session) -> List[str]:
    """DB에서 사용자 역할 조회"""
    roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [role.role for role in roles]

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> TokenPayload:
    """현재 사용자 토큰 페이로드 반환 (헤더 또는 쿠키에서 토큰 가져오기)"""
    
    
    try:
        token = None
        if credentials:
            token = credentials.credentials
        elif access_token:
            token = access_token
        
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No access token provided"
            )
        
        payload = decode_jwt(token, is_refresh=False)
        
        if payload.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not an access token"
            )
        
        user = _get_user_from_db(payload.user_id, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def get_current_user_with_roles(
    payload: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """사용자 정보와 역할을 포함한 딕셔너리 반환"""
    
    role_names = _get_user_roles_from_db(payload.user_id, db)
    
    return {
        "id": payload.user_id,
        "username": payload.sub,
        "roles": role_names,
        "token_roles": payload.roles
    }

def require_role(required_role: str):
    """특정 역할이 필요한 의존성 팩토리"""
    def role_checker(
        payload: TokenPayload = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> TokenPayload:
        role_names = _get_user_roles_from_db(payload.user_id, db)
        
        if required_role not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return payload
    
    return role_checker

def require_any_role(required_roles: List[str]):
    """여러 역할 중 하나라도 있으면 허용하는 의존성 팩토리"""
    def role_checker(
        payload: TokenPayload = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> TokenPayload:
        role_names = _get_user_roles_from_db(payload.user_id, db)
        
        if not any(role in role_names for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of roles {required_roles} required"
            )
        return payload
    
    return role_checker 