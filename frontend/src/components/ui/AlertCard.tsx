"use client";
/**
 * src/components/ui/AlertCard.tsx
 * ────────────────────────────────
 * Card component for a single alert.
 * Shows: severity badge, km marker, message, timestamp, acknowledge button.
 */

import { AlertTriangle, CheckCircle, MapPin, Clock, Trash2 } from "lucide-react";
import type { AlertRecord } from "@/types";

// ── Risk tier → color mapping ────────────────────────────────────
const TIER_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CRITICAL:    { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.35)",  text: "#ef4444", badge: "#ef4444" },
  HIGH:        { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.35)", text: "#f97316", badge: "#f97316" },
  MODERATE:    { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)", text: "#f59e0b", badge: "#f59e0b" },
  "BLACK SPOT":{ bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.35)", text: "#8b5cf6", badge: "#8b5cf6" },
  "WATCH ZONE":{ bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.35)", text: "#3b82f6", badge: "#3b82f6" },
};

const DEFAULT_COLORS = { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.25)", text: "#64748b", badge: "#64748b" };

function getTierColors(tier: string) {
  return TIER_COLORS[tier?.toUpperCase()] ?? DEFAULT_COLORS;
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0)  return `${mins}m ago`;
    return "just now";
  } catch {
    return "—";
  }
}

// ── Props ────────────────────────────────────────────────────────
interface AlertCardProps {
  alert: AlertRecord;
  onAcknowledge?: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}

export function AlertCard({ alert, onAcknowledge, onDelete, compact = false }: AlertCardProps) {
  const colors = getTierColors(alert.risk_tier);

  return (
    <div
      style={{
        background: alert.acknowledged ? "var(--bg-surface)" : colors.bg,
        border: `1px solid ${alert.acknowledged ? "var(--border)" : colors.border}`,
        borderRadius: "14px",
        padding: compact ? "14px 16px" : "18px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        transition: "all 0.2s ease",
        opacity: alert.acknowledged ? 0.65 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left accent bar */}
      {!alert.acknowledged && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            background: colors.badge,
            borderRadius: "14px 0 0 14px",
          }}
        />
      )}

      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          background: `${colors.badge}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {alert.acknowledged ? (
          <CheckCircle size={18} color="var(--text-muted)" />
        ) : (
          <AlertTriangle size={18} color={colors.badge} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          {/* Risk tier badge */}
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: colors.text,
              background: `${colors.badge}22`,
              border: `1px solid ${colors.badge}55`,
              padding: "2px 8px",
              borderRadius: "6px",
              letterSpacing: "0.5px",
            }}
          >
            {alert.risk_tier}
          </span>

          {/* Location chip */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <MapPin size={10} />
            km {alert.segment_500m}
          </span>

          {/* Risk score */}
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
            Score: <strong style={{ color: colors.text }}>{alert.risk_score.toFixed(1)}</strong>
          </span>
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: compact ? "12px" : "13px",
            color: "var(--text-primary)",
            margin: "0 0 8px",
            lineHeight: 1.5,
            fontWeight: alert.acknowledged ? 400 : 500,
          }}
        >
          {alert.message}
        </p>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Timestamp */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <Clock size={10} />
            {formatRelativeTime(alert.triggered_at)}
          </span>

          {/* Weather condition if present */}
          {alert.weather_condition && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              🌦 {alert.weather_condition}
            </span>
          )}

          {/* Action buttons */}
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            {!alert.acknowledged && onAcknowledge && (
              <button
                id={`acknowledge-alert-${alert.id}`}
                onClick={() => onAcknowledge(alert.id)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.badge}55`,
                  background: `${colors.badge}15`,
                  color: colors.text,
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${colors.badge}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${colors.badge}15`; }}
              >
                Acknowledge
              </button>
            )}
            {onDelete && (
              <button
                id={`delete-alert-${alert.id}`}
                onClick={() => onDelete(alert.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                  e.currentTarget.style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
