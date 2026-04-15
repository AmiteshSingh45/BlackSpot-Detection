"use client";
// src/components/ui/ExplainabilityPanel.tsx
// Displays the "Why is this a blackspot?" explainability breakdown.
// Used inside the BlackspotDrawer (not inside Leaflet popups).

import { BlackspotDetail, getConfidenceLevel } from "@/types";
import ConfidenceBadge from "./ConfidenceBadge";

interface Props {
  data: BlackspotDetail;
}

const CRITERIA_META = [
  { key: "criteria_a" as const, label: "Criteria A", desc: "Total accidents ≥ threshold" },
  { key: "criteria_b" as const, label: "Criteria B", desc: "Total severity ≥ threshold"  },
  { key: "criteria_c" as const, label: "Criteria C", desc: "Total fatalities ≥ threshold" },
  { key: "criteria_d" as const, label: "Criteria D", desc: "Grievous injuries ≥ threshold" },
  { key: "criteria_e" as const, label: "Criteria E", desc: "Accident rate ≥ threshold"   },
];

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   "#ef4444",
  MEDIUM: "#f97316",
  LOW:    "#3b82f6",
};

function CriteriaChip({
  met, label, desc,
  actual, threshold,
}: {
  met: boolean; label: string; desc: string;
  actual?: number | null; threshold?: number | null;
}) {
  return (
    <div
      style={{
        padding:      "10px 12px",
        borderRadius: "10px",
        background:   met ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.08)",
        border:       `1px solid ${met ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.15)"}`,
        display:      "flex",
        alignItems:   "flex-start",
        gap:          "10px",
      }}
    >
      <span style={{
        fontSize:    "1.1rem",
        flexShrink:  0,
        marginTop:   "1px",
      }}>
        {met ? "✅" : "❌"}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>
          {label}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>
          {desc}
        </div>
        {met && threshold !== null && threshold !== undefined && actual !== null && actual !== undefined && (
          <div style={{ fontSize: "0.7rem", color: met ? "#22c55e" : "#94a3b8", marginTop: "4px" }}>
            {actual.toFixed(1)} ≥ {threshold.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      fontSize:    "0.7rem",
      fontWeight:  700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color:       "var(--text-secondary)",
      margin:      "20px 0 10px",
    }}>
      {children}
    </h4>
  );
}

export default function ExplainabilityPanel({ data }: Props) {
  const confLevel = getConfidenceLevel(data.confidence_score);

  // ─ Confidence ring gauge (SVG) ─────────────────────────────
  const score   = data.confidence_score ?? 0;
  const radius  = 28;
  const circ    = 2 * Math.PI * radius;
  const filled  = circ * (score / 100);
  const ringColor = score >= 75 ? "#22c55e" : score >= 50 ? "#fbbf24" : "#94a3b8";

  return (
    <div style={{ padding: "4px 0" }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
        {/* SVG ring gauge */}
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={radius} fill="none"
            stroke={ringColor} strokeWidth="7"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
          <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={ringColor}>
            {score.toFixed(0)}%
          </text>
        </svg>
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
            km {data.segment_500m}
          </div>
          <ConfidenceBadge score={data.confidence_score} showScore={false} />
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data.criteria_count} of 5 IRC criteria met
          </div>
        </div>
      </div>

      {/* ── IRC Criteria ─────────────────────────────────────── */}
      <SectionTitle>Why is this a blackspot?</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <CriteriaChip
          met={data.criteria_a} label="Criteria A" desc="Accident count"
          actual={data.total_accidents}    threshold={data.accident_threshold}
        />
        <CriteriaChip
          met={data.criteria_b} label="Criteria B" desc="Severity score"
          actual={data.total_severity}     threshold={data.severity_threshold}
        />
        <CriteriaChip
          met={data.criteria_c} label="Criteria C" desc="Fatal count"
          actual={data.total_fatal}        threshold={data.fatal_threshold}
        />
        <CriteriaChip
          met={data.criteria_d} label="Criteria D" desc="Grievous count"
          actual={data.total_grievous}     threshold={data.grievous_threshold}
        />
        <CriteriaChip
          met={data.criteria_e} label="Criteria E" desc="Accident rate"
          actual={data.accident_rate}      threshold={data.rate_threshold}
        />
      </div>

      {/* ── Contributing factors ─────────────────────────────── */}
      <SectionTitle>Contributing Factors</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {[
          data.dominant_cause   && `⚠️ ${data.dominant_cause}`,
          data.dominant_time    && `🕐 ${data.dominant_time}`,
          data.dominant_nature  && `💥 ${data.dominant_nature}`,
          data.dominant_vehicle && `🚛 ${data.dominant_vehicle}`,
        ].filter(Boolean).map((pill, i) => (
          <span key={i} style={{
            padding:      "4px 10px",
            borderRadius: "20px",
            fontSize:     "0.72rem",
            fontWeight:   500,
            background:   "rgba(99,102,241,0.12)",
            color:        "#818cf8",
            border:       "1px solid rgba(99,102,241,0.25)",
          }}>
            {pill}
          </span>
        ))}
      </div>

      {/* ── Recommendations ──────────────────────────────────── */}
      {data.recommendations.length > 0 && (
        <>
          <SectionTitle>Recommended Actions</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.recommendations.map((rec, i) => (
              <div key={i} style={{
                padding:      "10px 12px",
                borderRadius: "10px",
                background:   "rgba(255,255,255,0.03)",
                border:       "1px solid rgba(255,255,255,0.07)",
                borderLeft:   `3px solid ${PRIORITY_COLOR[rec.priority] ?? "#6366f1"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{
                    fontSize:   "0.65rem",
                    fontWeight: 700,
                    padding:    "2px 6px",
                    borderRadius:"4px",
                    background: `${PRIORITY_COLOR[rec.priority] ?? "#6366f1"}22`,
                    color:      PRIORITY_COLOR[rec.priority] ?? "#6366f1",
                  }}>
                    {rec.priority}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                    {rec.category}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                  {rec.action}
                </div>
                {rec.rationale && (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {rec.rationale}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
