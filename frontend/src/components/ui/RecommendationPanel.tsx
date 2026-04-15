"use client";
/**
 * src/components/ui/RecommendationPanel.tsx
 * ───────────────────────────────────────────
 * Displays a prioritized list of action recommendations for a blackspot.
 * Used in the map popup (expanded view) and on the /reports page.
 */

import { useEffect, useState } from "react";
import { Lightbulb, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { fetchBlackspotRecommendations } from "@/services/api";
import type { RecommendationRecord } from "@/types";

// ── Priority styling ─────────────────────────────────────────────
const PRIORITY_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  HIGH:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  icon: <AlertTriangle size={11} /> },
  MEDIUM: { color: "#f97316", bg: "rgba(249,115,22,0.1)", icon: <Lightbulb size={11} /> },
  LOW:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", icon: <Info size={11} /> },
};

const DEFAULT_STYLE = { color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: <Info size={11} /> };

// ── Category → emoji ─────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  Infrastructure: "🏗️",
  Enforcement:    "👮",
  Lighting:       "💡",
  Signage:        "🚧",
  Emergency:      "🚨",
};

interface RecommendationPanelProps {
  blackspotId: number;
  /** If provided, skip fetch and use this data directly */
  recommendations?: RecommendationRecord[];
  /** Collapse after N items; user can expand */
  defaultVisible?: number;
}

export function RecommendationPanel({
  blackspotId,
  recommendations: propRecs,
  defaultVisible = 3,
}: RecommendationPanelProps) {
  const [recs, setRecs]       = useState<RecommendationRecord[]>(propRecs ?? []);
  const [loading, setLoading] = useState(!propRecs);
  const [expanded, setExpanded] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (propRecs) { setRecs(propRecs); return; }
    if (!blackspotId) return;
    setLoading(true);
    fetchBlackspotRecommendations(blackspotId)
      .then((res) => setRecs(res.recommendations ?? []))
      .catch(() => setError("Could not load recommendations"))
      .finally(() => setLoading(false));
  }, [blackspotId, propRecs]);

  if (loading) {
    return (
      <div style={{ padding: "12px 0", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
        Loading recommendations…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
        {error}
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
        No recommendations generated yet
      </div>
    );
  }

  const visible = expanded ? recs : recs.slice(0, defaultVisible);
  const hasMore = recs.length > defaultVisible;

  return (
    <div>
      {/* Header */}
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
        <Lightbulb size={13} color="#f59e0b" />
        Recommendations
        <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 400, color: "var(--text-muted)" }}>
          {recs.length} action{recs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Recommendation items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {visible.map((rec) => {
          const style  = PRIORITY_STYLE[rec.priority] ?? DEFAULT_STYLE;
          const emoji  = CATEGORY_EMOJI[rec.category] ?? "📋";
          return (
            <div
              key={rec.id}
              style={{
                background: style.bg,
                border: `1px solid ${style.color}33`,
                borderRadius: "10px",
                padding: "10px 12px",
              }}
            >
              {/* Priority + category */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ color: style.color }}>{style.icon}</span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: style.color,
                    letterSpacing: "0.5px",
                    background: `${style.color}22`,
                    padding: "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {rec.priority}
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {emoji} {rec.category}
                </span>
              </div>

              {/* Action */}
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: "0 0 4px", lineHeight: 1.4 }}>
                {rec.action}
              </p>

              {/* Rationale */}
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                {rec.rationale}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expand/collapse toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "6px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {expanded ? (
            <><ChevronUp size={12} /> Show less</>
          ) : (
            <><ChevronDown size={12} /> Show {recs.length - defaultVisible} more</>
          )}
        </button>
      )}
    </div>
  );
}
