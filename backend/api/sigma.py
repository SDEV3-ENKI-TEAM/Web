from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

@router.get("/sigma-rule/{sigma_id}")
async def get_sigma_rule(sigma_id: str, request: Request):
	collection = getattr(request.app.state, "mongo_collection", None)
	if collection is None:
		raise HTTPException(status_code=500, detail="MongoDB not initialized")
	try:
		doc = collection.find_one({"sigma_id": sigma_id})
		if not doc:
			raise HTTPException(status_code=404, detail="Sigma rule not found")
		doc.pop("_id", None)
		return doc
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e)) 