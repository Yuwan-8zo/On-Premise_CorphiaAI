# =============================================================================
# DDG Cache System - Production Dockerfile
# =============================================================================

FROM python:3.11-slim

LABEL maintainer="NVIDIA DLI"
LABEL description="DDG Cache System with semantic search"

# =============================================================================
# System Dependencies
# =============================================================================

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# Application Setup
# =============================================================================

WORKDIR /app

# Copy requirements first for better caching
COPY ddg_requirements.txt .
RUN pip install --no-cache-dir -r ddg_requirements.txt

# Pre-download ML models to avoid runtime delays
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

RUN pip install --upgrade ddgs

# Copy application code
COPY ddg_cache.py .
COPY ddg_api.py .
COPY ddg_app.py .
COPY observability.py .

# =============================================================================
# Runtime Configuration
# =============================================================================

# Environment variables with defaults
ENV DATABASE_URL="postgresql+asyncpg://user:pass@postgres:5432/ddg_cache"
ENV OTEL_EXPORTER_OTLP_ENDPOINT="http://jaeger:4317"
ENV DEBUG="0"
ENV RUN_MODE="both"

# Expose ports
# 7860: Gradio interface
# 7861: FastAPI service
EXPOSE 7860 7861

# Copy entrypoint script
COPY ddg_entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Health check - checks both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7860/health && curl -f http://localhost:7861/health || exit 1

# =============================================================================
# Entrypoint
# =============================================================================

ENTRYPOINT ["/entrypoint.sh"]

# Default: Run both services
CMD ["both"]

# Alternative commands:
# - Gradio only: CMD ["gradio"]
# - FastAPI only: CMD ["api"]
# - Both: CMD ["both"] (default)