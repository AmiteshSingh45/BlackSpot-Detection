"""
app/services/weather_service.py
────────────────────────────────
OpenWeather API integration with in-process TTL caching.

Usage:
  from app.services.weather_service import get_current_weather

  data = await get_current_weather(lat=22.0, lng=77.0)
  # data["risk_multiplier"] is 1.0–1.5 depending on conditions

Key design decisions:
  • Structured as an async function (httpx.AsyncClient) compatible
    with FastAPI's async endpoints.
  • Falls back to a sensible "Clear/Unknown" response when the API
    key is missing or the request fails — so the app never breaks.
  • WEATHER_CACHE_TTL_SECONDS (default 600 = 10 min) prevents
    hammering the free-tier API limit (60 req/min, 1000 req/day).
  • Cache key = (rounded lat, rounded lng) to avoid near-duplicate
    requests for very close coordinates.
  • Add OPENWEATHER_API_KEY=<your_key> to backend/.env to activate.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

import httpx
from loguru import logger

from app.config import settings

# ════════════════════════════════════════════════════════════════
# Risk multiplier table
# How weather conditions amplify the underlying risk score
# ════════════════════════════════════════════════════════════════

_CONDITION_MULTIPLIERS: dict[str, float] = {
    "thunderstorm": 1.50,
    "heavy rain":   1.45,
    "fog":          1.45,
    "mist":         1.35,
    "haze":         1.30,
    "rain":         1.35,
    "drizzle":      1.20,
    "snow":         1.40,
    "dust":         1.25,
    "sand":         1.25,
    "smoke":        1.20,
    "cloudy":       1.05,
    "overcast":     1.05,
    "clear":        1.00,
    "sunny":        1.00,
}


def _condition_to_multiplier(description: str) -> float:
    """Map a weather description string to a risk multiplier."""
    desc = description.lower()
    for keyword, mult in _CONDITION_MULTIPLIERS.items():
        if keyword in desc:
            return mult
    return 1.05   # unknown → slight elevation


# ════════════════════════════════════════════════════════════════
# In-process TTL cache
# ════════════════════════════════════════════════════════════════

_cache: dict[tuple[float, float], tuple[dict, float]] = {}
# key → (result_dict, expiry_unix_timestamp)


def _cache_key(lat: float, lng: float) -> tuple[float, float]:
    """Round to 2 dp (≈1 km) so nearby requests share a cache entry."""
    return round(lat, 2), round(lng, 2)


def _get_cached(lat: float, lng: float) -> Optional[dict]:
    key = _cache_key(lat, lng)
    entry = _cache.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None


def _set_cache(lat: float, lng: float, data: dict) -> None:
    key = _cache_key(lat, lng)
    expiry = time.time() + settings.WEATHER_CACHE_TTL_SECONDS
    _cache[key] = (data, expiry)


# ════════════════════════════════════════════════════════════════
# Fallback response (no API key / network failure)
# ════════════════════════════════════════════════════════════════

def _fallback_response(reason: str) -> dict:
    return {
        "temperature":     None,
        "condition":       "Unknown",
        "description":     f"Weather data unavailable ({reason})",
        "humidity":        None,
        "wind_speed":      None,
        "visibility_km":   None,
        "risk_multiplier": 1.0,
        "source":          "fallback",
    }


# ════════════════════════════════════════════════════════════════
# Main async fetch
# ════════════════════════════════════════════════════════════════

async def get_current_weather(lat: float, lng: float) -> dict:
    """
    Fetch current weather for a GPS point and enrich with risk data.

    Returns a dict with keys:
      temperature   – °C (float | None)
      condition     – main condition string e.g. "Rain"
      description   – verbose e.g. "moderate rain"
      humidity      – % (int | None)
      wind_speed    – m/s (float | None)
      visibility_km – km (float | None)
      risk_multiplier – float 1.0–1.5
      source        – "openweather" | "cache" | "fallback"
    """
    # 1 — serve from cache if warm
    cached = _get_cached(lat, lng)
    if cached:
        return {**cached, "source": "cache"}

    # 2 — check API key present
    api_key = settings.OPENWEATHER_API_KEY.strip()
    if not api_key:
        logger.warning(
            "OPENWEATHER_API_KEY not set — returning fallback weather data. "
            "Add the key to backend/.env to enable live weather."
        )
        return _fallback_response("API key not configured")

    # 3 — call OpenWeather current weather endpoint
    url = f"{settings.OPENWEATHER_BASE_URL}/weather"
    params = {
        "lat":   lat,
        "lon":   lng,
        "appid": api_key,
        "units": "metric",   # Celsius, m/s
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        raw = resp.json()

        condition   = raw["weather"][0]["main"]
        description = raw["weather"][0]["description"]
        multiplier  = _condition_to_multiplier(description)
        visibility_m: Optional[int] = raw.get("visibility")   # metres or absent

        result = {
            "temperature":     round(raw["main"]["temp"], 1),
            "condition":       condition,
            "description":     description,
            "humidity":        raw["main"]["humidity"],
            "wind_speed":      raw["wind"]["speed"],
            "visibility_km":   round(visibility_m / 1000, 2) if visibility_m else None,
            "risk_multiplier": multiplier,
            "source":          "openweather",
        }

        _set_cache(lat, lng, result)
        logger.info(
            f"Weather @ ({lat},{lng}): {condition} / {description} "
            f"(multiplier={multiplier})"
        )
        return result

    except httpx.HTTPStatusError as exc:
        logger.error(f"OpenWeather HTTP error {exc.response.status_code}: {exc}")
        return _fallback_response(f"HTTP {exc.response.status_code}")
    except Exception as exc:
        logger.error(f"Weather fetch failed: {exc}")
        return _fallback_response(str(exc))


def clear_weather_cache() -> None:
    """Manually invalidate all cached weather entries."""
    _cache.clear()
    logger.info("Weather cache cleared")


def weather_cache_stats() -> dict:
    now = time.time()
    valid   = sum(1 for _, expiry in _cache.values() if now < expiry)
    expired = len(_cache) - valid
    return {"total_entries": len(_cache), "valid": valid, "expired": expired}
