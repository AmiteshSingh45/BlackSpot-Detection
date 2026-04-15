"use client";
/**
 * src/components/ui/WeatherWidget.tsx
 * ─────────────────────────────────────
 * Compact weather card that auto-refreshes every 10 minutes.
 * Shows current conditions and the risk multiplier for the highway centre.
 * Works gracefully without an API key — shows "Weather unavailable".
 */

import { useEffect, useState, useCallback } from "react";
import { Cloud, Wind, Droplets, Eye, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchWeather } from "@/services/api";
import type { WeatherData } from "@/types";

// ── Condition → emoji map ────────────────────────────────────────
const CONDITION_EMOJI: Record<string, string> = {
  thunderstorm: "⛈️",
  rain:         "🌧️",
  drizzle:      "🌦️",
  snow:         "❄️",
  fog:          "🌫️",
  mist:         "🌫️",
  haze:         "🌁",
  clear:        "☀️",
  clouds:       "☁️",
  dust:         "🌪️",
  smoke:        "💨",
  unknown:      "🌡️",
};

function getConditionEmoji(condition: string): string {
  const c = condition.toLowerCase();
  for (const [key, emoji] of Object.entries(CONDITION_EMOJI)) {
    if (c.includes(key)) return emoji;
  }
  return "🌡️";
}

// ── Risk multiplier → color ──────────────────────────────────────
function multiplierColor(m: number): string {
  if (m >= 1.4) return "#ef4444";
  if (m >= 1.2) return "#f97316";
  if (m >= 1.1) return "#f59e0b";
  return "#10b981";
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
}

export function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [data, setData]         = useState<WeatherData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchWeather(lat, lng);
      setData(result);
    } catch {
      setError("Weather data unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const isFallback = data?.source === "fallback";

  return (
    <div
      className="glass-card"
      style={{ padding: "16px 20px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Cloud size={13} color="var(--accent-blue)" />
          Weather Conditions
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refresh weather"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: "12px" }}>
          Loading…
        </div>
      )}

      {error && !loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "12px" }}>
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Main condition */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span style={{ fontSize: "28px", lineHeight: 1 }}>
              {getConditionEmoji(data.condition)}
            </span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                {data.condition}
                {data.temperature !== null && (
                  <span style={{ marginLeft: "8px", color: "var(--accent-blue)" }}>
                    {data.temperature}°C
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                {data.description}
              </div>
            </div>

            {/* Risk multiplier badge */}
            <div style={{ marginLeft: "auto", textAlign: "center" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  color: multiplierColor(data.risk_multiplier),
                  lineHeight: 1,
                }}
              >
                ×{data.risk_multiplier.toFixed(2)}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                risk mult.
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {data.humidity !== null && (
              <StatChip icon={<Droplets size={10} />} label="Humidity" value={`${data.humidity}%`} />
            )}
            {data.wind_speed !== null && (
              <StatChip icon={<Wind size={10} />} label="Wind" value={`${data.wind_speed} m/s`} />
            )}
            {data.visibility_km !== null && (
              <StatChip icon={<Eye size={10} />} label="Visibility" value={`${data.visibility_km} km`} />
            )}
          </div>

          {/* Fallback notice */}
          {isFallback && (
            <div style={{ marginTop: "10px", fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Add OPENWEATHER_API_KEY to .env for live data
            </div>
          )}

          {/* Cache vs live indicator */}
          {!isFallback && (
            <div style={{ marginTop: "8px", fontSize: "10px", color: "var(--text-muted)" }}>
              {data.source === "cache" ? "📦 Cached" : "🌐 Live"} · Updates every 10 min
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}:</span>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
