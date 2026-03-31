"""
Run locally with:
uvicorn server:app --host 127.0.0.1 --port 8765
"""

from fastapi import FastAPI
from keybert import KeyBERT
from pydantic import BaseModel, Field


app = FastAPI()
kw_model = KeyBERT(model="all-MiniLM-L6-v2")


class ExtractRequest(BaseModel):
    text: str
    top_n: int = 8
    keyphrase_ngram_range: list[int] = Field(default_factory=lambda: [1, 2])


@app.post("/extract")
def extract_keywords(request: ExtractRequest):
    min_n, max_n = (request.keyphrase_ngram_range + [2])[:2]
    keywords = kw_model.extract_keywords(
        request.text,
        top_n=request.top_n,
        keyphrase_ngram_range=(min_n, max_n),
        stop_words="english",
        use_maxsum=True,
        nr_candidates=20,
    )
    return {
        "keywords": [
            {"keyword": keyword, "score": score}
            for keyword, score in keywords
        ]
    }
