"""
app/middleware/auth.py
──────────────────────
API Key authentication middleware (skeleton / optional).

Enable by setting in .env:
    REQUIRE_API_KEY=true
    API_SECRET_KEY=your-secret-key-here

When disabled (default), all requests pass through unchanged.
When enabled, every request must include:
    X-API-Key: <API_SECRET_KEY>

Usage (in main.py — uncomment when needed):
    from app.middleware.auth import APIKeyMiddleware
    app.add_middleware(APIKeyMiddleware)
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.config import settings


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Optional API Key enforcement middleware.
    Controlled by REQUIRE_API_KEY env var (default: false).
    """

    # Paths that bypass auth check (health checks, docs)
    EXEMPT_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/health"}

    async def dispatch(self, request: Request, call_next):
        # Fast path: auth disabled
        if not getattr(settings, "REQUIRE_API_KEY", False):
            return await call_next(request)

        # Exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Check header
        api_key = request.headers.get("X-API-Key", "")
        expected = getattr(settings, "API_SECRET_KEY", "")

        if not api_key or api_key != expected:
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "Invalid or missing API key. Provide X-API-Key header.",
                    "code": "UNAUTHORIZED",
                },
            )

        return await call_next(request)
