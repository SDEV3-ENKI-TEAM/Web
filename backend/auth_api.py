from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import secrets
import string
import hashlib
from datetime import datetime, timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel

from database import get_db, User, UserRole, Agent, RefreshToken
from user_models import LoginRequest, SignupRequest, JwtResponse, MessageResponse, UserResponse
from jwt_utils import verify_password, get_password_hash, create_access_token, create_refresh_token, verify_token, verify_refresh_token, invalidate_token

router = APIRouter(prefix="/api/auth", tags=["authentication"])

limiter = Limiter(key_func=get_remote_address)
security = HTTPBearer()

class RefreshTokenRequest(BaseModel):
    refresh_token: str

def generate_agent_key(length: int = 32) -> str:
    """Agent 키 생성"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_token(token: str) -> str:
    """토큰 해시화"""
    return hashlib.sha256(token.encode()).hexdigest()

def store_refresh_token(db: Session, user_id: int, refresh_token: str, request: Request):
    """Refresh Token을 users 테이블에 저장"""
    hashed_token = hash_token(refresh_token)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.refresh_token = hashed_token
        db.commit()

def verify_stored_refresh_token(db: Session, refresh_token: str, user_id: int) -> bool:
    """저장된 Refresh Token 검증"""
    hashed_token = hash_token(refresh_token)
    user = db.query(User).filter(
        User.id == user_id,
        User.refresh_token == hashed_token
    ).first()
    return user is not None

def revoke_refresh_token(db: Session, refresh_token: str, user_id: int):
    """Refresh Token 무효화"""
    hashed_token = hash_token(refresh_token)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.refresh_token = None
        db.commit()

def _get_user_by_username(db: Session, username: str) -> User:
    """사용자명으로 사용자 조회"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )
    return user

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
    
    store_refresh_token(db, user.id, refresh_token, request)
    
    response_data = JwtResponse(
        token=access_token,
        refresh_token=refresh_token,
        id=user.id,
        username=user.username,
        roles=roles
    )
    
    json_response = JSONResponse(content=response_data.dict())
    json_response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=30 * 24 * 60 * 60
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
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """사용자 로그아웃"""
    try:
        user_info = _verify_user_token(credentials)
        user = _get_user_from_token(db, user_info)
        
        user.refresh_token = None
        db.commit()
        
        return {"message": "로그아웃 성공"}
    except HTTPException:
        raise
    except Exception as e:
        return {"message": "로그아웃 처리 중 오류 발생"}

@router.post("/agent/register", response_model=MessageResponse)
async def register_agent(
    agent_name: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Agent 등록"""
    user_info = _verify_user_token(credentials)
    user = _get_user_from_token(db, user_info)
    
    agent_key = generate_agent_key()
    
    new_agent = Agent(
        user_id=user.id,
        agent_key=agent_key,
        name=agent_name
    )
    db.add(new_agent)
    db.commit()
    
    return MessageResponse(message=f"Agent가 성공적으로 등록되었습니다. Agent 키: {agent_key}")

@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, refresh_request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh Token으로 새로운 Access Token 발급"""
    refresh_token = refresh_request.refresh_token
    user_info = verify_refresh_token(refresh_token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token"
        )
    
    user = _get_user_from_token(db, user_info)
    roles = _get_user_roles(db, user.id)
    
    token_data = _create_token_data(user, roles)
    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)
    
    store_refresh_token(db, user.id, new_refresh_token, request)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """현재 사용자 정보 조회"""
    user_info = _verify_user_token(credentials)
    user = _get_user_from_token(db, user_info)
    roles = _get_user_roles(db, user.id)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        roles=roles,
        created_at=user.created_at
    )

@router.get("/agents", response_model=List[dict])
async def get_user_agents(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """사용자의 Agent 목록 조회"""
    user_info = _verify_user_token(credentials)
    user = _get_user_from_token(db, user_info)
    
    agents = db.query(Agent).filter(Agent.user_id == user.id).all()
    
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "agent_key": agent.agent_key,
            "status": agent.status,
            "created_at": agent.created_at
        }
        for agent in agents
    ] 