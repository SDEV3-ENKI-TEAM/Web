import os
from typing import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, create_engine, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
try:
	load_dotenv(ENV_PATH, encoding="utf-8-sig")
except Exception:
	try:
		load_dotenv(ENV_PATH, encoding="utf-8")
	except Exception:
		try:
			load_dotenv(ENV_PATH, encoding="cp949")
		except Exception:
			load_dotenv()

MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE")

missing = [k for k, v in {
	"MYSQL_HOST": MYSQL_HOST,
	"MYSQL_PORT": MYSQL_PORT,
	"MYSQL_USER": MYSQL_USER,
	"MYSQL_PASSWORD": MYSQL_PASSWORD,
	"MYSQL_DATABASE": MYSQL_DATABASE,
}.items() if not v]
if missing:
	raise RuntimeError(f"Missing MySQL .env keys: {', '.join(missing)}")

DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
	"""데이터베이스 세션 의존성"""
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()

class User(Base):
	"""사용자 모델"""
	__tablename__ = "users"
	
	id = Column(Integer, primary_key=True, index=True)
	username = Column(String(50), unique=True, index=True, nullable=False)
	password = Column(String(255), nullable=False)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UserRole(Base):
	"""사용자 역할 모델"""
	__tablename__ = "user_roles"
	
	id = Column(Integer, primary_key=True, index=True)
	user_id = Column(Integer, nullable=False)
	role = Column(String(50), nullable=False)

class RefreshToken(Base):
	"""Refresh Token 모델"""
	__tablename__ = "refresh_tokens"
	
	id = Column(Integer, primary_key=True, index=True)
	user_id = Column(Integer, nullable=False)
	token_hash = Column(String(255), nullable=False, index=True)
	token_salt = Column(String(255), nullable=False)  # 솔트 필드 추가
	expires_at = Column(DateTime(timezone=True), nullable=False)
	is_revoked = Column(Boolean, default=False)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	last_used_at = Column(DateTime(timezone=True), server_default=func.now())
	ip_address = Column(String(45))
	user_agent = Column(Text)

class SlackSettings(Base):
	__tablename__ = "slack_settings"
	id = Column(Integer, primary_key=True, index=True)
	webhook_url_enc = Column(Text, nullable=False)
	channel = Column(String(100), nullable=True)
	enabled = Column(Boolean, default=False, nullable=False)
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class LLMAnalysis(Base):
	"""LLM 분석 결과 모델"""
	__tablename__ = "llm_analysis"
	
	id = Column(Integer, primary_key=True, index=True)
	trace_id = Column(String(255), unique=True, index=True, nullable=False)
	user_id = Column(String(255), index=True, nullable=True)
	summary = Column(Text, nullable=True)
	long_summary = Column(Text, nullable=True)
	mitigation_suggestions = Column(Text, nullable=True)
	score = Column(Float, nullable=True)
	prediction = Column(String(50), nullable=True)
	similar_trace_ids = Column(Text, nullable=True)
	checked = Column(Boolean, default=False, nullable=False)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 