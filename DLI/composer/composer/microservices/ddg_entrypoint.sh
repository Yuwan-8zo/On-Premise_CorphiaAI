#!/bin/bash
# =============================================================================
# DDG Cache System - Multi-Service Entrypoint
# =============================================================================
# Handles launching FastAPI, Gradio, or both services

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Initialize Database
# =============================================================================

init_database() {
    log_info "Initializing database..."
    python -c "
import asyncio
from ddg_cache import init_database

async def main():
    try:
        await init_database()
        print('Database initialized')
    except Exception as e:
        print(f'Database init failed: {e}')
        exit(1)

asyncio.run(main())
"
}

# =============================================================================
# Service Launchers
# =============================================================================

start_api() {
    log_info "Starting FastAPI service on port 7861..."
    exec uvicorn ddg_api:app \
        --host 0.0.0.0 \
        --port 7861 \
        --log-level ${LOG_LEVEL:-info} \
        ${RELOAD_FLAG:-} \
        &
    API_PID=$!
    log_info "FastAPI started with PID $API_PID"
}

start_gradio() {
    log_info "Starting Gradio interface on port 7860..."
    exec python ddg_app.py &
    GRADIO_PID=$!
    log_info "Gradio started with PID $GRADIO_PID"
}

# =============================================================================
# Signal Handling for Graceful Shutdown
# =============================================================================

cleanup() {
    log_warn "Received shutdown signal, cleaning up..."
    
    if [ ! -z "$API_PID" ]; then
        log_info "Stopping FastAPI (PID $API_PID)..."
        kill -TERM $API_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$GRADIO_PID" ]; then
        log_info "Stopping Gradio (PID $GRADIO_PID)..."
        kill -TERM $GRADIO_PID 2>/dev/null || true
    fi
    
    wait
    log_info "All services stopped"
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# =============================================================================
# Main Entrypoint Logic
# =============================================================================

# Set reload flag for development mode
if [ "${DEBUG:-0}" = "1" ]; then
    log_warn "Running in DEBUG mode"
    RELOAD_FLAG="--reload"
    LOG_LEVEL="debug"
fi

# Initialize database first
init_database

# Determine run mode
RUN_MODE="${1:-${RUN_MODE:-both}}"

log_info "Starting DDG Cache System in ${BLUE}${RUN_MODE}${NC} mode"

case "$RUN_MODE" in
    api)
        log_info "Mode: FastAPI only"
        start_api
        wait $API_PID
        ;;
    
    gradio)
        log_info "Mode: Gradio only"
        start_gradio
        wait $GRADIO_PID
        ;;
    
    both)
        log_info "Mode: Both services (FastAPI + Gradio)"
        
        # Start both services
        start_api
        sleep 2  # Give API time to start
        start_gradio
        
        # Wait for both processes
        log_info "Services running. Press Ctrl+C to stop."
        wait -n  # Wait for any process to exit
        
        # If one exits, clean up the other
        cleanup
        ;;
    
    *)
        log_error "Unknown run mode: $RUN_MODE"
        log_error "Valid modes: api, gradio, both"
        exit 1
        ;;
esac
