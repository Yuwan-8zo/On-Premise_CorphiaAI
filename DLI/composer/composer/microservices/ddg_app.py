"""
ddg_app.py - Gradio Frontend for DDG Cache

Interface for the search cache with:
- Search with configurable pipeline options
- Cache browser with entry details
- Entry editing and deletion
"""

import gradio as gr
import pandas as pd
import json
import asyncio
import sys
from datetime import datetime
from typing import Tuple

from ddg_cache import (
    init_database,
    get_cache_stats,
    clear_cache,
    get_session,
    CacheEntry,
    cached_ddg_search,
    cache_save,
    Config,
)
from sqlalchemy import select, desc

sys.path.append('/dli/task/composer/microservices')
from observability import get_observability
logger, _, _, _ = get_observability("ddg-gradio")


# ============================================================================
# Theme
# ============================================================================

THEME = gr.themes.Soft(
    primary_hue="green",
    secondary_hue="slate",
    neutral_hue="gray",
    font=[gr.themes.GoogleFont("Inter"), "system-ui"],
).set(
    body_background_fill="white",
    button_primary_background_fill="#76b900",
    button_primary_background_fill_hover="#5a8f00",
)


# ============================================================================
# Helpers
# ============================================================================

def truncate(text: str, max_len: int = 80) -> str:
    if not text:
        return ""
    return text[:max_len] + "..." if len(text) > max_len else text


def fmt_time(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M")


# ============================================================================
# Search
# ============================================================================

async def do_search(
    query: str,
    max_results: int,
    use_cache: bool,
    scrape: bool,
    summarize: bool,
    use_llm: bool,
    progress=gr.Progress()
) -> Tuple[str, pd.DataFrame, str]:
    """Execute search and return (status, results_df, summary)."""
    
    query = query.strip()
    empty_df = pd.DataFrame(columns=["#", "Title", "URL", "Content"])
    
    if not query:
        return "⚠️ Enter a search query", empty_df, ""
    
    progress(0.1, desc="Searching...")
    
    try:
        result = await cached_ddg_search(
            query,
            max_results=max_results,
            use_cache=use_cache,
            scrape_content=scrape,
            summarize_all=summarize,
            use_llm_summary=use_llm,
        )
        
        progress(0.9, desc="Formatting...")
        
        # Status
        source = result.get("source", "unknown")
        status = f"""**Source:** `{source}`  
**Results:** {len(result.get('results', []))}  
**Scraped:** {result.get('scraped_count', 0)}  
**Summary:** {'✓' if result.get('summary') else '✗'}"""
        
        # Results table
        rows = []
        for i, r in enumerate(result.get("results", [])):
            rows.append({
                "#": i + 1,
                "Title": truncate(r.get("title", ""), 50),
                "URL": truncate(r.get("href", ""), 40),
                "Content": "✓" if r.get("scraped_content") else "—",
            })
        df = pd.DataFrame(rows) if rows else empty_df
        
        summary = result.get("summary", "") or ""
        
        progress(1.0)
        return status, df, summary
        
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        return f"**Error:** {e}", empty_df, ""


# ============================================================================
# Cache Operations
# ============================================================================

async def load_cache_table(limit: int = 50) -> pd.DataFrame:
    """Load cache entries as DataFrame."""
    try:
        async with get_session() as session:
            result = await session.execute(
                select(CacheEntry).order_by(desc(CacheEntry.last_accessed)).limit(limit)
            )
            rows = []
            for e in result.scalars():
                rows.append({
                    "ID": e.query_hash[:12],
                    "Query": truncate(e.query_text, 50),
                    "Results": len(e.results) if e.results else 0,
                    "Summary": "✓" if e.summary else "—",
                    "Accessed": fmt_time(e.last_accessed),
                })
            return pd.DataFrame(rows) if rows else pd.DataFrame(columns=["ID", "Query", "Results", "Summary", "Accessed"])
    except Exception as e:
        logger.error(f"Load cache failed: {e}")
        return pd.DataFrame()


async def get_stats_text() -> str:
    """Format cache stats as markdown."""
    try:
        stats = await get_cache_stats()
        return f"**Entries:** {stats['total']} | **Last:** {stats['last_cached'] or 'Never'}"
    except Exception as e:
        return f"**Error:** {e}"


async def load_entry(entry_id: str) -> Tuple[str, str, str, str]:
    """Load entry details: (info, results_json, summary, status)."""
    if not entry_id.strip():
        return "", "", "", "Enter an entry ID"
    
    try:
        async with get_session() as session:
            result = await session.execute(
                select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id.strip()}%"))
            )
            e = result.scalars().first()
            
            if not e:
                return "", "", "", f"Not found: {entry_id}"
            
            info = f"""**ID:** `{e.query_hash[:20]}...`  
**Query:** {e.query_text}  
**Results:** {len(e.results) if e.results else 0}  
**Created:** {fmt_time(e.created_at)}  
**Accesses:** {e.access_count}"""
            
            results_json = json.dumps(e.results, indent=2) if e.results else "[]"
            summary = e.summary or ""
            
            return info, results_json, summary, "✓ Loaded"
            
    except Exception as e:
        logger.error(f"Load entry failed: {e}")
        return "", "", "", f"Error: {e}"


async def save_entry(entry_id: str, summary: str, reason: str) -> Tuple[str, pd.DataFrame]:
    """Update entry summary."""
    if not entry_id.strip():
        return "Enter an entry ID", await load_cache_table()
    
    try:
        async with get_session() as session:
            result = await session.execute(
                select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id.strip()}%"))
            )
            e = result.scalars().first()
            
            if not e:
                return f"Not found: {entry_id}", await load_cache_table()
            
            if summary.strip():
                e.summary = summary.strip()
                e.last_accessed = datetime.utcnow()
                await session.commit()
                logger.info(f"Updated {entry_id[:12]} summary, reason: {reason}")
                return "✓ Summary updated", await load_cache_table()
            
            return "No changes", await load_cache_table()
            
    except Exception as e:
        logger.error(f"Save failed: {e}")
        return f"Error: {e}", await load_cache_table()


async def delete_entry(entry_id: str) -> Tuple[str, pd.DataFrame]:
    """Delete cache entry."""
    if not entry_id.strip():
        return "Enter an entry ID", await load_cache_table()
    
    try:
        async with get_session() as session:
            result = await session.execute(
                select(CacheEntry).where(CacheEntry.query_hash.like(f"{entry_id.strip()}%"))
            )
            e = result.scalars().first()
            
            if not e:
                return f"Not found: {entry_id}", await load_cache_table()
            
            await session.delete(e)
            await session.commit()
            logger.info(f"Deleted {entry_id[:12]}")
            
            return f"✓ Deleted {entry_id[:12]}", await load_cache_table()
            
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        return f"Error: {e}", await load_cache_table()


async def clear_all() -> Tuple[str, str, pd.DataFrame]:
    """Clear all cache entries."""
    try:
        count = await clear_cache()
        stats = await get_stats_text()
        table = await load_cache_table()
        return f"✓ Cleared {count} entries", stats, table
    except Exception as e:
        return f"Error: {e}", "", pd.DataFrame()


# ============================================================================
# Interface
# ============================================================================

def create_app():
    with gr.Blocks(title="DDG Cache") as demo:
        
        gr.Markdown("# DDG Search Cache")
        gr.Markdown("Search with caching, scraping, and summarization")
        
        # ---- SEARCH TAB ----
        with gr.Tab("Search"):
            with gr.Row():
                with gr.Column(scale=3):
                    query_box = gr.Textbox(label="Query", placeholder="Enter search query...", lines=2)
                    with gr.Row():
                        search_btn = gr.Button("Search", variant="primary", scale=2)
                        quick_btn = gr.Button("Quick", scale=1)
                        deep_btn = gr.Button("Deep", scale=1)
                
                with gr.Column(scale=2):
                    max_results = gr.Slider(1, 30, value=10, step=1, label="Max Results")
                    use_cache = gr.Checkbox(value=True, label="Use Cache")
                    scrape = gr.Checkbox(value=False, label="Scrape Content")
                    summarize = gr.Checkbox(value=False, label="Summarize")
                    use_llm = gr.Checkbox(value=False, label="LLM Summary")
            
            status_box = gr.Markdown("Ready")
            
            with gr.Tabs():
                with gr.Tab("Results"):
                    results_table = gr.Dataframe(wrap=True, interactive=False)
                with gr.Tab("Summary"):
                    summary_box = gr.Textbox(label="Summary", lines=12, interactive=False)
            
            # Wire search
            search_inputs = [query_box, max_results, use_cache, scrape, summarize, use_llm]
            search_outputs = [status_box, results_table, summary_box]
            
            search_btn.click(do_search, inputs=search_inputs, outputs=search_outputs)
            
            async def quick_search_wrapper(q):
                return await do_search(q, 5, True, False, False, False)
            
            async def deep_search_wrapper(q):
                return await do_search(q, 10, True, True, True, True)
            
            quick_btn.click(quick_search_wrapper, inputs=[query_box], outputs=search_outputs)
            deep_btn.click(deep_search_wrapper, inputs=[query_box], outputs=search_outputs)
        
        # ---- CACHE TAB ----
        with gr.Tab("Cache"):
            with gr.Row():
                refresh_btn = gr.Button("Refresh", scale=1)
                clear_btn = gr.Button("Clear All", variant="stop", scale=1)
            
            cache_stats = gr.Markdown()
            cache_table = gr.Dataframe(wrap=True, interactive=False)
            
            gr.Markdown("---")
            gr.Markdown("### Entry Editor")
            
            with gr.Row():
                entry_id_box = gr.Textbox(label="Entry ID", scale=3)
                load_btn = gr.Button("Load", scale=1)
            
            entry_info = gr.Markdown()
            
            with gr.Row():
                with gr.Column():
                    results_json = gr.Code(language="json", label="Results (read-only)", lines=8)
                with gr.Column():
                    summary_editor = gr.Textbox(label="Summary", lines=8)
            
            with gr.Row():
                reason_box = gr.Textbox(label="Change Reason", scale=3)
                save_btn = gr.Button("Save", variant="primary", scale=1)
                delete_btn = gr.Button("Delete", variant="stop", scale=1)
            
            edit_status = gr.Markdown()
            
            # Wire cache operations
            async def refresh():
                stats = await get_stats_text()
                table = await load_cache_table()
                return stats, table
            
            refresh_btn.click(refresh, outputs=[cache_stats, cache_table])
            clear_btn.click(clear_all, outputs=[edit_status, cache_stats, cache_table])
            
            load_btn.click(
                load_entry,
                inputs=[entry_id_box],
                outputs=[entry_info, results_json, summary_editor, edit_status]
            )
            
            save_btn.click(
                save_entry,
                inputs=[entry_id_box, summary_editor, reason_box],
                outputs=[edit_status, cache_table]
            )
            
            delete_btn.click(
                delete_entry,
                inputs=[entry_id_box],
                outputs=[edit_status, cache_table]
            )
            
            # Click row to load
            async def on_row_select(evt: gr.SelectData):
                table = await load_cache_table()
                if evt.index and len(evt.index) >= 1:
                    row_idx = evt.index[0]
                    if not table.empty and row_idx < len(table):
                        entry_id = str(table.iloc[row_idx, 0])
                        info, results, summary, status = await load_entry(entry_id)
                        return entry_id, info, results, summary, status
                return "", "", "", "", ""
            
            cache_table.select(
                on_row_select,
                outputs=[entry_id_box, entry_info, results_json, summary_editor, edit_status]
            )
        
        # ---- CONFIG TAB ----
        with gr.Tab("Config"):
            gr.Markdown("### Current Configuration")
            gr.Markdown(f"""
| Setting | Value |
|---------|-------|
| LLM Model | `{Config.LLM_MODEL}` |
| LLM URL | `{Config.LLM_BASE_URL}` |
| Embedding Model | `{Config.EMBEDDING_MODEL}` |
| Similarity Threshold | `{Config.SIMILARITY_THRESHOLD}` |
| Max Results | `{Config.MAX_RESULTS}` |
| Scrape Timeout | `{Config.SCRAPE_TIMEOUT}s` |
""")
            gr.Markdown("*Configuration is set via `Config` class in `ddg_cache.py`*")
        
        # ---- API TAB ----
        with gr.Tab("API"):
            gr.Markdown("""
### REST API

**Base:** `http://localhost:7861`

#### Create (Acquisition)
```bash
# Full search
curl -X POST http://localhost:7861/search \\
  -H "Content-Type: application/json" \\
  -d '{"query": "NVIDIA GPUs", "scrape_content": true, "summarize_all": true}'

# Quick search
curl -X POST http://localhost:7861/search/quick \\
  -d '{"query": "AI trends"}'

# Deep search  
curl -X POST http://localhost:7861/search/deep \\
  -d '{"query": "machine learning"}'
```

#### Read (Introspection)
```bash
# List entries
curl http://localhost:7861/cache/entries?limit=10

# Get entry
curl http://localhost:7861/cache/entry/{id}

# Simulate lookup
curl -X POST http://localhost:7861/cache/simulate \\
  -d '{"query": "test query", "threshold": 0.9}'

# Analyze similarity
curl -X POST http://localhost:7861/cache/analyze \\
  -d '{"query": "test", "limit": 5}'
```

#### Update (Intervention)
```bash
curl -X PATCH http://localhost:7861/cache/entry/{id} \\
  -d '{"summary": "New summary", "reason": "Correction"}'
```

#### Delete (Retirement)
```bash
# Single entry
curl -X DELETE http://localhost:7861/cache/entry/{id}

# Clear all
curl -X DELETE http://localhost:7861/cache
```

**Docs:** [http://localhost:7861/docs](http://localhost:7861/docs)
""")
        
        # Load initial data
        async def init_load():
            stats = await get_stats_text()
            table = await load_cache_table()
            return stats, table
        
        demo.load(init_load, outputs=[cache_stats, cache_table])
    
    return demo


# ============================================================================
# Main
# ============================================================================

async def startup():
    logger.info("Starting DDG Cache Gradio")
    await init_database()
    stats = await get_cache_stats()
    logger.info(f"Ready: {stats['total']} entries")


if __name__ == "__main__":
    asyncio.run(startup())
    app = create_app()
    app.queue().launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True,
        theme=THEME,
    )