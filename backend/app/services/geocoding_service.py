"""
app/services/geocoding_service.py
──────────────────────────────────
OSM-based chainage (km) → (latitude, longitude) interpolation.

Strategy:
  1. On first call, fetch the highway geometry from the Overpass API
     using the OSM relation ID configured in settings.
  2. Build a cumulative-distance lookup table from the ordered
     way-nodes that form the highway.
  3. Given a chainage_km value, linearly interpolate between the
     two nearest nodes.
  4. Results are cached in-process so the Overpass API is called
     only once per server lifetime (or manually invalidated).

Falls back to a basic linear approximation if OSM fetch fails,
so the app continues to work without internet access.
"""

from __future__ import annotations

import math
import time
from typing import Optional
import httpx
from loguru import logger

from app.config import settings

# ════════════════════════════════════════════════════════════════
# In-memory cache
# ════════════════════════════════════════════════════════════════

_cached_nodes: list[tuple[float, float, float]] = []
# Each entry: (cumulative_km, lat, lng)
_cache_loaded: bool = False
_cache_timestamp: float = 0.0
_CACHE_TTL_SECONDS = 3600 * 6   # re-fetch OSM data every 6 hours


# ════════════════════════════════════════════════════════════════
# Haversine distance
# ════════════════════════════════════════════════════════════════

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres between two GPS points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi        = math.radians(lat2 - lat1)
    dlambda     = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ════════════════════════════════════════════════════════════════
# Overpass API fetch
# ════════════════════════════════════════════════════════════════

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _build_overpass_query(relation_id: int) -> str:
    return (
        f"[out:json][timeout:60];"
        f"relation({relation_id});"
        f"way(r);"
        f"node(w);"
        f"out body;"
    )


def _fetch_osm_nodes(relation_id: int) -> list[tuple[float, float]]:
    """
    Fetch ordered (lat, lng) node list for an OSM highway relation.
    Returns an empty list on failure — caller will use fallback.
    """
    query = _build_overpass_query(relation_id)
    try:
        logger.info(f"Fetching OSM highway geometry for relation {relation_id}…")
        with httpx.Client(timeout=65) as client:
            resp = client.post(_OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
        data = resp.json()
        nodes_raw = {
            el["id"]: (el["lat"], el["lon"])
            for el in data.get("elements", [])
            if el.get("type") == "node"
        }
        if not nodes_raw:
            logger.warning("Overpass returned no nodes — will use fallback interpolation")
            return []

        # Build ordered lat/lng list (de-duplicate adjacent identical points)
        ordered: list[tuple[float, float]] = []
        for el in data.get("elements", []):
            if el.get("type") == "way":
                for nid in el.get("nodes", []):
                    if nid in nodes_raw:
                        pt = nodes_raw[nid]
                        if not ordered or ordered[-1] != pt:
                            ordered.append(pt)

        logger.success(f"OSM: loaded {len(ordered)} nodes for relation {relation_id}")
        return ordered

    except Exception as exc:
        logger.warning(f"OSM fetch failed ({exc}) — falling back to linear interpolation")
        return []


# ════════════════════════════════════════════════════════════════
# Build cumulative-distance lookup table
# ════════════════════════════════════════════════════════════════

def _build_lookup(nodes: list[tuple[float, float]]) -> list[tuple[float, float, float]]:
    """
    Convert [(lat, lng), …] into [(cum_km, lat, lng), …].
    The first node has cum_km = settings.HIGHWAY_CHAINAGE_START_KM.
    """
    table: list[tuple[float, float, float]] = []
    offset = settings.HIGHWAY_CHAINAGE_START_KM
    cum = offset
    for i, (lat, lng) in enumerate(nodes):
        if i > 0:
            prev_lat, prev_lng = nodes[i - 1]
            cum += _haversine_km(prev_lat, prev_lng, lat, lng)
        table.append((cum, lat, lng))
    return table


# ════════════════════════════════════════════════════════════════
# Fallback: simple linear approximation
# ════════════════════════════════════════════════════════════════

def _fallback_latlng(km: float) -> tuple[float, float]:
    """
    Very rough linear projection along the highway centre.
    Used when OSM data is unavailable.

    The formula places points along a NE-travelling vector from the
    configured highway centre. Adjust HIGHWAY_CENTER_LAT/LNG in .env
    to your highway's approximate midpoint for better results.
    """
    # Approximate bearing: most Indian highways run roughly N-S or NE-SW.
    # We use 0.009°/km lat (≈1 km) and a small sine jitter for visual variety.
    base_lat = settings.HIGHWAY_CENTER_LAT - (settings.HIGHWAY_CHAINAGE_START_KM * 0.009)
    lat = base_lat + km * 0.009
    lng = settings.HIGHWAY_CENTER_LNG + math.sin(km * 0.15) * 0.04
    return round(lat, 6), round(lng, 6)


# ════════════════════════════════════════════════════════════════
# Public API
# ════════════════════════════════════════════════════════════════

def _ensure_cache() -> None:
    global _cached_nodes, _cache_loaded, _cache_timestamp

    now = time.time()
    if _cache_loaded and (now - _cache_timestamp) < _CACHE_TTL_SECONDS:
        return   # cache is warm

    nodes = _fetch_osm_nodes(settings.OSM_HIGHWAY_RELATION_ID)
    if nodes:
        _cached_nodes = _build_lookup(nodes)
        _cache_loaded = True
    else:
        # Keep any existing cache; mark as attempted so we don't hammer Overpass
        _cache_loaded = True
        _cached_nodes = []

    _cache_timestamp = now


def chainage_to_latlng(km: float) -> tuple[float, float]:
    """
    Convert a chainage distance (km) to (latitude, longitude).

    Uses OSM-fetched highway geometry when available;
    falls back to linear approximation otherwise.
    """
    _ensure_cache()

    if not _cached_nodes:
        return _fallback_latlng(km)

    # Binary-search / linear scan for the two bracketing nodes
    table = _cached_nodes
    if km <= table[0][0]:
        return table[0][1], table[0][2]
    if km >= table[-1][0]:
        return table[-1][1], table[-1][2]

    for i in range(1, len(table)):
        cum_prev, lat_prev, lng_prev = table[i - 1]
        cum_curr, lat_curr, lng_curr = table[i]
        if cum_prev <= km <= cum_curr:
            span = cum_curr - cum_prev
            t    = (km - cum_prev) / span if span > 0 else 0.0
            lat  = lat_prev + t * (lat_curr - lat_prev)
            lng  = lng_prev + t * (lng_curr - lng_prev)
            return round(lat, 6), round(lng, 6)

    return _fallback_latlng(km)


def invalidate_cache() -> None:
    """Force a fresh OSM fetch on the next call (e.g. after .env change)."""
    global _cache_loaded, _cache_timestamp
    _cache_loaded = False
    _cache_timestamp = 0.0
    logger.info("Geocoding cache invalidated")


def get_cache_status() -> dict:
    """Return diagnostic info about the current cache state."""
    return {
        "loaded": _cache_loaded,
        "node_count": len(_cached_nodes),
        "age_seconds": round(time.time() - _cache_timestamp, 1) if _cache_timestamp else None,
        "osm_relation_id": settings.OSM_HIGHWAY_RELATION_ID,
        "using_fallback": _cache_loaded and len(_cached_nodes) == 0,
    }
