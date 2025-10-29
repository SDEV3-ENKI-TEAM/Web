import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).with_name(".env"), encoding="utf-8")

if __name__ == "__main__":
	uvicorn.run(
		"security_api:app",
		host=os.getenv("API_HOST"),
		port=int(os.getenv("API_PORT")),
		reload=True,
		log_level="info"
	) 