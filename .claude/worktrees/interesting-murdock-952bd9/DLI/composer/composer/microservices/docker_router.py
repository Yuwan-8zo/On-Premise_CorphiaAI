"""
Docker Router - Container Management Microservice
Provides REST API for Docker container lifecycle management
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator
import docker
from typing import List, Dict, Optional, Any
import logging

# Setup logging for glanceability
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Docker client - fails fast if Docker unavailable
try:
    client = docker.from_env()
    logger.info("Docker client initialized")
except Exception as e:
    logger.error(f"Docker unavailable: {e}")
    client = None

app = FastAPI(title="Docker Router", description="Container lifecycle management API")

# --- Request Models ---
class ApiKey(BaseModel):
    """API key validation model - enforces NVIDIA key format"""
    nvapi_key: str = Field(..., description="NVIDIA API key starting with 'nvapi-'")
    
    @validator('nvapi_key')
    def validate_key_prefix(cls, v):
        if not v.startswith('nvapi-'): raise ValueError('Key must start with "nvapi-"')
        return v

class AssessmentRequest(BaseModel):
    """Assessment submission with optional configuration"""
    submission: List[Dict[str, Any]] = Field(..., description="List of test cases")
    visualization_file: str = Field("/dli/outputs/assessment_traces.html", description="Generate HTML trace visualization")
    model_specs: dict = Field({"model": "nvidia/nemotron-3-nano-30b-a3b", "base_url": "http://llm_client:9000/v1"})

class RerunRequest(BaseModel):
    """Request to re-run specific test cases"""
    submission: List[Dict[str, Any]] = Field(..., description="Original submission")
    indices: Optional[List[int]] = Field(None, description="Specific indices to re-run (None = all failed)")
    model_specs: dict = Field({"model": "nvidia/nemotron-3-nano-30b-a3b", "base_url": "http://llm_client:9000/v1"})

# Global state - simple in-memory storage
STATE = {"api_key": None}

# --- Core Routes ---
@app.get("/")
async def root():
    """Lists available endpoints with descriptions"""
    return {route.path: route.description or "No description" for route in app.routes if route.path not in ["/openapi.json", "/docs"]}

@app.get("/health")
async def health():
    """Health check - verifies Docker connectivity"""
    if not client: raise HTTPException(500, "Docker unavailable")
    try:
        client.ping()
        return {"status": "healthy", "docker": "connected"}
    except: raise HTTPException(503, "Docker connection failed")

# --- Container Management ---
@app.get("/containers")
async def list_containers(all: bool = True) -> List[Dict]:
    """Lists all containers with id, name, status"""
    if not client: raise HTTPException(500, "Docker unavailable")
    return [{"id": c.id[:12], "name": c.name, "status": c.status} for c in client.containers.list(all=all)]

@app.get("/containers/{name}/logs")
async def get_logs(name: str, tail: int = 100) -> Dict[str, str]:
    """Fetches recent logs from specified container"""
    if not client: raise HTTPException(500, "Docker unavailable")
    try:
        container = client.containers.get(name)
        return {"logs": container.logs(tail=tail).decode('utf-8', errors='ignore')}
    except docker.errors.NotFound: raise HTTPException(404, f"Container '{name}' not found")
    except Exception as e: raise HTTPException(500, str(e))

@app.post("/containers/{name}/restart")
async def restart_container(name: str) -> Dict[str, str]:
    """Restarts specified container"""
    if not client: raise HTTPException(500, "Docker unavailable")
    try:
        container = client.containers.get(name)
        container.restart()
        logger.info(f"Restarted container: {name}")
        return {"status": "restarted", "container": name}
    except docker.errors.NotFound: raise HTTPException(404, f"Container '{name}' not found")
    except Exception as e: raise HTTPException(500, str(e))

# --- Key Management ---
@app.post("/key")
async def set_key(key: ApiKey):
    """Stores API key in memory - validates format"""
    STATE["api_key"] = key.nvapi_key
    logger.info("API key updated")
    return {"status": "key_set"}

# @app.get("/key")
# async def get_key() -> Dict[str, Optional[str]]:
#     """Retrieves stored API key - masked for security"""
#     key = STATE.get("api_key")
#     return {"key": f"{key[:10]}...{key[-4:]}" if key else None}


# =============================================================================#
#                          Assessment Routes                                   #
# =============================================================================#

@app.post("/run_assessment")
async def run_assessment_endpoint(request: AssessmentRequest):
    """
    Main assessment endpoint. Evaluates agent reasoning traces.
    
    Accepts either:
      - {"submission": [...]}  (basic usage)
      - {"submission": [...], "visualization_file": true}  (with trace visualization)
    """
    from assessment.run_assessment import run_assessment
    return run_assessment(
        request.submission, 
        model_specs = request.model_specs,
        visualization_file=request.visualization_file,
    )


@app.post("/run_assessment/rerun")
async def rerun_tests(request: RerunRequest):
    """
    Re-run specific test cases or all failed tests.
    
    - If indices provided: re-runs those specific cases
    - If indices is None: re-runs all previously failed cases
    
    Requires prior run_assessment call to populate the registry.
    """
    from assessment.run_assessment import get_registry
    registry = get_registry()
    submission = {"submission": request.submission}

    
    if request.indices is not None:
        results = [registry.rerun(idx, submission) for idx in request.indices]
    else:
        results = registry.rerun_failed(submission)
    
    return {
        "rerun_results": results,
        "summary": {
            "total": len(registry.list_all()),
            "passed": len(registry.list_passed()),
            "failed": len(registry.list_failed()),
        }
    }


@app.get("/run_assessment/summary")
async def get_assessment_summary(model_specs: dict):
    """
    Get summary of test results from the most recent assessment run.
    
    Returns passed/failed counts and per-test details.
    """
    from assessment.run_assessment import get_test_summary
    return get_test_summary(model_specs)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8070)