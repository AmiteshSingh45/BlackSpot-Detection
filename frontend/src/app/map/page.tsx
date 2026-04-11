"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { MapPin, AlertTriangle, Filter, Info, RefreshCw } from "lucide-react";
import { fetchBlackspots, fetchSegments } from "@/services/api";
import type { BlackspotRecord } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";

// Dynamic import for Leaflet (SSR-safe)
import dynamic from "next/dynamic";
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false });

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MODERATE: "#f59e0b",
  "BLACK SPOT": "#8b5cf6",
  "WATCH ZONE": "#3b82f6",
  SAFE: "#10b981",
};

function getRiskColor(tier: string | null | undefined): string {
  if (!tier) return "#64748b";
  const t = tier.toUpperCase();
  for (const [key, val] of Object.entries(RISK_COLORS)) {
    if (t.includes(key)) return val;
  }
  return "#64748b";
}

// Map chainage km → approximate lat/lng along the NH corridor
// Customize baseLat/baseLng to your actual highway coordinates
function kmToLatLng(km: number): [number, number] {
  const baseLat = 22.0;
  const baseLng = 77.0;
  const latPerKm = 0.009;
  const lngJitter = Math.sin(km * 0.7) * 0.03;
  return [baseLat + km * latPerKm, baseLng + lngJitter];
}

export default function MapPage() {
  const [blackspots, setBlackspots] = useState<BlackspotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<BlackspotRecord | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [bs] = await Promise.all([
        fetchBlackspots({ limit: 500 }),
        fetchSegments({ limit: 1 }), // just ping segments to warm cache
      ]);
      setBlackspots(bs.blackspots ?? []);
    } catch (e: any) {
      setError("Failed to load map data. Check backend connection.");
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, [loadData]);

  // Refresh on focus
  useEffect(() => {
    const onFocus = () => loadData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  const filtered = useMemo(() => {
    if (filter === "all") return blackspots;
    return blackspots.filter((bs) =>
      (bs.risk_tier ?? "").toUpperCase().includes(filter.toUpperCase())
    );
  }, [blackspots, filter]);

  const stats = useMemo(() => ({
    critical: blackspots.filter((b) => (b.risk_tier ?? "").toUpperCase().includes("CRITICAL")).length,
    high:     blackspots.filter((b) => (b.risk_tier ?? "").toUpperCase() === "HIGH").length,
    moderate: blackspots.filter((b) => (b.risk_tier ?? "").toUpperCase() === "MODERATE").length,
    blackspot: blackspots.filter((b) => (b.risk_tier ?? "").toUpperCase().includes("BLACK SPOT")).length,
  }), [blackspots]);

  const center: [number, number] = useMemo(() => {
    if (blackspots.length === 0) return [22.5, 77.0];
    const avgKm = blackspots.reduce((s, b) => s + b.segment_500m, 0) / blackspots.length;
    return kmToLatLng(avgKm);
  }, [blackspots]);

  return (
    <div style={{ display: "flex", gap: "20px", height: "calc(100vh - 130px)", animation: "float-up 0.4s ease" }}>
      {/* ── Left panel ── */}
      <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
        {/* Summary stats */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={16} color="var(--accent-blue)" />
              Map Summary
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh map data"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          <StatRow label="Total Plotted" value={filtered.length} color="var(--accent-blue)" />
          <StatRow label="Critical" value={stats.critical} color="#ef4444" />
          <StatRow label="High" value={stats.high} color="#f97316" />
          <StatRow label="Moderate" value={stats.moderate} color="#f59e0b" />
          <StatRow label="Black Spot" value={stats.blackspot} color="#8b5cf6" />
        </div>

        {/* Filter */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Filter size={14} />
            Filter by Risk
          </div>
          {[
            { value: "all", label: "All Blackspots" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "moderate", label: "Moderate" },
            { value: "black spot", label: "Black Spot" },
            { value: "watch zone", label: "Watch Zone" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                width: "100%", padding: "9px 12px", marginBottom: "6px",
                borderRadius: "8px",
                border: filter === f.value ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                background: filter === f.value ? "rgba(79,142,247,0.15)" : "transparent",
                color: filter === f.value ? "var(--accent-blue)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: filter === f.value ? 600 : 400,
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}
            >
              {f.label}
              {f.value !== "all" && (
                <span style={{ float: "right", fontSize: "11px", opacity: 0.7 }}>
                  {blackspots.filter((b) => (b.risk_tier ?? "").toLowerCase().includes(f.value)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px" }}>Legend</div>
          {Object.entries(RISK_COLORS).map(([tier, color]) => (
            <div key={tier} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{tier.toLowerCase()}</span>
            </div>
          ))}
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)" }}>
            Marker size = accident count
          </div>
        </div>

        {/* Selected info panel */}
        {selected && (
          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Info size={14} color="var(--accent-blue)" />
                Selected
              </span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-blue)", marginBottom: "8px" }}>km {selected.segment_500m}</div>
            <RiskBadge tier={selected.risk_tier} />
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <MiniStat label="Accidents" value={selected.total_accidents} />
              <MiniStat label="Fatalities" value={selected.total_fatal} />
              <MiniStat label="Grievous" value={selected.total_grievous} />
              <MiniStat label="Rank Score" value={(selected.blackspot_rank_score ?? 0).toFixed(2)} />
              <MiniStat label="Acc. Rate/yr" value={(selected.accident_rate ?? 0).toFixed(2)} />
              {selected.dominant_cause && <MiniStat label="Cause" value={selected.dominant_cause} />}
              {selected.cluster_id !== null && selected.cluster_id !== undefined && selected.cluster_id >= 0 && (
                <MiniStat label="Cluster" value={`#${selected.cluster_id}`} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Map area ── */}
      {/* IMPORTANT: position:relative so the loading overlay is positioned correctly */}
      <div className="glass-card" style={{ flex: 1, overflow: "hidden", padding: 0, borderRadius: "16px", position: "relative" }}>
        {/* Loading overlay */}
        {(loading || !isMounted) && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,17,23,0.85)", borderRadius: "16px",
            flexDirection: "column", gap: "12px",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(79,142,247,0.3)", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
            <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px" }}>Loading map data...</div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,17,23,0.85)", borderRadius: "16px",
            flexDirection: "column", gap: "12px",
          }}>
            <AlertTriangle size={36} color="var(--accent-red)" />
            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{error}</div>
            <button onClick={() => loadData()} style={{ padding: "8px 20px", borderRadius: "10px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontSize: "13px", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {/* Empty state overlay */}
        {!loading && !error && isMounted && blackspots.length === 0 && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,17,23,0.7)", borderRadius: "16px",
            flexDirection: "column", gap: "12px",
          }}>
            <MapPin size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>No blackspots detected yet</div>
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Upload accident data to populate the map</div>
          </div>
        )}

        {/* Leaflet map — only render when mounted and data available */}
        {isMounted && (
          <MapContainer
            key={center.join(",")}
            center={center}
            zoom={blackspots.length > 0 ? 9 : 6}
            style={{ width: "100%", height: "100%", borderRadius: "16px", background: "#1a1d27" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &amp; CartoDB"
            />
            {filtered.map((bs) => {
              const [lat, lng] = kmToLatLng(bs.segment_500m);
              const color = getRiskColor(bs.risk_tier);
              const radius = Math.max(6, Math.min(22, (bs.total_accidents ?? 0) * 0.6));
              return (
                <CircleMarker
                  key={bs.id}
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: selected?.id === bs.id ? 0.95 : 0.72,
                    weight: selected?.id === bs.id ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelected((prev) => prev?.id === bs.id ? null : bs) }}
                >
                  <Tooltip permanent={false} sticky>
                    <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
                      <strong>km {bs.segment_500m}</strong><br />
                      {bs.risk_tier ?? "Unknown"}<br />
                      {bs.total_accidents} accidents · {bs.total_fatal} fatal
                    </div>
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: "200px" }}>
                      <strong style={{ fontSize: "14px" }}>km {bs.segment_500m}</strong>
                      <div style={{ marginTop: "8px", fontSize: "12px", lineHeight: "1.8" }}>
                        <div><strong>Risk:</strong> {bs.risk_tier ?? "—"}</div>
                        <div><strong>Accidents:</strong> {bs.total_accidents}</div>
                        <div><strong>Fatal:</strong> {bs.total_fatal}</div>
                        <div><strong>Grievous:</strong> {bs.total_grievous}</div>
                        <div><strong>Rank Score:</strong> {(bs.blackspot_rank_score ?? 0).toFixed(2)}</div>
                        {bs.dominant_cause && <div><strong>Cause:</strong> {bs.dominant_cause}</div>}
                        {bs.cluster_id !== null && bs.cluster_id !== undefined && bs.cluster_id >= 0 && (
                          <div><strong>Cluster:</strong> #{bs.cluster_id}</div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
