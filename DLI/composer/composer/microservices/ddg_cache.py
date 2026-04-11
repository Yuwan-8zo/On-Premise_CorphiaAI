"""
ddg_cache.py - DuckDuckGo search cache with semantic similarity and LLM summarization

Usage:
    from ddg_cache import cached_ddg_search, quick_search, search_and_summarize, init_database
    await init_database()
    result = await cached_ddg_search("NVIDIA DIGITS", max_results=5, summarize_all=True)
"""
import os, hashlib, asyncio, numpy as np
from datetime import datetime
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
from functools import lru_cache
from dataclasses import dataclass, field

from ddgs import DDGS
import httpx, trafilatura
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

# ============================================================================
# Configuration
# ============================================================================

class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@postgres:5432/ddg_cache")
    EMBEDDING_MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2"
    EMBEDDING_BASE_URL = "http://llm_client:9000/v1"
    LLM_MODEL = "meta/llama-3.1-8b-instruct"
    LLM_BASE_URL = "http://llm_client:9000/v1"
    LLM_MAX_TOKENS = 2048
    SCRAPE_TIMEOUT = 10
    SUMMARY_MAX_LENGTH = 1000
    SIMILARITY_THRESHOLD = 0.85
    MAX_RESULTS = 10
    CONCURRENCY = 4
    MIN_SUMMARY_INPUT = 100
    MIN_SUMMARY_OUTPUT = 50

SUMMARY_PROMPT = """You are an expert research analyst creating an executive summary.

REQUIREMENTS:
- Synthesize ALL key information into a cohesive narrative
- Cite sources naturally: "According to [Source]..." or "Research shows..."
- Include specific facts, data points, and actionable insights
- Write in professional prose (NO bullet points or lists)
- Be thorough - the reader should understand the full picture from this alone

SOURCES:
{text}

EXECUTIVE SUMMARY:"""

# ============================================================================
# Logging Infrastructure
# ============================================================================

try:
    import sys
    sys.path.append('/dli/task/composer/microservices')
    from observability import get_observability
    logger, tracer, _, traced = get_observability("ddg-cache")
except ImportError:
    import logging
    from contextlib import contextmanager
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    logger = logging.getLogger("ddg-cache")
    
    class _DummySpan:
        def set_attribute(self, k, v): pass
        def add_event(self, msg, attrs=None): pass
        def record_exception(self, e): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
    
    class _DummyTracer:
        @contextmanager
        def start_as_current_span(self, name):
            yield _DummySpan()
    
    tracer = _DummyTracer()
    traced = lambda name: lambda fn: fn


@dataclass
class OpResult:
    """Accumulated operation state with success/failure tracking."""
    name: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    success: bool = True
    error: Optional[str] = None
    
    def set(self, **kwargs) -> "OpResult":
        self.attrs.update(kwargs)
        return self
    
    def fail(self, reason: str) -> "OpResult":
        self.success = False
        self.error = reason
        self.attrs["error"] = reason
        return self
    
    def __str__(self):
        status = "OK" if self.success else f"FAIL({self.error})"
        return f"[{self.name}] {status} {self.attrs}"


@asynccontextmanager
async def op(name: str, **initial):
    """Traced operation with automatic logging."""
    state = OpResult(name, attrs=dict(initial))
    logger.info(f"[{name}] START {initial}")
    
    with tracer.start_as_current_span(name) as span:
        for k, v in initial.items():
            span.set_attribute(k, _safe_attr(v))
        try:
            yield state
            for k, v in state.attrs.items():
                span.set_attribute(k, _safe_attr(v))
            if state.success:
                logger.info(f"[{name}] OK {state.attrs}")
            else:
                logger.warning(f"[{name}] FAIL {state.error} | {state.attrs}")
        except Exception as e:
            state.fail(str(e))
            span.record_exception(e)
            logger.error(f"[{name}] EXCEPTION {e} | {state.attrs}")
            raise


def _safe_attr(v):
    """Ensure attribute is serializable for tracing."""
    if isinstance(v, (str, int, float, bool, type(None))):
        return v
    return str(v)[:200]


# ============================================================================
# Database
# ============================================================================

Base = declarative_base()

class CacheEntry(Base):
    __tablename__ = "ddg_cache"
    id = Column(Integer, primary_key=True)
    query_hash = Column(String(64), unique=True, index=True, nullable=False)
    query_text = Column(String(1000), nullable=False)
    results = Column(JSON, nullable=False)
    embeddings = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=1)
    last_accessed = Column(DateTime, default=datetime.utcnow)


async def init_database(database_url: Optional[str] = None) -> bool:
    url = database_url or Config.DATABASE_URL
    logger.info(f"Initializing database: {url}")
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    return True


@asynccontextmanager
async def get_session(database_url: Optional[str] = None):
    url = database_url or Config.DATABASE_URL
    engine = create_async_engine(url, echo=False)
    session = async_sessionmaker(engine, expire_on_commit=False)()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
        await engine.dispose()


# ============================================================================
# Utilities
# ============================================================================

def hash_query(query: str) -> str:
    return hashlib.sha256(query.lower().strip().encode()).hexdigest()

def sorted_hrefs(results: List[Dict]) -> List[str]:
    return sorted([r.get("href", "") for r in results if r.get("href")])


# ============================================================================
# Search & Scrape
# ============================================================================

async def search_duckduckgo(query: str, max_results: int = None) -> List[Dict]:
    max_results = max_results or Config.MAX_RESULTS
    async with op("ddg_search", query=query[:50], max_results=max_results) as o:
        try:
            raw = DDGS().text(query, max_results=max_results)
            results = [{"title": r.get("title", ""), "body": r.get("body", ""), "href": r.get("href", "")} 
                       for r in raw]
            o.set(count=len(results))
            if not results:
                o.fail("no_results")
            return results
        except Exception as e:
            o.fail(str(e))
            return []


async def scrape_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=Config.SCRAPE_TIMEOUT) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
            resp.raise_for_status()
        return trafilatura.extract(resp.text, include_comments=False, include_tables=True) or ""
    except Exception as e:
        logger.debug(f"Scrape failed {url}: {e}")
        return ""


async def scrape_batch(results: List[Dict]) -> int:
    """Scrape URLs concurrently, return count of successful scrapes."""
    to_scrape = [r for r in results if r.get("href") and not r.get("scraped_content")]
    if not to_scrape:
        return 0
    
    sem = asyncio.Semaphore(Config.CONCURRENCY)
    count = 0
    
    async def do_one(r):
        nonlocal count
        async with sem:
            content = await scrape_url(r["href"])
            if content:
                r["scraped_content"] = content
                count += 1
    
    await asyncio.gather(*[do_one(r) for r in to_scrape], return_exceptions=True)
    return count


# ============================================================================
# Embeddings
# ============================================================================

@lru_cache(maxsize=1)
def get_embedder():
    from langchain_nvidia import NVIDIAEmbeddings
    return NVIDIAEmbeddings(
        model=Config.EMBEDDING_MODEL,
        base_url=Config.EMBEDDING_BASE_URL,
        truncate='END', max_batch_size=128
    )

def embed_text(text: str) -> Optional[List[float]]:
    try:
        if isinstance(text, str):
            return get_embedder().embed_query(text)
        return [get_embedder().embed_query(text) for text in text]
    except Exception as e:
        logger.warning(f"Query Embedding Failed: {e}")
        return []


def embed_docs(docs: List[str]) -> Optional[List[List[float]]]:
    try:
        if isinstance(docs, str):
            return get_embedder().embed_documents([docs])[0]
        return get_embedder().embed_documents(docs)
    except Exception as e:
        logger.warning(f"Document Embedding Failed: {e}")
        return []


def cosine_similarity(a: List[float], b: List[float]) -> float:
    a, b = np.array(a), np.array(b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / norm) if norm > 0 else 0.0


# ============================================================================
# Summarization
# ============================================================================

def summarize_extractive(text: str, max_length: int = None) -> str:
    """Simple sentence-based truncation."""
    max_length = max_length or Config.SUMMARY_MAX_LENGTH
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    sentences = text.replace('\n', ' ').split('. ')
    result, length = [], 0
    for s in sentences:
        if length + len(s) + 2 <= max_length:
            result.append(s)
            length += len(s) + 2
        else:
            break
    return '. '.join(result) + ('.' if result else '')


async def summarize_llm(text: str) -> Optional[str]:
    """LLM summarization with explicit failure reporting."""
    async with op("llm_summary", input_chars=len(text)) as o:
        if len(text) < Config.MIN_SUMMARY_INPUT:
            o.fail(f"input_too_short ({len(text)} < {Config.MIN_SUMMARY_INPUT})")
            return None
        
        try:
            from langchain_nvidia import ChatNVIDIA
            llm = ChatNVIDIA(
                model=Config.LLM_MODEL,
                base_url=Config.LLM_BASE_URL,
                max_tokens=Config.LLM_MAX_TOKENS
            )
            
            prompt = SUMMARY_PROMPT.format(text=text[:8000])
            o.set(prompt_chars=len(prompt))
            
            response = await llm.ainvoke([("user", prompt)])
            content = response.content if response else None
            
            if not content:
                o.fail("empty_response")
                return None
            
            content = content.strip()
            if len(content) < Config.MIN_SUMMARY_OUTPUT:
                o.fail(f"output_too_short ({len(content)} < {Config.MIN_SUMMARY_OUTPUT})")
                return None
            
            o.set(output_chars=len(content))
            return content
            
        except Exception as e:
            o.fail(str(e))
            return None


async def generate_summary(text: str, use_llm: bool = False) -> str:
    """Generate summary with fallback chain: LLM -> extractive -> empty."""
    if not text or not text.strip():
        logger.warning("generate_summary: empty input")
        return ""
    
    if use_llm:
        result = await summarize_llm(text)
        if result:
            return result
        logger.info("LLM summary failed, using extractive fallback")
    
    return summarize_extractive(text)


def build_summary_context(query: str, results: List[Dict]) -> str:
    """Build text context for summarization from results."""
    parts = [f"Query: {query}\n"]
    for r in results:
        content = r.get("scraped_content") or r.get("body", "")
        if content:
            parts.append(f"Source: {r.get('title', 'Unknown')}\nURL: {r.get('href', '')}\nContent: {content}\n")
    return "\n".join(parts)


# ============================================================================
# Cache Operations
# ============================================================================

async def cache_lookup(query: str, threshold: float = None, db_url: str = None) -> Optional[Dict]:
    """Look up query in cache by exact match or semantic similarity."""
    threshold = threshold or Config.SIMILARITY_THRESHOLD
    qhash = hash_query(query)
    
    async with op("cache_lookup", query=query[:40], hash=qhash[:12]) as o:
        async with get_session(db_url) as session:
            # Exact match
            result = await session.execute(select(CacheEntry).where(CacheEntry.query_hash == qhash))
            entry = result.scalars().first()
            
            if entry:
                entry.access_count += 1
                entry.last_accessed = datetime.utcnow()
                o.set(hit="exact", results=len(entry.results), summary=bool(entry.summary))
                return {
                    "source": "cache-exact", "query": entry.query_text, 
                    "results": entry.results, "summary": entry.summary
                }
            
            # Semantic match
            qemb = embed_text(query)
            if qemb:
                result = await session.execute(select(CacheEntry).where(CacheEntry.embeddings.isnot(None)))
                for entry in result.scalars():
                    cemb = (entry.embeddings or {}).get("query")
                    if cemb:
                        sim = cosine_similarity(qemb, cemb)
                        if sim >= threshold:
                            entry.access_count += 1
                            entry.last_accessed = datetime.utcnow()
                            o.set(hit="semantic", sim=round(sim, 3), results=len(entry.results))
                            return {
                                "source": "cache-semantic", "query": entry.query_text,
                                "results": entry.results, "summary": entry.summary
                            }
            
            o.set(hit="miss")
            return None


async def cache_save(query: str, results: List[Dict], summary: str = None, db_url: str = None) -> bool:
    """Save results to cache."""
    qhash = hash_query(query)
    
    async with op("cache_save", query=query[:40], results=len(results), has_summary=bool(summary)) as o:
        try:
            qemb = embed_text(query)
            embeddings = {"query": qemb} if qemb else None
            
            async with get_session(db_url) as session:
                result = await session.execute(select(CacheEntry).where(CacheEntry.query_hash == qhash))
                entry = result.scalars().first()
                
                if entry:
                    entry.results = results
                    entry.summary = summary
                    entry.embeddings = embeddings
                    entry.last_accessed = datetime.utcnow()
                    o.set(action="updated")
                else:
                    session.add(CacheEntry(
                        query_hash=qhash, query_text=query, results=results,
                        embeddings=embeddings, summary=summary
                    ))
                    o.set(action="created")
                return True
        except Exception as e:
            o.fail(str(e))
            return False


async def get_cache_stats(db_url: str = None) -> Dict:
    async with get_session(db_url) as session:
        total = await session.scalar(select(func.count(CacheEntry.id)))
        result = await session.execute(select(CacheEntry).order_by(CacheEntry.created_at.desc()).limit(1))
        recent = result.scalars().first()
        return {
            "total": total or 0,
            "last_cached": recent.created_at.isoformat() if recent else None
        }


async def clear_cache(db_url: str = None) -> int:
    async with get_session(db_url) as session:
        count = await session.scalar(select(func.count(CacheEntry.id))) or 0
        await session.execute(CacheEntry.__table__.delete())
        logger.info(f"Cleared {count} cache entries")
        return count


# ============================================================================
# Main Search Function
# ============================================================================

async def cached_ddg_search(
    query: str, *,
    max_results: int = None,
    use_cache: bool = True,
    similarity_threshold: float = None,
    scrape_content: bool = False,
    summarize_each: bool = False,
    summarize_all: bool = False,
    use_llm_summary: bool = False,
    return_cached_scraped: bool = True,
    return_cached_summary: bool = True,
    database_url: str = None
) -> Dict:
    """
    Main search pipeline: cache → search → scrape → summarize → save
    
    Key behavior: If summarize_all=True and cached summary is None, 
    we REGENERATE the summary even on cache hit.
    """
    max_results = max_results or Config.MAX_RESULTS
    
    async with op("search", q=query[:50], max=max_results, cache=use_cache, 
                  scrape=scrape_content, summarize=summarize_all, llm=use_llm_summary) as main:
        
        results = []
        source = "live"
        summary = None
        scraped_count = 0
        from_cache = False
        need_summary = summarize_all
        need_save = False
        
        # === STAGE 1: Cache Lookup ===
        if use_cache:
            cached = await cache_lookup(query, similarity_threshold, database_url)
            if cached:
                results = cached["results"]
                source = cached["source"]
                from_cache = True
                
                # Use cached summary if available and requested
                if return_cached_summary and cached.get("summary"):
                    summary = cached["summary"]
                    need_summary = False
                
                # Strip scraped content if not wanted
                if not return_cached_scraped:
                    for r in results:
                        r.pop("scraped_content", None)
                        r.pop("summary", None)
                
                main.set(cache_hit=source, cached_results=len(results), cached_summary=bool(summary))
        
        # === STAGE 2: Live Search (if needed) ===
        if len(results) < max_results:
            needed = max_results - len(results)
            live = await search_duckduckgo(query, needed)
            
            if live:
                # Dedupe
                existing_urls = {r.get("href") for r in results}
                new_results = [r for r in live if r.get("href") not in existing_urls]
                
                if new_results:
                    results.extend(new_results)
                    source = "mixed" if from_cache else "live"
                    need_save = True
                    main.set(live_results=len(new_results))
            
            if not results:
                main.fail("no_results")
                return {"source": "none", "query": query, "results": [], "summary": None,
                        "scraped_count": 0, "cached": False}
        
        # === STAGE 3: Scrape (new results only) ===
        if scrape_content:
            to_scrape = [r for r in results if not r.get("scraped_content")]
            if to_scrape:
                async with op("scrape", urls=len(to_scrape)) as scrape_op:
                    scraped_count = await scrape_batch(to_scrape)
                    scrape_op.set(scraped=scraped_count, 
                                  rate=f"{scraped_count}/{len(to_scrape)}")
                    if scraped_count > 0:
                        need_save = True
        
        # === STAGE 4: Summarize Each ===
        if summarize_each:
            async with op("summarize_each", count=len(results)) as each_op:
                to_sum = [r for r in results if not r.get("summary")]
                sem = asyncio.Semaphore(Config.CONCURRENCY)
                done = 0
                
                async def do_one(r):
                    nonlocal done
                    async with sem:
                        text = r.get("scraped_content") or r.get("body", "")
                        if text:
                            r["summary"] = await generate_summary(text, use_llm_summary)
                            done += 1
                
                await asyncio.gather(*[do_one(r) for r in to_sum], return_exceptions=True)
                each_op.set(summarized=done)
                if done > 0:
                    need_save = True
        
        # === STAGE 5: Summarize All ===
        if need_summary:
            async with op("summarize_all", results=len(results), use_llm=use_llm_summary) as sum_op:
                context = build_summary_context(query, results)
                sum_op.set(context_chars=len(context))
                
                if len(context) < Config.MIN_SUMMARY_INPUT:
                    sum_op.fail(f"insufficient_content ({len(context)} chars)")
                else:
                    summary = await generate_summary(context, use_llm_summary)
                    if summary:
                        sum_op.set(summary_chars=len(summary))
                        need_save = True
                    else:
                        sum_op.fail("generation_failed")
        
        # === STAGE 6: Save to Cache ===
        saved = False
        if use_cache and need_save:
            saved = await cache_save(query, results, summary, database_url)
        
        # === Final Result ===
        main.set(source=source, total_results=len(results), 
                 has_summary=bool(summary), saved=saved)
        
        return {
            "source": source,
            "query": query,
            "results": results[:max_results],
            "summary": summary,
            "scraped_count": scraped_count,
            "cached": saved or from_cache
        }


# ============================================================================
# Convenience APIs
# ============================================================================

async def quick_search(query: str, max_results: int = 5) -> List[Dict]:
    """Quick search - results only, no scraping or summarization."""
    result = await cached_ddg_search(query, max_results=max_results)
    return result.get("results", [])


async def search_and_summarize(query: str, max_results: int = 10) -> Dict:
    """Full search with scraping and LLM summarization."""
    return await cached_ddg_search(
        query, max_results=max_results,
        scrape_content=True, summarize_all=True, use_llm_summary=True
    )


# ============================================================================
# Demo
# ============================================================================

async def demo():
    logger.info("=== DDG Cache Demo ===")
    await init_database()
    
    q = "NVIDIA DIGITS personal AI supercomputer"
    
    logger.info("--- Search 1 (expect live + summary) ---")
    r1 = await search_and_summarize(q, max_results=3)
    print(f"Source: {r1['source']}, Results: {len(r1['results'])}, Summary: {len(r1.get('summary') or '')} chars")
    
    logger.info("--- Search 2 (expect cache hit with summary) ---")
    r2 = await search_and_summarize(q, max_results=3)
    print(f"Source: {r2['source']}, Results: {len(r2['results'])}, Summary: {len(r2.get('summary') or '')} chars")
    
    logger.info(f"Stats: {await get_cache_stats()}")


if __name__ == "__main__":
    asyncio.run(demo())