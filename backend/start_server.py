import uvicorn
import os
from dotenv import load_dotenv
from pathlib import Path
from security_api import app

load_dotenv(dotenv_path=Path(__file__).with_name(".env"), encoding="utf-8")

if __name__ == "__main__":
    
    uvicorn.run(
        "security_api:app",
        host="127.0.0.1", 
        port=8003,
        reload=True,
        log_level="info"
    ) 