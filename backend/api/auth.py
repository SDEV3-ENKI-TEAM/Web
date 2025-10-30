import hashlib
import logging
import secrets
import string
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, Depends, HTTPException, Request, status, Cookie
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database.database import RefreshToken, User, UserRole, get_db
from utils.jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
    verify_token,
    verify_refresh_token,
)
from database.user_models import JwtResponse, LoginRequest, MessageResponse, SignupRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])

limiter = Limiter(key_func=get_remote_address)
security = HTTPBearer(auto_error=False)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

def generate_agent_key(length: int = 32) -> str:
    """Agent 키 생성"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_token(token: str) -> tuple[str, str]:
    """토큰 해시화 (솔트 포함)"""
    salt = secrets.token_hex(32)
    salted_token = salt + token
    hashed = hashlib.sha256(salted_token.encode()).hexdigest()
    return hashed, salt

def verify_token_hash(token: str, stored_hash: str, stored_salt: str) -> bool:
    """토큰 해시 검증"""
    salted_token = stored_salt + token
    computed_hash = hashlib.sha256(salted_token.encode()).hexdigest()
    return secrets.compare_digest(computed_hash, stored_hash)

def store_refresh_token(db: Session, user_id: int, refresh_token: str, request: Request, update_existing: bool = False):
    """Refresh Token을 refresh_tokens 테이블에 저장 또는 업데이트
    
    Args:
        db: Database session
        user_id: User ID
        refresh_token: Refresh token to store
        request: FastAPI Request object
        update_existing: If True, 기존 레코드를 재사용하여 업데이트 (row 추가 방지)
    """
    hashed_token, salt = hash_token(refresh_token)
    
    # 기존 활성 토큰 찾기
    existing_token = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if update_existing:
        # 기존 활성 토큰이 있으면 업데이트
        if existing_token:
            existing_token.token_hash = hashed_token
            existing_token.token_salt = salt
            existing_token.expires_at = datetime.utcnow() + timedelta(hours=12)
            existing_token.is_revoked = False
            existing_token.last_used_at = datetime.utcnow()
            existing_token.ip_address = request.client.host if request.client else None
            existing_token.user_agent = request.headers.get("user-agent")
        else:
            # 활성 토큰이 없으면, 기존 활성 토큰들을 무효화하고
            # 이미 revoked된 가장 최근 토큰 레코드를 재사용
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False
            ).update({"is_revoked": True})
            
            # 이미 revoked된 가장 최근 토큰 레코드 찾기 (재사용)
            reusable_token = db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id
            ).order_by(RefreshToken.created_at.desc()).first()
            
            if reusable_token:
                # 기존 레코드 재사용하여 업데이트
                reusable_token.token_hash = hashed_token
                reusable_token.token_salt = salt
                reusable_token.expires_at = datetime.utcnow() + timedelta(hours=12)
                reusable_token.is_revoked = False
                reusable_token.created_at = datetime.utcnow()
                reusable_token.last_used_at = datetime.utcnow()
                reusable_token.ip_address = request.client.host if request.client else None
                reusable_token.user_agent = request.headers.get("user-agent")
            else:
                # 레코드가 하나도 없으면 새로 생성 (최초 로그인)
                new_refresh_token = RefreshToken(
                    user_id=user_id,
                    token_hash=hashed_token,
                    token_salt=salt,
                    expires_at=datetime.utcnow() + timedelta(hours=12),
                    is_revoked=False,
                    created_at=datetime.utcnow(),
                    last_used_at=datetime.utcnow(),
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent")
                )
                db.add(new_refresh_token)
    else:
        # 로그인 시 사용 (update_existing=False): 모든 기존 활성 토큰 무효화 후 새로 생성
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False
        ).update({"is_revoked": True})
        
        # 새 토큰 생성
        new_refresh_token = RefreshToken(
            user_id=user_id,
            token_hash=hashed_token,
            token_salt=salt,
            expires_at=datetime.utcnow() + timedelta(hours=12),
            is_revoked=False,
            created_at=datetime.utcnow(),
            last_used_at=datetime.utcnow(),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        db.add(new_refresh_token)
    
    db.commit()

def verify_stored_refresh_token(db: Session, refresh_token: str, user_id: int) -> Optional[RefreshToken]:
    """저장된 Refresh Token 검증 및 레코드 반환"""
    stored_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).all()
    
    for stored_token in stored_tokens:
        if verify_token_hash(refresh_token, stored_token.token_hash, stored_token.token_salt):
            # 토큰 사용 시간 업데이트
            stored_token.last_used_at = datetime.utcnow()
            db.commit()
            return stored_token
    
    return None

def revoke_refresh_token(db: Session, refresh_token: str, user_id: int):
    """Refresh Token 무효화"""
    stored_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False
    ).all()
    
    for stored_token in stored_tokens:
        if verify_token_hash(refresh_token, stored_token.token_hash, stored_token.token_salt):
            stored_token.is_revoked = True
            db.commit()
            break



def _get_user_roles(db: Session, user_id: int) -> List[str]:
    """사용자 역할 조회"""
    roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [role.role for role in roles]
    
def _create_token_data(user: User, roles: List[str]) -> dict:
    """토큰 데이터 생성"""
    return {
        "sub": user.username,
        "user_id": user.id,
        "roles": roles
    }

def _create_jwt_response(user: User, roles: List[str], db: Session, request: Request) -> JSONResponse:
    """JWT 응답 생성"""
    token_data = _create_token_data(user, roles)
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)
    
    # 로그인 시에도 기존 활성 토큰이 있으면 업데이트 (row 쌓이지 않도록)
    store_refresh_token(db, user.id, refresh_token, request, update_existing=True)
    
    response_data = JwtResponse(
        token=access_token,
        refresh_token=refresh_token,
        id=user.id,
        username=user.username,
        roles=roles
    )
    
    json_response = JSONResponse(content=response_data.dict())
    is_https = request.url.scheme == "https"
    
    json_response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=12 * 60 * 60
    )
    json_response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=60 * 60
    )
    
    return json_response

def _verify_user_token(credentials: HTTPAuthorizationCredentials) -> dict:
    """토큰 검증 및 사용자 정보 추출"""
    user_info = verify_token(credentials.credentials)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰"
        )
    return user_info

def _get_user_from_token(db: Session, user_info: dict) -> User:
    """토큰에서 사용자 정보로 사용자 조회"""
    username = user_info.get("username")
    user_id = user_info.get("user_id")
    
    user = db.query(User).filter(User.username == username, User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )
    return user

@router.post("/signin", response_model=JwtResponse)
@limiter.limit("5/minute")
async def authenticate_user(request: Request, login_request: LoginRequest, db: Session = Depends(get_db)):
    """사용자 로그인"""
    user = db.query(User).filter(User.username == login_request.username).first()
    
    if not user or not verify_password(login_request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="잘못된 사용자명 또는 비밀번호"
        )
    
    roles = _get_user_roles(db, user.id)
    return _create_jwt_response(user, roles, db, request)

@router.post("/signup", response_model=MessageResponse)
async def register_user(signup_request: SignupRequest, db: Session = Depends(get_db)):
    """사용자 회원가입"""
    existing_user = db.query(User).filter(User.username == signup_request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 사용자명입니다"
        )
    
    hashed_password = get_password_hash(signup_request.password)
    
    new_user = User(
        username=signup_request.username,
        password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    default_role = UserRole(user_id=new_user.id, role="ROLE_USER")
    db.add(default_role)
    db.commit()
    
    return MessageResponse(message="회원가입이 완료되었습니다")

@router.post("/logout")
async def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db)
):
    """사용자 로그아웃"""
    try:
        # Authorization 헤더 또는 쿠키에서 토큰 가져오기
        token = None
        if credentials:
            token = credentials.credentials
        elif access_token_cookie:
            token = access_token_cookie
        
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="인증 토큰이 필요합니다"
            )
        
        user_info = verify_token(token)
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰"
            )
        
        user = _get_user_from_token(db, user_info)
        
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.is_revoked == False
        ).update({"is_revoked": True})
        db.commit()
        
        # 쿠키 삭제
        response = JSONResponse(content={"message": "로그아웃 성공"})
        response.delete_cookie(key="access_token")
        response.delete_cookie(key="refresh_token")
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        return {"message": "로그아웃 처리 중 오류 발생"}

@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(
    request: Request, 
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    refresh_request: Optional[RefreshTokenRequest] = None,
    db: Session = Depends(get_db)
):
    """Refresh Token으로 새로운 Access Token 발급"""
    logger = logging.getLogger(__name__)

    refresh_token = None
    
    if credentials:
        refresh_token = credentials.credentials
        logger.info("Refresh token from Authorization header")
    elif refresh_token_cookie:
        refresh_token = refresh_token_cookie
        logger.info("Refresh token from cookie")
    elif refresh_request and refresh_request.refresh_token:
        refresh_token = refresh_request.refresh_token
        logger.info("Refresh token from request body")
    else:
        cookies = request.cookies
        if "refresh_token" in cookies:
            refresh_token = cookies["refresh_token"]
            logger.info("Refresh token from request.cookies")
    
    if not refresh_token:
        logger.warning("No refresh token found in any source")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh Token이 필요합니다"
        )
    
    user_info = verify_refresh_token(refresh_token)
    if not user_info:
        logger.warning(f"Failed to verify refresh token: token invalid or expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token"
        )
    
    logger.info(f"Refresh token verified for user_id: {user_info['user_id']}")
    
    # 기존 토큰 레코드 검증 및 가져오기
    existing_token_record = verify_stored_refresh_token(db, refresh_token, user_info["user_id"])
    if not existing_token_record:
        logger.warning(f"Refresh token not found in database for user_id: {user_info['user_id']}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="저장되지 않은 Refresh Token"
        )
    
    logger.info(f"Refresh token verified in database for user_id: {user_info['user_id']}")
    
    user = _get_user_from_token(db, user_info)
    roles = _get_user_roles(db, user.id)
    
    token_data = _create_token_data(user, roles)
    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)
    
    # 기존 refresh_token 블랙리스트 추가
    from utils.jwt_utils import add_to_blacklist
    add_to_blacklist(refresh_token, expires_in=12 * 60 * 60)
    
    # 기존 토큰 레코드를 새 토큰으로 직접 업데이트 (row 추가 방지)
    hashed_token, salt = hash_token(new_refresh_token)
    existing_token_record.token_hash = hashed_token
    existing_token_record.token_salt = salt
    existing_token_record.expires_at = datetime.utcnow() + timedelta(hours=12)
    existing_token_record.is_revoked = False
    existing_token_record.last_used_at = datetime.utcnow()
    existing_token_record.ip_address = request.client.host if request.client else None
    existing_token_record.user_agent = request.headers.get("user-agent")
    db.commit()
    
    json_response = JSONResponse(
        content={
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    )
    is_https = request.url.scheme == "https"
    
    json_response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=12 * 60 * 60
    )
    json_response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=60 * 60
    )
    return json_response

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db)
):
    """현재 사용자 정보 조회"""
    # Authorization 헤더 또는 쿠키에서 토큰 가져오기
    token = None
    if credentials:
        token = credentials.credentials
    elif access_token_cookie:
        token = access_token_cookie
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다"
        )
    
    user_info = verify_token(token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰"
        )
    
    user = _get_user_from_token(db, user_info)
    roles = _get_user_roles(db, user.id)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        roles=roles,
        created_at=user.created_at
    ) 