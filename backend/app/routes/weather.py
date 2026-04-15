"""
app/routes/weather.py
──────────────────────
Weather endpoints — proxy for OpenWeather API with risk enrichment.

Routes:
  GET  /api/v1/weather/current   — Current weather + risk multiplier
  GET  /api/v1/weather/status    — Cache diagnostic info
  POST /api/v1/weather/cache/clear — Manually clear cache
"""

from fastapi import APIRouter, Query, HTTPException, status
from loguru import logger

from app.config import settings
from app.services.weather_service import (
    get_current_weather,
    clear_weather_cache,
    weather_cache_stats,
)
from app.schemas import WeatherResponse

router = APIRouter(prefix="/weather", tags=["Weather"])


# ════════════════════════════════════════════════════════════════
# GET /weather/current
# ════════════════════════════════════════════════════════════════

@router.get(
    "/current",
    response_model=WeatherResponse,
    summary="Get current weather conditions at a GPS point",
    description=(
        "Fetches real-time weather from OpenWeather API (cached for "
        f"{settings.WEATHER_CACHE_TTL_SECONDS // 60} minutes). "
        "Returns the raw conditions plus a computed `risk_multiplier` "
        "(1.0 = Clear, up to 1.5 for Thunderstorm/Fog). "
        "If OPENWEATHER_API_KEY is not set in .env, returns a fallback "
        "'Unknown' response with multiplier 1.0. "
        "Defaults to the highway centre configured via HIGHWAY_CENTER_LAT/LNG."
    ),
)
async def get_weather(
    lat: float = Query(
        default=None,
        description="Latitude. Defaults to HIGHWAY_CENTER_LAT from settings.",
    ),
    lng: float = Query(
        default=None,
        description="Longitude. Defaults to HIGHWAY_CENTER_LNG from settings.",
    ),
):
    # Use configured highway centre as default
    effective_lat = lat if lat is not None else settings.HIGHWAY_CENTER_LAT
    effective_lng = lng if lng is not None else settings.HIGHWAY_CENTER_LNG

    data = await get_current_weather(effective_lat, effective_lng)

    return WeatherResponse(
        latitude        = effective_lat,
        longitude       = effective_lng,
        temperature     = data.get("temperature"),
        condition       = data.get("condition", "Unknown"),
        description     = data.get("description", ""),
        humidity        = data.get("humidity"),
        wind_speed      = data.get("wind_speed"),
        visibility_km   = data.get("visibility_km"),
        risk_multiplier = data.get("risk_multiplier", 1.0),
        source          = data.get("source", "fallback"),
    )


# ════════════════════════════════════════════════════════════════
# GET /weather/status
# ════════════════════════════════════════════════════════════════

@router.get(
    "/status",
    summary="Weather cache diagnostic info",
    description="Returns cache statistics and API key configuration status.",
)
def weather_status():
    stats = weather_cache_stats()
    return {
        "api_key_configured": bool(settings.OPENWEATHER_API_KEY.strip()),
        "cache_ttl_seconds":  settings.WEATHER_CACHE_TTL_SECONDS,
        "cache":              stats,
    }


# ════════════════════════════════════════════════════════════════
# POST /weather/cache/clear
# ════════════════════════════════════════════════════════════════

@router.post(
    "/cache/clear",
    summary="Clear the weather cache",
    description="Forces a fresh API call on the next /weather/current request.",
)
def clear_cache():
    clear_weather_cache()
    return {"message": "Weather cache cleared successfully"}
