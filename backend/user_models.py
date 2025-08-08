from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    password: str
    roles: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: int
    username: str
    roles: List[str]
    created_at: datetime

class JwtResponse(BaseModel):
    token: str
    refresh_token: str
    id: int
    username: str
    roles: List[str]

class MessageResponse(BaseModel):
    message: str

class TokenPayload(BaseModel):
    sub: str
    user_id: int
    roles: List[str] = []
    exp: int
    iss: str | None = None
    aud: str | None = None
    type: str | None = "access"
    iat: int | None = None
    nbf: int | None = None 