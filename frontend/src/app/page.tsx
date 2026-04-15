"use client";
import { useState, useMemo } from "react";
import {
  AlertTriangle, Shield, Users, Activity,
  MapPin, Clock, Car, Eye, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import Link from "next/link";
import KPICard from "@/components/ui/KPICard";
import { YearlyChart, MonthlyChart, DonutChart } from "@/components/charts/Charts";
import { SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import { RiskBadge } from "@/components/ui/Badge";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import { useStats, useYearly, useMonthly, useSeverity, useTopBlackspots, useInsights, useUploads } from "@/hooks/useBlackspotQueries";
import type { InsightItem } from "@/types";

// ─── Insight Banner Strip ─────────────────────────────────────────
function InsightStrip({ insights }: { insights: InsightItem[] }) {
  if (insights.length === 0) return null;
  const trendIcon = (trend: string) =>
    trend === "up"   ? <TrendingUp size={13} color="#ef4444" />
    : trend === "down" ? <TrendingDown size={13} color="#22c55e" />
    : <Minus size={13} color="#94a3b8" />;

  return (
    <div style={{
      display: "flex", gap: "12px", overflowX: "auto",
      padding: "4px 0", scrollbarWidth: "none",
    }}>
      {insights.map((ins, i) => (
        <div key={i} style={{
          flexShrink: 0,
          minWidth: "220px", maxWidth: "290px",
          padding: "12px 16px",
          borderRadius: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: "10px",
        }}>
          <span style={{ marginTop: "2px", flexShrink: 0 }}>{trendIcon(ins.trend)}</span>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            {ins.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [uploadFilter, setUploadFilter] = useState<number | undefined>(undefined);

  const { data: uploadsData } = useUploads();
  const uploads = uploadsData?.uploads ?? [];

  const { data: stats, isLoading: loadingStats, isError: errStats, refetch: refetchStats } = useStats(uploadFilter);
  const { data: yearlyRaw, isLoading: loadingYearly } = useYearly(uploadFilter);
  const { data: monthlyRaw, isLoading: loadingMonthly } = useMonthly(uploadFilter);
  const { data: severityRaw, isLoading: loadingSeverity } = useSeverity(uploadFilter);
  const { data: topBSRaw, isLoading: loadingTopBS } = useTopBlackspots(5, uploadFilter);
  const { data: insights, isLoading: loadingInsights } = useInsights(uploadFilter);

  const loading = loadingStats;

  const yearly   = (yearlyRaw as any)?.yearly_trend     ?? [];
  const monthly  = (monthlyRaw as any)?.monthly_trend   ?? [];
  const severity = (severityRaw as any)?.severity_distribution ?? [];
  const topBS    = (topBSRaw as any)?.top_blackspots    ?? [];

  // ── YoY delta computation ──────────────────────────────────────
  const yoyDelta = useMemo<{ accidents: number | null; fatal: number | null }>(() => {
    if (!yearly || yearly.length < 2) return { accidents: null, fatal: null };
    const y0 = yearly[yearly.length - 2];
    const y1 = yearly[yearly.length - 1];
    const accDelta = y0.accidents > 0 ? (y1.accidents - y0.accidents) / y0.accidents * 100 : null;
    const fatDelta = y0.fatal     > 0 ? (y1.fatal     - y0.fatal)     / y0.fatal     * 100 : null;
    return { accidents: accDelta !== null ? Math.round(accDelta * 10) / 10 : null, fatal: fatDelta !== null ? Math.round(fatDelta * 10) / 10 : null };
  }, [yearly]);

  const topBlackspot = topBS[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>

      {/* Dataset selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
            Overview Dashboard
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "2px" }}>
            {stats
              ? `Year ${stats.analysis_year_start ?? "?"} – ${stats.analysis_year_end ?? "?"} · ${stats.total_blackspots} blackspots`
              : loading ? "Loading…" : "No data yet"}
          </p>
        </div>
        <select
          value={uploadFilter ?? ""}
          onChange={e => setUploadFilter(e.target.value ? Number(e.target.value) : undefined)}
          style={{
            padding: "9px 14px", borderRadius: "10px",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-primary)", fontSize: "13px", cursor: "pointer",
          }}
        >
          <option value="">All Datasets</option>
          {uploads.map(u => (
            <option key={u.id} value={u.id}>
              {u.upload_label || u.original_filename} {u.upload_year ? `(${u.upload_year})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {errStats && (
        <div style={{ padding:"14px 18px", borderRadius:"12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", gap:"10px" }}>
          <AlertTriangle size={16} color="#ef4444"/>
          <span style={{ color:"#ef4444", fontSize:"13px" }}>Could not connect to backend. Is FastAPI running at :8000?</span>
          <button onClick={() => refetchStats()} style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:"8px", border:"1px solid #ef4444", background:"transparent", color:"#ef4444", fontSize:"12px", cursor:"pointer" }}>Retry</button>
        </div>
      )}

      {/* ── Insight Strip ─────────────────────────────────────── */}
      {!loadingInsights && insights && insights.length > 0 && (
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "10px" }}>
            📋 Key Insights
          </p>
          <InsightStrip insights={insights} />
        </div>
      )}

      {/* ── Top Blackspot Callout ─────────────────────────────── */}
      {topBlackspot && (
        <div style={{
          padding: "16px 20px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)",
          border: "1px solid rgba(239,68,68,0.25)",
          display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "2rem" }}>🚨</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444", margin: 0 }}>
              Most Dangerous Segment
            </p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 2px" }}>
              km {topBlackspot.segment_500m} · {topBlackspot.risk_tier}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {topBlackspot.total_accidents} accidents · {topBlackspot.total_fatal} fatal · {topBlackspot.dominant_cause ?? "Unknown cause"}
            </p>
          </div>
          <ConfidenceBadge score={topBlackspot.confidence_score} />
          <div style={{ display: "flex", gap: "8px" }}>
            <Link href="/map" style={{
              padding: "8px 14px", borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.35)", background: "transparent",
              color: "#ef4444", fontSize: "12px", fontWeight: 600, textDecoration: "none",
            }}>
              View on Map
            </Link>
            <Link href="/blackspots" style={{
              padding: "8px 14px", borderRadius: "8px",
              background: "#ef4444", border: "none",
              color: "white", fontSize: "12px", fontWeight: 600, textDecoration: "none",
            }}>
              Full Analysis →
            </Link>
          </div>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
          {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
          <KPICard
            title="Total Accidents" value={stats.total_accidents.toLocaleString()}
            icon={<AlertTriangle size={18} />} gradient="kpi-red"
            trend={yoyDelta.accidents !== null ? { value: -yoyDelta.accidents, label: "YoY" } : undefined}
          />
          <KPICard
            title="Blackspots" value={stats.total_blackspots.toLocaleString()}
            icon={<MapPin size={18} />} gradient="kpi-orange"
          />
          <KPICard
            title="Fatalities" value={stats.total_fatalities.toLocaleString()}
            icon={<Shield size={18} />} gradient="kpi-red"
            trend={yoyDelta.fatal !== null ? { value: -yoyDelta.fatal, label: "YoY" } : undefined}
          />
          <KPICard
            title="Total Casualties" value={stats.total_casualties.toLocaleString()}
            icon={<Users size={18} />} gradient="kpi-amber"
          />
          <KPICard
            title="Blackspot Accidents %" value={`${stats.blackspot_accident_pct?.toFixed(1) ?? 0}%`}
            icon={<Activity size={18} />} gradient="kpi-purple"
          />
          <KPICard
            title="Watch Zones" value={stats.total_watch_zones.toLocaleString()}
            icon={<Eye size={18} />} gradient="kpi-blue"
          />
          <KPICard
            title="Top Cause" value={stats.top_cause ?? "—"}
            icon={<Car size={18} />} gradient="kpi-teal"
          />
          <KPICard
            title="Peak Time" value={stats.top_time ?? "—"}
            icon={<Clock size={18} />} gradient="kpi-indigo"
          />
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Year-on-Year Trend
          </h3>
          {loadingYearly ? <SkeletonChart /> : <YearlyChart data={yearly} />}
        </div>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Monthly Distribution
          </h3>
          {loadingMonthly ? <SkeletonChart /> : <MonthlyChart data={monthly} />}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Severity Distribution
          </h3>
          {loadingSeverity ? <SkeletonChart /> : <DonutChart data={severity} />}
        </div>

        {/* Top blackspots */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Top 5 Blackspots
          </h3>
          {loadingTopBS ? <SkeletonChart /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {topBS.slice(0, 5).map((bs: any, i: number) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 12px", borderRadius: "10px",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                }}>
                  <span style={{ fontWeight: 800, fontSize: "14px", color: i === 0 ? "#ef4444" : "var(--text-muted)", minWidth: "24px" }}>
                    #{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                      km {bs.segment_500m}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {bs.total_accidents} accidents · {bs.total_fatal} fatal
                    </div>
                  </div>
                  <RiskBadge tier={bs.risk_tier} />
                  <ConfidenceBadge score={bs.confidence_score} size="sm" showScore={false} />
                </div>
              ))}
              {topBS.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                  No blackspots detected yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
