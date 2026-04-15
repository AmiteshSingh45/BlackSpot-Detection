"use client";
import { useState, useMemo, useEffect } from "react";
import { MapPin, Layers, Filter } from "lucide-react";
import dynamic from "next/dynamic";
import { useBlackspots, useUploads } from "@/hooks/useBlackspotQueries";
import type { BlackspotRecord } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import BlackspotDrawer from "@/components/ui/BlackspotDrawer";

// Dynamic imports for Leaflet (SSR-safe)
const MapContainer  = dynamic(() => import("react-leaflet").then(m => m.MapContainer),  { ssr: false });
const TileLayer     = dynamic(() => import("react-leaflet").then(m => m.TileLayer),     { ssr: false });
const CircleMarker  = dynamic(() => import("react-leaflet").then(m => m.CircleMarker),  { ssr: false });
const Popup         = dynamic(() => import("react-leaflet").then(m => m.Popup),         { ssr: false });
const Tooltip       = dynamic(() => import("react-leaflet").then(m => m.Tooltip),       { ssr: false });

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#f59e0b",
  "BLACK SPOT": "#8b5cf6", "WATCH ZONE": "#3b82f6", SAFE: "#10b981",
};
const TIER_PRIORITY: Record<string, number> = {
  CRITICAL: 5, HIGH: 4, MODERATE: 3, "BLACK SPOT": 2, "WATCH ZONE": 1, SAFE: 0,
};

function getRiskColor(tier: string | null | undefined): string {
  if (!tier) return "#64748b";
  const t = tier.toUpperCase();
  for (const [k, v] of Object.entries(RISK_COLORS)) { if (t.includes(k)) return v; }
  return "#64748b";
}

function kmToLatLng(km: number, lat?: number | null, lng?: number | null): [number, number] {
  if (lat != null && lng != null) return [lat, lng];
  return [22.0 + km * 0.009, 77.0 + Math.sin(km * 0.15) * 0.04];
}

// Heatmap layer using leaflet.heat CDN (loaded in layout.tsx)
function HeatLayer({ blackspots }: { blackspots: BlackspotRecord[] }) {
  const { useMap } = require("react-leaflet");
  const map = useMap();

  useEffect(() => {
    const L = (window as any).L;
    if (!L?.heatLayer) return;
    const points = blackspots.map((bs) => {
      const [lat, lng] = kmToLatLng(bs.segment_500m, bs.latitude, bs.longitude);
      const intensity  = Math.min(bs.total_accidents / 20, 1.0);
      return [lat, lng, intensity];
    });
    const layer = L.heatLayer(points, { radius: 35, blur: 25, maxZoom: 14 }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [blackspots, map]);

  return null;
}

const HeatLayerDynamic = dynamic(
  () => Promise.resolve(HeatLayer),
  { ssr: false }
);

export default function MapPage() {
  const [isMounted, setIsMounted]   = useState(false);
  const [riskFilter, setRiskFilter] = useState("all");
  const [uploadFilter, setUploadFilter] = useState<number | undefined>(undefined);
  const [showHeatmap, setShowHeatmap]   = useState(false);
  const [drawerBsId, setDrawerBsId]     = useState<number | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const { data: uploadsData } = useUploads();
  const uploads = uploadsData?.uploads ?? [];

  const { data, isLoading, isError, refetch } = useBlackspots({
    limit: 500, upload_id: uploadFilter,
  });
  const allBlackspots: BlackspotRecord[] = data?.blackspots ?? [];

  // ── Top-100 rendering cap ────────────────────────────────────────
  // Always include ALL CRITICAL, fill remaining slots by rank score
  const renderList = useMemo(() => {
    let list = allBlackspots;
    if (riskFilter !== "all") {
      list = list.filter(b => (b.risk_tier ?? "").toUpperCase().includes(riskFilter.toUpperCase()));
    }
    const critical = list.filter(b => (b.risk_tier ?? "").toUpperCase() === "CRITICAL");
    const rest = list
      .filter(b => (b.risk_tier ?? "").toUpperCase() !== "CRITICAL")
      .sort((a, b) => (b.blackspot_rank_score ?? 0) - (a.blackspot_rank_score ?? 0))
      .slice(0, Math.max(0, 100 - critical.length));
    return [...critical, ...rest];
  }, [allBlackspots, riskFilter]);

  const mapCenter: [number, number] = renderList.length > 0
    ? kmToLatLng(renderList[0].segment_500m, renderList[0].latitude, renderList[0].longitude)
    : [22.0, 77.0];

  const panelStyle: React.CSSProperties = {
    position: "absolute", zIndex: 1000,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "14px 16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "float-up 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
          Interactive Map
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
          {isLoading ? "Loading…"
            : `Rendering ${renderList.length} of ${allBlackspots.length} blackspots (top-100 cap active)`}
        </p>
      </div>

      {isError && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ color: "#ef4444", fontSize: "13px" }}>Failed to load blackspot data.</span>
          <button onClick={() => refetch()} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Map canvas */}
      <div className="glass-card" style={{ height: "72vh", overflow: "hidden", padding: 0, position: "relative" }}>
        {isMounted && (
          <MapContainer
            center={mapCenter}
            zoom={10}
            style={{ height: "100%", width: "100%", borderRadius: "14px" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {/* Heatmap layer */}
            {showHeatmap && <HeatLayerDynamic blackspots={renderList} />}

            {/* CircleMarkers — summary popup + drawer CTA */}
            {!showHeatmap && renderList.map((bs) => {
              const [lat, lng] = kmToLatLng(bs.segment_500m, bs.latitude, bs.longitude);
              const color = getRiskColor(bs.risk_tier);
              const isCritical = (bs.risk_tier ?? "").toUpperCase() === "CRITICAL";
              return (
                <CircleMarker
                  key={bs.id}
                  center={[lat, lng]}
                  radius={isCritical ? 12 : 8}
                  pathOptions={{
                    color, fillColor: color, fillOpacity: 0.85,
                    weight: isCritical ? 2.5 : 1.5,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                    <span style={{ fontWeight: 700, fontSize: "12px" }}>
                      km {bs.segment_500m} · {bs.risk_tier}
                    </span>
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: "200px", padding: "4px 0" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                        km {bs.segment_500m}
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
                        <RiskBadge tier={bs.risk_tier} />
                        <ConfidenceBadge score={bs.confidence_score} size="sm" showScore={false} />
                      </div>
                      <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                        <b>{bs.total_accidents}</b> accidents · <b>{bs.total_fatal}</b> fatal
                        {bs.dominant_cause && <><br />Cause: {bs.dominant_cause}</>}
                      </div>
                      <button
                        onClick={() => setDrawerBsId(bs.id)}
                        style={{
                          marginTop: "10px", width: "100%",
                          padding: "7px 0", borderRadius: "8px",
                          background: "linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%)",
                          border: "none", color: "white",
                          fontSize: "12px", fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        View Full Analysis →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}

        {/* ── Left control panel ────────────────────────────────── */}
        <div style={{ ...panelStyle, top: "16px", left: "16px", minWidth: "220px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "10px" }}>
            Controls
          </p>

          {/* Dataset selector */}
          <select
            value={uploadFilter ?? ""}
            onChange={e => setUploadFilter(e.target.value ? Number(e.target.value) : undefined)}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: "12px", marginBottom: "10px",
            }}
          >
            <option value="">All Datasets</option>
            {uploads.map(u => (
              <option key={u.id} value={u.id}>
                {u.upload_label || u.original_filename}
              </option>
            ))}
          </select>

          {/* Risk tier filter */}
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "8px" }}>
            Risk Tier
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {[
              { label: "All Tiers",   val: "all" },
              { label: "CRITICAL",    val: "CRITICAL" },
              { label: "HIGH",        val: "HIGH" },
              { label: "MODERATE",    val: "MODERATE" },
              { label: "BLACK SPOT",  val: "BLACK SPOT" },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => setRiskFilter(val)}
                style={{
                  padding: "6px 10px", borderRadius: "7px",
                  border: riskFilter === val ? `1px solid ${getRiskColor(val === "all" ? null : val)}` : "1px solid var(--border)",
                  background: riskFilter === val ? `${getRiskColor(val === "all" ? null : val)}18` : "transparent",
                  color: riskFilter === val ? getRiskColor(val === "all" ? null : val) : "var(--text-secondary)",
                  fontSize: "11px", fontWeight: riskFilter === val ? 700 : 400,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {val !== "all" && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: getRiskColor(val), marginRight: 7 }} />}
                {label}
              </button>
            ))}
          </div>

          {/* Heatmap toggle */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: "12px", paddingTop: "12px" }}>
            <button
              onClick={() => setShowHeatmap(v => !v)}
              style={{
                width: "100%", padding: "8px 0", borderRadius: "8px",
                border: showHeatmap ? "1px solid #f97316" : "1px solid var(--border)",
                background: showHeatmap ? "rgba(249,115,22,0.12)" : "transparent",
                color: showHeatmap ? "#f97316" : "var(--text-secondary)",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
              }}
            >
              <Layers size={13} /> {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
            </button>
          </div>
        </div>

        {/* ── Legend ────────────────────────────────────────────── */}
        <div style={{ ...panelStyle, top: "16px", right: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "8px" }}>
            Legend
          </p>
          {Object.entries(RISK_COLORS).slice(0, 4).map(([tier, color]) => (
            <div key={tier} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{tier}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: "8px", paddingTop: "8px", fontSize: "10px", color: "var(--text-muted)" }}>
            Top-100 by rank score shown
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "14px",
            background: "rgba(0,0,0,0.4)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 999,
          }}>
            <div style={{ color: "white", fontWeight: 600, fontSize: "14px" }}>Loading map data…</div>
          </div>
        )}
      </div>

      {/* Full detail drawer */}
      <BlackspotDrawer blackspotId={drawerBsId} onClose={() => setDrawerBsId(null)} />
    </div>
  );
}
