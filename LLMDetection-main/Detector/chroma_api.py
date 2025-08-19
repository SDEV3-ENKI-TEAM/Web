from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from chroma_setup import vectorstore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_collection = vectorstore.get_collection(name="my_log_db")


@app.get("/", response_class=HTMLResponse)
def default():
    return """
    <h2>Welcome to the Chroma DB API</h2>
    <p>Move to <a href="/logs">/logs</a>, <a href="/embeddings/">/embeddings/</a>, or <a href="/search">/search</a> to interact with the database.</p>
    """


@app.get("/logs")
def get_logs():
    data = db_collection.get(include=["documents", "metadatas"])
    trace_ids = data.get("ids", [])
    documents = data.get("documents", [])
    metadatas = data.get("metadatas", [])

    # 묶어서 반환
    combined = []
    for i in range(len(trace_ids)):
        combined.append(
            {
                "trace_id": trace_ids[i],
                "summary": documents[i],
                "metadata": metadatas[i],
            }
        )

    return JSONResponse(
        content={"logs": combined}, media_type="application/json; charset=utf-8"
    )


@app.get("/embeddings")
def get_embeddings():
    data = db_collection.get(include=["embeddings", "documents"], limit=10)
    result = []
    for doc, emb in zip(data.get("documents", []), data.get("embeddings", [])):
        # numpy 배열일 경우 tolist() 사용
        emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
        result.append(
            {"text": doc, "embedding": emb_list[:10]}
        )  # 임베딩 앞 10개만 반환
    return result
