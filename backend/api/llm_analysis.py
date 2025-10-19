import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.database import LLMAnalysis, get_db
from utils.auth_deps import get_current_user_with_roles

router = APIRouter()


@router.get("/llm-analysis/{trace_id}")
async def get_llm_analysis(
    trace_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_with_roles)
):
    """특정 trace_id의 LLM 분석 결과 조회"""
    analysis = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == trace_id).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="LLM 분석 결과를 찾을 수 없습니다")
    
    # similar_trace_ids를 JSON으로 파싱
    similar_trace_ids = None
    if analysis.similar_trace_ids:
        try:
            similar_trace_ids = json.loads(analysis.similar_trace_ids)
        except Exception:
            similar_trace_ids = []
    
    return {
        "trace_id": analysis.trace_id,
        "summary": analysis.summary,
        "long_summary": analysis.long_summary,
        "mitigation_suggestions": analysis.mitigation_suggestions,
        "score": analysis.score,
        "prediction": analysis.prediction,
        "similar_trace_ids": similar_trace_ids,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "updated_at": analysis.updated_at.isoformat() if analysis.updated_at else None,
    }


@router.get("/llm-analysis")
async def get_all_llm_analysis(
    skip: int = 0,
    limit: int = 100,
    prediction: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_with_roles)
):
    """모든 LLM 분석 결과 조회 (페이지네이션)"""
    query = db.query(LLMAnalysis)
    
    # prediction 필터링
    if prediction:
        query = query.filter(LLMAnalysis.prediction == prediction)
    
    # 최신순 정렬
    query = query.order_by(LLMAnalysis.created_at.desc())
    
    # 페이지네이션
    total = query.count()
    analyses = query.offset(skip).limit(limit).all()
    
    results = []
    for analysis in analyses:
        similar_trace_ids = None
        if analysis.similar_trace_ids:
            try:
                similar_trace_ids = json.loads(analysis.similar_trace_ids)
            except Exception:
                similar_trace_ids = []
        
        results.append({
            "trace_id": analysis.trace_id,
            "summary": analysis.summary,
            "score": analysis.score,
            "prediction": analysis.prediction,
            "similar_trace_ids": similar_trace_ids,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": results
    }


@router.delete("/llm-analysis/{trace_id}")
async def delete_llm_analysis(
    trace_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_with_roles)
):
    """LLM 분석 결과 삭제"""
    # admin 권한 체크
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    
    analysis = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == trace_id).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="LLM 분석 결과를 찾을 수 없습니다")
    
    db.delete(analysis)
    db.commit()
    
    return {"message": "LLM 분석 결과가 삭제되었습니다"}

