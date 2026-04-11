"use client";
import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Shield, Users, Activity, TrendingUp,
  MapPin, Clock, Car, Eye, Zap, RefreshCw,
} from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import { YearlyChart, MonthlyChart, DonutChart } from "@/components/charts/Charts";
import { SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import { fetchStats, fetchYearly, fetchMonthly, fetchSeverity, fetchTopBlackspots } from "@/services/api";
import type { DashboardStats } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [yearly, setYearly] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [severity, setSeverity] = useState<any[]>([]);
  const [topBS, setTopBS] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [s, y, m, sv, tb] = await Promise.all([
        fetchStats(),
        fetchYearly(),
        fetchMonthly(),
        fetchSeverity(),
        fetchTopBlackspots(5),
      ]);
      setStats(s);
      setYearly(y.yearly_trend ?? []);
      setMonthly(m.monthly_trend ?? []);
      setSeverity(sv.severity_distribution ?? []);
      setTopBS(tb.top_blackspots ?? []);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setError("Could not connect to backend. Is it running at http://127.0.0.1:8000?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30s so dashboard stays in sync after uploads
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Refresh when window regains focus (user returns from upload page)
  useEffect(() => {
    const onFocus = () => loadData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  if (error && !stats) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "60vh", flexDirection: "column", gap: "16px",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "16px",
          background: "rgba(239,68,68,0.15)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={28} color="var(--accent-red)" />
        </div>
        <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "18px" }}>Backend Unavailable</div>
        <div style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", maxWidth: 360 }}>{error}</div>
        <button
          onClick={() => loadData()}
          style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontSize: "14px", cursor: "pointer" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = stats ? [
    {
      title: "Total Accidents",
      value: stats.total_accidents.toLocaleString(),
      subtitle: `${stats.analysis_year_start ?? "—"} – ${stats.analysis_year_end ?? "—"}`,
      icon: <Activity size={18} color="#4f8ef7" />,
      gradient: "kpi-gradient-blue",
      glow: "var(--accent-blue)",
    },
    {
      title: "Blackspots",
      value: stats.total_blackspots,
      subtitle: `${stats.blackspot_accident_pct}% of all accidents`,
      icon: <AlertTriangle size={18} color="#ef4444" />,
      gradient: "kpi-gradient-red",
      glow: "var(--accent-red)",
    },
    {
      title: "Watch Zones",
      value: stats.total_watch_zones,
      subtitle: "Under surveillance",
      icon: <Eye size={18} color="#8b5cf6" />,
      gradient: "kpi-gradient-purple",
    },
    {
      title: "Fatalities",
      value: stats.total_fatalities.toLocaleString(),
      subtitle: `${stats.fatalities_in_blackspots} in blackspots`,
      icon: <Users size={18} color="#f97316" />,
      gradient: "kpi-gradient-orange",
    },
    {
      title: "Total Casualties",
      value: stats.total_casualties.toLocaleString(),
      subtitle: `Grievous: ${stats.total_grievous}  Minor: ${stats.total_minor}`,
      icon: <Shield size={18} color="#10b981" />,
      gradient: "kpi-gradient-green",
    },
    {
      title: "Highway Range",
      value: stats.highway_km_range ? `${stats.highway_km_range} km` : "—",
      subtitle: "Analyzed corridor",
      icon: <MapPin size={18} color="#4f8ef7" />,
      gradient: "kpi-gradient-blue",
    },
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>
            Executive Overview
          </h2>
          <p style={{ color: "var(--text-muted)", marginTop: "4px", fontSize: "14px" }}>
            Real-time road safety intelligence powered by ML pipeline
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {lastRefreshed && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Updated {lastRefreshed.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "10px",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer",
            }}
          >
            <RefreshCw size={12} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          {stats?.peak_year && (
            <div className="glass-card" style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <TrendingUp size={16} color="var(--accent-yellow)" />
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Peak Year</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-yellow)" }}>{stats.peak_year}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {loading
          ? Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((k, i) => <KPICard key={i} {...k} />)
        }
      </div>

      {/* Info bar */}
      {stats && (
        <div className="glass-card" style={{ padding: "16px 24px", display: "flex", gap: "32px", alignItems: "center", flexWrap: "wrap" }}>
          <InfoPill icon={<Car size={14} />} label="Top Cause" value={stats.top_cause} />
          <InfoPill icon={<Clock size={14} />} label="Peak Time" value={stats.top_time} />
          <InfoPill icon={<Zap size={14} />} label="Top Nature" value={stats.top_nature} />
          <InfoPill icon={<MapPin size={14} />} label="Highest Risk km" value={stats.highest_risk_segment_km ? `km ${stats.highest_risk_segment_km}` : null} />
          <InfoPill icon={<Activity size={14} />} label="Top Season" value={stats.top_season} />
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>Yearly Accident Trend</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>Accidents & fatalities over time</p>
          </div>
          {loading ? <SkeletonChart height={280} /> : <YearlyChart data={yearly} height={280} />}
        </div>

        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>Severity Distribution</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>By classification label</p>
          </div>
          {loading ? <SkeletonChart height={280} /> : <DonutChart data={severity} height={280} />}
        </div>
      </div>

      {/* Monthly + Top Blackspots */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>Monthly Pattern</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>Seasonal accident distribution</p>
          </div>
          {loading ? <SkeletonChart height={240} /> : <MonthlyChart data={monthly} height={240} />}
        </div>

        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>Top 5 Blackspots</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>Ranked by composite score</p>
          </div>
          {loading ? (
            Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 8 }} />)
          ) : topBS.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              No blackspots detected yet. Upload accident data to begin analysis.
            </div>
          ) : (
            topBS.map((bs: any, i: number) => (
              <div key={bs.id ?? i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 0", borderBottom: i < topBS.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "8px",
                    background: i === 0 ? "rgba(239,68,68,0.2)" : i === 1 ? "rgba(249,115,22,0.2)" : "rgba(79,142,247,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700,
                    color: i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#4f8ef7",
                  }}>
                    #{bs.rank ?? i + 1}
                  </div>
                  <div>
                    {/* FIX: use segment_500m not segment_km */}
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      km {bs.segment_500m ?? bs.segment_km ?? "—"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {bs.total_accidents} accidents · {bs.total_fatal} fatal
                    </div>
                  </div>
                </div>
                <RiskBadge tier={bs.risk_tier} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InfoPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ color: "var(--accent-blue)" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{value ?? "—"}</div>
      </div>
    </div>
  );
}
