from langchain.schema import Document
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

vectorstore = chromadb.HttpClient(host="43.201.65.178", port="8000")

# 컬렉션 삭제
# vectorstore.delete_collection(name="my_log_db")

# collection 있으면 가져오고 없으면 생성
existing_collections = [col.name for col in vectorstore.list_collections()]

if "my_log_db" in existing_collections:
    collection = vectorstore.get_collection(name="my_log_db")
    print("[CHROMA_SETUP] Using existing collection: my_log_db\n")
else:
    collection = vectorstore.create_collection(
        name="my_log_db",
        embedding_function=OpenAIEmbeddingFunction(model_name="text-embedding-3-small"),
        metadata={"hnsw:space": "cosine"},
    )
    print("[CHROMA_SETUP] Create new collection: my_log_db\n")
