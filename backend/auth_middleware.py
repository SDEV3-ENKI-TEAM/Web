from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db, User, UserRole
from jwt_utils import verify_token, get_user_id_from_token, get_username_from_token, decode_jwt
from user_models import TokenPayload

security = HTTPBearer()

# 레거시 호환성을 위한 함수들 (기존 코드와의 호환성 유지)
async def get_current_user_legacy(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """현재 사용자 정보를 가져오는 의존성 함수 (레거시 호환성)"""
    token = credentials.credentials
    user_info = verify_token(token)
    
    if user_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 토큰에서 사용자 정보 추출
    username = user_info.get("username")
    user_id = user_info.get("user_id")
    token_roles = user_info.get("roles", [])
    
    # DB에서 사용자 확인 (추가 검증)
    user = db.query(User).filter(User.username == username, User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # DB에서 역할 정보 가져오기 (토큰과 DB 역할 비교)
    db_roles = db.query(UserRole).filter(UserRole.user_id == user.id).all()
    role_names = [role.role for role in db_roles]
    
    return {
        "id": user.id,
        "username": user.username,
        "roles": role_names,
        "token_roles": token_roles  # 토큰에 저장된 역할 정보도 포함
    }

async def get_current_username_legacy(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """토큰에서 사용자명만 추출하는 의존성 함수 (레거시 호환성)"""
    token = credentials.credentials
    username = get_username_from_token(token)
    
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return username

# 새로운 의존성 시스템과의 호환성을 위한 래퍼 함수들
def get_current_user_new(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> TokenPayload:
    """새로운 JWT 검증 시스템을 사용하는 의존성 함수"""
    try:
        payload = decode_jwt(credentials.credentials, is_refresh=False)
        
        # Access 토큰인지 확인
        if payload.type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not an access token"
            )
        
        # DB에서 사용자 존재 여부 확인
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

def get_current_user_with_roles_new(
    payload: TokenPayload = Depends(get_current_user_new),
    db: Session = Depends(get_db)
) -> dict:
    """새로운 시스템을 사용하여 사용자 정보와 역할을 반환"""
    # DB에서 역할 정보 가져오기
    db_roles = db.query(UserRole).filter(UserRole.user_id == payload.user_id).all()
    role_names = [role.role for role in db_roles]
    
    return {
        "id": payload.user_id,
        "username": payload.sub,
        "roles": role_names,
        "token_roles": payload.roles
    }

# 기본 의존성 함수 (새로운 시스템 사용)
get_current_user = get_current_user_new
get_current_user_with_roles = get_current_user_with_roles_new

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """토큰에서 사용자 ID만 추출하는 의존성 함수"""
    token = credentials.credentials
    user_id = get_user_id_from_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_id

def require_role(required_role: str):
    """특정 역할이 필요한 API를 위한 데코레이터"""
    def role_checker(current_user: dict = Depends(get_current_user)):
        if required_role not in current_user["roles"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다"
            )
        return current_user
    return role_checker 