import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.planner import router as planner_router
from app.api.routes import router
from app.core.body_limit import BodyLimitMiddleware
from app.core.config import settings
from app.database.store import engine, initialize
from app.services.community import router as community_router


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps(
            {
                "level": record.levelname,
                "event": record.getMessage(),
                **{
                    k: getattr(record, k)
                    for k in ["latency_ms", "provider", "error_type"]
                    if hasattr(record, k)
                },
            }
        )


logging.getLogger("uvicorn.access").disabled = True
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.getLogger("mausam").addHandler(handler)
logging.getLogger("mausam").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(title="Mausam Setu API", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.add_middleware(BodyLimitMiddleware, limit=3_000_000)
requests = defaultdict(deque)
report_requests = defaultdict(deque)


@app.exception_handler(SQLAlchemyError)
async def database_unavailable(request, error):
    logging.getLogger("mausam").warning(
        "database_unavailable", extra={"error_type": type(error).__name__}
    )
    return JSONResponse(
        {"detail": "Storage is temporarily unavailable. Please retry shortly."},
        503,
        headers={"Retry-After": "30"},
    )


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method == "POST":
        try:
            if int(request.headers.get("content-length", "0")) > 3_000_000:
                return JSONResponse({"detail": "Upload too large"}, 413)
        except ValueError:
            return JSONResponse({"detail": "Invalid content length"}, 400)
    start = time.monotonic()
    host = request.client.host if request.client else "unknown"
    bucket = requests[host]
    while bucket and bucket[0] < start - 60:
        bucket.popleft()
    if len(bucket) >= settings.rate_limit_per_minute:
        return JSONResponse(
            {"detail": "Too many requests. Try again shortly."}, 429, headers={"Retry-After": "60"}
        )
    bucket.append(start)
    if request.method == "POST" and request.url.path == "/api/community/reports":
        reports = report_requests[host]
        while reports and reports[0] < start - 600:
            reports.popleft()
        if len(reports) >= 5:
            return JSONResponse(
                {"detail": "Report limit reached. Please wait before submitting again."},
                429,
                headers={"Retry-After": "600"},
            )
        reports.append(start)
        if len(report_requests) > 10000:
            for key in list(report_requests):
                if not report_requests[key] or report_requests[key][-1] < start - 600:
                    report_requests.pop(key, None)
    if len(requests) > 10000:
        for key in list(requests):
            if not requests[key] or requests[key][-1] < start - 60:
                requests.pop(key, None)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    logging.getLogger("mausam").info(
        "request_complete", extra={"latency_ms": int((time.monotonic() - start) * 1000)}
    )
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Mausam Setu"}


@app.get("/ready")
async def ready():
    try:
        with engine.connect() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return JSONResponse({"status": "not ready"}, 503)


app.include_router(router)

app.include_router(planner_router)

app.include_router(community_router)
