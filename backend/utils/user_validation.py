"use strict";

import re

def sanitize_username(username: str) -> str:
    """
    사용자명을 안전하게 정규화합니다.
    경로 조작 및 자원 삽입 공격을 방지합니다.
    
    Args:
        username: 정규화할 사용자명
        
    Returns:
        정규화된 안전한 사용자명
    """
    if not username or not isinstance(username, str):
        return "anonymous"
    
    dangerous_chars = ['/', '\\', '..', '~', '$', '`', '|', '&', ';', '(', ')', '<', '>', '"', "'"]
    sanitized = username
    
    for char in dangerous_chars:
        sanitized = sanitized.replace(char, '')
    
    sanitized = sanitized.strip()
    sanitized = sanitized[:50]
    
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '', sanitized)
    
    if not sanitized:
        return "anonymous"
    
    return sanitized

def validate_user_id(user_id: str) -> bool:
    """
    사용자 ID가 안전한지 검증합니다.
    
    Args:
        user_id: 검증할 사용자 ID
        
    Returns:
        안전한 사용자 ID인지 여부
    """
    if not user_id or not isinstance(user_id, str):
        return False
    
    if len(user_id) > 100 or len(user_id) < 1:
        return False
    
    dangerous_patterns = [
        r'\.\.',
        r'[\/\\]',
        r'[<>:"|?*]',
        r'[;&|`$]',  
        r'[\x00-\x1f\x7f-\x9f]',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, user_id):
            return False
    
    return True

def get_safe_user_id(user_id: str, fallback: str = "anonymous") -> str:
    if validate_user_id(user_id):
        return sanitize_username(user_id)
    return fallback
