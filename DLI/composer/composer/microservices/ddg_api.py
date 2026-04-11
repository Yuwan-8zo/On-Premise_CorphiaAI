"""
ddg_api.py - Agent Knowledge Lifecycle API

Provides CRUD operations for the DDG search cache:
- Create: Search and cache new results
- Read: Query cache entries, simulate lookups, analyze similarity
- Update: Patch summaries, add metadata
- Delete: Remove entries or clear cache

The cache treats search results as versioned artifacts with full audit trails.
"""

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, desc

from ddg_cache import (
    Config,
    cached_ddg_search,
    quick_search,
    search_and_summarize,
    get_cache_stats,
    clear_cache,
    get_session,
    CacheEntry,
    embed_text,
    cosine_similarity,
    hash_query,
    init_database,
)

sys.path.append('/dli/task/composer/microservices')
from observability import get_observability
logger, tracer, _, traced = get_observability("ddg-api")


# ============================================================================
# Request/Response Models
# ============================================================================

class SearchRequest(BaseModel):
    """Full search with all pipeline options."""
    query: str = Field(..., min_length=1)
    max_results: int = Field(10, ge=1, le=50)
    use_cache: bool = True
    similarity_threshold: float = Field(0.95, ge=0.0, le=1.0)
    scrape_content: bool = False
    summarize_all: bool = False
    use_llm_summary: bool = False


class SimulateRequest(BaseModel):
    """Predict cache behavior without executing search."""
    query: str
    threshold: float = Field(0.95, ge=0.0, le=1.0)


class SimulateResponse(BaseModel):
    query: str
    prediction: str  # EXACT_HIT, SEMANTIC_HIT, MISS
    closest_query: Optional[str]
    closest_id: Optional[str]
    similarity: float
    threshold: float


class AnalyzeRequest(BaseModel):
    """Find similar cached queries."""
    query: str
    limit: int = Field(5, ge=1, le=20)


class PatchRequest(BaseModel):
    """Update cache entry fields."""
    summary: Optional[str] = None
    reason: Optional[str] = Field(None, description="Audit reason for change")


# ============================================================================
# Application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting DDG Cache API")
    await init_database()
    stats = await get_cache_stats()
    logger.info(f"Database ready: {stats['total']} entries")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="DDG Cache API",
    description="Search cache with semantic similarity and audit trails",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health & Config
# ============================================================================

@app.get("/health", tags=["System"])
async def health():
    """Check API health and cache stats."""
    stats = await get_cache_stats()
    return {"status": "ok", **stats}


@app.get("/config", tags=["System"])
async def get_config():
    """View current configuration."""
    return {
        "llm_model": Config.LLM_MODEL,
        "llm_base_url": Config.LLM_BASE_URL,
        "embedding_model": Config.EMBEDDING_MODEL,
        "similarity_threshold": Config.SIMILARITY_THRESHOLD,
        "max_results": Config.MAX_RESULTS,
    }


# ============================================================================
# CREATE - Acquisition
# ============================================================================

@app.post("/search", tags=["Create"])
@traced("api_search")
async def search(req: SearchRequest):
    """
    Execute search pipeline: cache lookup → live search → scrape → summarize → save.
    
    Returns results with source indicator (cache-exact, cache-semantic, live, mixed).
    """
    return await cached_ddg_search(
        req.query,
        max_results=req.max_results,
        use_cache=req.use_cache,
        similarity_threshold=req.similarity_threshold,
        scrape_content=req.scrape_content,
        summarize_all=req.summarize_all,
        use_llm_summary=req.use_llm_summary,
    )


@app.post("/search/quick", tags=["Create"])
@traced("api_quick")
async def search_quick(query: str = Body(..., embed=True), max_results: int = Body(5, embed=True)):
    """Fast search - cache only, no scraping or summarization."""
    results = await quick_search(query, max_results)
    return {"query": query, "results": results, "count": len(results)}


@app.post("/search/deep", tags=["Create"])
@traced("api_deep")
async def search_deep(query: str = Body(..., embed=True), max_results: int = Body(10, embed=True)):
    """Deep search - scraping + LLM summarization."""
    return await search_and_summarize(query, max_results)


# ============================================================================
# READ - Introspection
# ============================================================================

@app.get("/cache/entries", tags=["Read"])
async def list_entries(limit: int = 20, offset: int = 0):
    """List cached entries, most recently accessed first."""
    async with get_session() as session:
        result = await session.execute(
            select(CacheEntry)
            .order_by(desc(CacheEntry.last_accessed))
            .offset(offset)
            .limit(limit)
        )
        entries = []
        for e in result.scalars():
            entries.append({
                "id": e.query_hash,
                "id_short": e.query_hash[:12],
                "query": e.query_text,
                "result_count": len(e.results) if e.results else 0,
                "has_summary": e.summary is not None,
                "access_count": e.access_count,
                "created_at": e.created_at.isoformat(),
                "last_accessed": e.last_accessed.isoformat(),
            })
        return {"entries": entries, "count": len(entries), "offset": offset}


@app.get("/cache/entry/{entry_id}", tags=["Read"])
async def get_entry(entry_id: str):
    """Get full cache entry by ID (full hash or prefix)."""
    async with get_session() as session:
        # Try exact match first, then prefix
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.query_hash == entry_id)
        )
        entry = result.scalars().first()
        
        if not entry:
            result = await session.execute(
                select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id}%"))
            )
            entry = result.scalars().first()
        
        if not entry:
            raise HTTPException(404, f"Entry not found: {entry_id}")
        
        return {
            "id": entry.query_hash,
            "query": entry.query_text,
            "results": entry.results,
            "summary": entry.summary,
            "access_count": entry.access_count,
            "created_at": entry.created_at.isoformat(),
            "last_accessed": entry.last_accessed.isoformat(),
        }


@app.post("/cache/simulate", tags=["Read"])
async def simulate(req: SimulateRequest):
    """
    Predict cache behavior without executing search.
    
    Useful for testing threshold tuning or understanding cache coverage.
    """
    qhash = hash_query(req.query)
    
    async with get_session() as session:
        # Check exact match
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.query_hash == qhash)
        )
        if result.scalars().first():
            return SimulateResponse(
                query=req.query,
                prediction="EXACT_HIT",
                closest_query=req.query,
                closest_id=qhash,
                similarity=1.0,
                threshold=req.threshold,
            )
        
        # Check semantic similarity
        qemb = embed_text(req.query)
        if not qemb:
            return SimulateResponse(
                query=req.query,
                prediction="MISS",
                closest_query=None,
                closest_id=None,
                similarity=0.0,
                threshold=req.threshold,
            )
        
        best_score, best_entry = 0.0, None
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.embeddings.isnot(None))
        )
        for e in result.scalars():
            cemb = (e.embeddings or {}).get("query")
            if cemb:
                score = cosine_similarity(qemb, cemb)
                if score > best_score:
                    best_score, best_entry = score, e
        
        return SimulateResponse(
            query=req.query,
            prediction="SEMANTIC_HIT" if best_score >= req.threshold else "MISS",
            closest_query=best_entry.query_text if best_entry else None,
            closest_id=best_entry.query_hash if best_entry else None,
            similarity=round(best_score, 4),
            threshold=req.threshold,
        )


@app.post("/cache/analyze", tags=["Read"])
async def analyze(req: AnalyzeRequest):
    """
    Find cached queries most similar to input.
    
    Returns ranked list with similarity scores - useful for cache analysis.
    """
    qemb = embed_text(req.query)
    if not qemb:
        return {"query": req.query, "matches": [], "error": "Embedding failed"}
    
    matches = []
    async with get_session() as session:
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.embeddings.isnot(None))
        )
        for e in result.scalars():
            cemb = (e.embeddings or {}).get("query")
            if cemb:
                score = cosine_similarity(qemb, cemb)
                matches.append({
                    "id": e.query_hash[:12],
                    "query": e.query_text,
                    "similarity": round(score, 4),
                    "has_summary": e.summary is not None,
                    "result_count": len(e.results) if e.results else 0,
                })
    
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return {"query": req.query, "matches": matches[:req.limit], "total_compared": len(matches)}


# ============================================================================
# UPDATE - Intervention
# ============================================================================

@app.patch("/cache/entry/{entry_id}", tags=["Update"])
async def patch_entry(entry_id: str, req: PatchRequest):
    """
    Update cache entry fields with audit trail.
    
    Currently supports updating summary. Reason is logged for audit.
    """
    async with get_session() as session:
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id}%"))
        )
        entry = result.scalars().first()
        
        if not entry:
            raise HTTPException(404, f"Entry not found: {entry_id}")
        
        changes = []
        
        if req.summary is not None:
            old_summary = entry.summary[:50] + "..." if entry.summary and len(entry.summary) > 50 else entry.summary
            entry.summary = req.summary
            changes.append(f"summary (was: {old_summary})")
        
        if not changes:
            return {"status": "no_changes", "entry_id": entry.query_hash}
        
        entry.last_accessed = datetime.utcnow()
        await session.commit()
        
        logger.info(f"Patched {entry_id[:12]}: {changes}, reason: {req.reason}")
        
        return {
            "status": "updated",
            "entry_id": entry.query_hash,
            "changes": changes,
            "reason": req.reason,
        }


# ============================================================================
# DELETE - Retirement
# ============================================================================

@app.delete("/cache/entry/{entry_id}", tags=["Delete"])
async def delete_entry(entry_id: str):
    """Delete a single cache entry."""
    async with get_session() as session:
        result = await session.execute(
            select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id}%"))
        )
        entry = result.scalars().first()
        
        if not entry:
            raise HTTPException(404, f"Entry not found: {entry_id}")
        
        query_text = entry.query_text
        await session.delete(entry)
        await session.commit()
        
        logger.info(f"Deleted entry {entry_id[:12]}: {query_text[:50]}")
        
        return {"status": "deleted", "entry_id": entry_id, "query": query_text}


@app.delete("/cache", tags=["Delete"])
async def clear_all():
    """Delete all cache entries."""
    count = await clear_cache()
    logger.info(f"Cleared {count} cache entries")
    return {"status": "cleared", "deleted": count}


@app.get("/stats", tags=["Delete"])
async def stats():
    """Cache statistics (total entries, last cached time)."""
    return await get_cache_stats()


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ddg_api:app", host="0.0.0.0", port=7861, reload=True)