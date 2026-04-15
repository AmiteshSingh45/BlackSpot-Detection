"use client";
/**
 * src/app/alerts/page.tsx
 * ─────────────────────────
 * Real-time alerts dashboard — v3 upgrade.
 * - React Query (auto-refresh every 30s)
 * - Priority score sort (high → low)
 * - Alert type badges (NEW_BLACKSPOT, RISK_UPGRADED, CLUSTER_GROWN, HIGH_RISK)
 * - Quick actions: Acknowledge all, Clear acknowledged
 */

import { useState, useMemo } from "react";
import {
  AlertTriangle, Bell, BellOff, CheckCircle, Trash2, Filter, Zap, MapPin,
} from "lucide-react";
import { useAlerts, useAlertSummary } from "@/hooks/useBlackspotQueries";
import { useQueryClient } from "@tanstack/react-query";
import { acknowledgeAlert, deleteAlert } from "@/services/api";
import { useAlertContext } from "@/context/AlertContext";
import { AlertCard } from "@/components/ui/AlertCard";
import type { AlertRecord } from "@/types";
import Link from "next/link";

const RISK_TIERS = ["ALL", "CRITICAL", "HIGH", "MODERATE", "BLACK SPOT", "WATCH ZONE"];
const TIER_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#f59e0b",
  "BLACK SPOT": "#8b5cf6", "WATCH ZONE": "#3b82f6",
};

const ALERT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  NEW_BLACKSPOT:  { label: "New Blackspot",   color: "#ef4444", icon: "🆕" },
  RISK_UPGRADED:  { label: "Risk Upgraded",   color: "#f97316", icon: "⬆️"  },
  CLUSTER_GROWN:  { label: "Cluster Grown",   color: "#8b5cf6", icon: "🔗" },
  HIGH_RISK:      { label: "High Risk",       color: "#f59e0b", icon: "⚠️" },
};

function AlertTypeBadge({ type }: { type: string }) {
  const meta = ALERT_TYPE_META[type] ?? { label: type, color: "#6366f1", icon: "🔔" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: `${meta.color}18`, color: meta.color,
      border: `1px solid ${meta.color}30`,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function PriorityBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : "#fbbf24";
  return (
    <div title={`Priority: ${score.toFixed(0)}/100`} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{
        width: "60px", height: "4px", borderRadius: "2px",
        background: "rgba(255,255,255,0.08)",
      }}>
        <div style={{
          width: `${score}%`, height: "100%", borderRadius: "2px",
          background: color, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: "11px", color, fontWeight: 600 }}>{score.toFixed(0)}</span>
    </div>
  );
}

export default function AlertsPage() {
  const { refresh: refreshBadge } = useAlertContext();
  const qc = useQueryClient();

  const [tierFilter, setTierFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showAcked, setShowAcked]   = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const { data, isLoading, isError, refetch } = useAlerts({
    limit:       300,
    risk_tier:   tierFilter !== "ALL" ? tierFilter : undefined,
    acknowledged: showAcked ? undefined : false,
  });
  const { data: summary } = useAlertSummary();

  const alerts: AlertRecord[] = data?.alerts ?? [];

  // Sort by priority_score DESC (fallback: triggered_at)
  const sorted = useMemo(() => {
    let list = [...alerts];
    if (typeFilter !== "ALL") list = list.filter(a => a.alert_type === typeFilter);
    return list.sort((a, b) => {
      const pa = a.priority_score ?? 0;
      const pb = b.priority_score ?? 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
    });
  }, [alerts, typeFilter]);

  const unread = sorted.filter(a => !a.acknowledged);

  const handleAck = async (id: number) => {
    await acknowledgeAlert(id);
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["alertSummary"] });
    refreshBadge();
  };

  const handleDelete = async (id: number) => {
    await deleteAlert(id);
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["alertSummary"] });
    refreshBadge();
  };

  const handleAckAll = async () => {
    setActionPending(true);
    try {
      await Promise.all(unread.map(a => acknowledgeAlert(a.id)));
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alertSummary"] });
      refreshBadge();
    } finally { setActionPending(false); }
  };

  const handleClearAcked = async () => {
    setActionPending(true);
    const acked = sorted.filter(a => a.acknowledged);
    try {
      await Promise.all(acked.map(a => deleteAlert(a.id)));
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alertSummary"] });
    } finally { setActionPending(false); }
  };

  const alertTypes = ["ALL", ...Array.from(new Set(alerts.map(a => a.alert_type)))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "float-up 0.4s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
            Safety Alerts
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            {isLoading ? "Loading…" : `${sorted.length} alerts · ${unread.length} unread · sorted by priority`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleAckAll}
            disabled={unread.length === 0 || actionPending}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "9px 16px", borderRadius: "10px",
              border: "1px solid var(--border)", background: "transparent",
              color: unread.length ? "var(--text-secondary)" : "var(--text-muted)",
              fontSize: "13px", cursor: unread.length ? "pointer" : "not-allowed",
            }}
          >
            <CheckCircle size={14} /> Ack All ({unread.length})
          </button>
          <button
            onClick={handleClearAcked}
            disabled={sorted.filter(a => a.acknowledged).length === 0 || actionPending}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "9px 16px", borderRadius: "10px",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.06)",
              color: "#ef4444", fontSize: "13px", cursor: "pointer",
            }}
          >
            <Trash2 size={14} /> Clear Acknowledged
          </button>
        </div>
      </div>

      {/* Summary KPI strip */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
          {[
            { label: "Total Alerts", val: summary.total_alerts, icon: "🔔", color: "#6366f1" },
            { label: "Unread",       val: summary.unread_count, icon: "📬", color: "#ef4444" },
            ...Object.entries(summary.tier_breakdown ?? {}).map(([tier, count]) => ({
              label: tier, val: count, icon: "⚠️", color: TIER_COLORS[tier] ?? "#64748b",
            })),
          ].map(({ label, val, icon, color }) => (
            <div key={label} style={{
              padding: "12px 14px", borderRadius: "12px",
              background: `${color}10`, border: `1px solid ${color}25`,
            }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{label}</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color, marginTop: "4px" }}>{icon} {val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass-card" style={{ padding: "14px 18px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={13} color="var(--text-muted)" />

        {/* Alert type filter */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {alertTypes.map(type => {
            const meta = type === "ALL" ? null : ALERT_TYPE_META[type];
            const color = meta?.color ?? "#6366f1";
            return (
              <button key={type} onClick={() => setTypeFilter(type)} style={{
                padding: "5px 12px", borderRadius: "8px",
                border: typeFilter === type ? `1px solid ${color}` : "1px solid var(--border)",
                background: typeFilter === type ? `${color}18` : "transparent",
                color: typeFilter === type ? color : "var(--text-secondary)",
                fontSize: "12px", fontWeight: typeFilter === type ? 700 : 400, cursor: "pointer",
              }}>
                {type === "ALL" ? "All Types" : (meta?.label ?? type)}
              </button>
            );
          })}
        </div>

        {/* Tier filter */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderLeft: "1px solid var(--border)", paddingLeft: "14px" }}>
          {RISK_TIERS.map(t => (
            <button key={t} onClick={() => setTierFilter(t)} style={{
              padding: "5px 11px", borderRadius: "8px",
              border: tierFilter === t ? `1px solid ${TIER_COLORS[t] ?? "#6366f1"}` : "1px solid var(--border)",
              background: tierFilter === t ? `${TIER_COLORS[t] ?? "#6366f1"}18` : "transparent",
              color: tierFilter === t ? (TIER_COLORS[t] ?? "#6366f1") : "var(--text-secondary)",
              fontSize: "11px", fontWeight: tierFilter === t ? 700 : 400, cursor: "pointer",
            }}>{t === "ALL" ? "All Tiers" : t}</button>
          ))}
        </div>

        {/* Show/hide acked toggle */}
        <button onClick={() => setShowAcked(v => !v)} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "6px 12px", borderRadius: "8px",
          border: "1px solid var(--border)", background: "transparent",
          color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer", marginLeft: "auto",
        }}>
          {showAcked ? <Bell size={13} /> : <BellOff size={13} />}
          {showAcked ? "Hide Acknowledged" : "Show Acknowledged"}
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={16} color="#ef4444" />
          <span style={{ color: "#ef4444", fontSize: "13px" }}>Failed to load alerts.</span>
          <button onClick={() => refetch()} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Alert list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {isLoading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="glass-card" style={{ padding: "20px" }}>
                <div className="skeleton" style={{ height: 16, width: "60%", borderRadius: 4, marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 12, width: "80%", borderRadius: 4 }} />
              </div>
            ))
          : sorted.length === 0
            ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <Bell size={32} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No alerts match your filters.</p>
              </div>
            )
            : sorted.map(alert => (
                <div key={alert.id} className="glass-card" style={{
                  padding: 0, overflow: "hidden",
                  borderLeft: `3px solid ${TIER_COLORS[alert.risk_tier] ?? "#6366f1"}`,
                  opacity: alert.acknowledged ? 0.6 : 1,
                  transition: "opacity 0.2s ease",
                }}>
                  <div style={{ padding: "16px 18px" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                      <AlertTypeBadge type={alert.alert_type} />
                      <span style={{
                        padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                        background: `${TIER_COLORS[alert.risk_tier] ?? "#6366f1"}15`,
                        color: TIER_COLORS[alert.risk_tier] ?? "#6366f1",
                        border: `1px solid ${TIER_COLORS[alert.risk_tier] ?? "#6366f1"}30`,
                      }}>{alert.risk_tier}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        km {alert.segment_500m} · {new Date(alert.triggered_at).toLocaleString()}
                      </span>
                      {alert.acknowledged && (
                        <span style={{ fontSize: "11px", color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: "20px" }}>
                          ✓ Acknowledged
                        </span>
                      )}
                      <div style={{ marginLeft: "auto" }}>
                        <PriorityBar score={alert.priority_score} />
                      </div>
                    </div>

                    {/* Message */}
                    <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5, margin: "0 0 12px" }}>
                      {alert.message}
                    </p>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {!alert.acknowledged && (
                        <button onClick={() => handleAck(alert.id)} style={{
                          display: "flex", alignItems: "center", gap: "5px",
                          padding: "6px 12px", borderRadius: "8px",
                          border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)",
                          color: "#22c55e", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>
                          <CheckCircle size={12} /> Acknowledge
                        </button>
                      )}
                      <Link href={`/map?km=${alert.segment_500m}`} style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "6px 12px", borderRadius: "8px",
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, textDecoration: "none",
                      }}>
                        <MapPin size={12} /> View on Map
                      </Link>
                      <Link href={`/blackspots`} style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "6px 12px", borderRadius: "8px",
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, textDecoration: "none",
                      }}>
                        <Zap size={12} /> Analysis
                      </Link>
                      <button onClick={() => handleDelete(alert.id)} style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "6px 10px", borderRadius: "8px",
                        border: "1px solid rgba(239,68,68,0.2)", background: "transparent",
                        color: "#ef4444", fontSize: "12px", cursor: "pointer", marginLeft: "auto",
                      }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
        }
      </div>
    </div>
  );
}
