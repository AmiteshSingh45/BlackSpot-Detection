"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart2, TrendingUp, Clock, AlertTriangle, Zap, RefreshCw } from "lucide-react";
import {
  fetchYearly, fetchMonthly, fetchSeverity, fetchCauses, fetchTimeOfDay,
} from "@/services/api";
import { YearlyChart, MonthlyChart, DonutChart, HBarChart, TimeRadarChart } from "@/components/charts/Charts";
import { SkeletonChart } from "@/components/ui/Skeleton";

export default function AnalyticsPage() {
  const [yearly, setYearly] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [severity, setSeverity] = useState<any[]>([]);
  const [causes, setCauses] = useState<any[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [y, m, sv, ca, t] = await Promise.all([
        fetchYearly(), fetchMonthly(), fetchSeverity(), fetchCauses(10), fetchTimeOfDay(),
      ]);
      setYearly(y.yearly_trend ?? []);
      setMonthly(m.monthly_trend ?? []);
      setSeverity(sv.severity_distribution ?? []);
      setCauses(ca.top_causes ?? []);
      setTimeOfDay(t.time_of_day ?? []);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setError("Failed to load analytics. Check backend connection.");
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { loadData(); }, [loadData]);

  // Refresh when tab regains focus
  useEffect(() => {
    const onFocus = () => loadData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>
      {/* Page title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
            Analytics &amp; Insights
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Deep dive into accident patterns, trends, and causal analysis
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {lastRefreshed && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
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
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "14px 18px", borderRadius: "12px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <AlertTriangle size={16} color="var(--accent-red)" />
          <span style={{ color: "var(--accent-red)", fontSize: "13px" }}>{error}</span>
          <button
            onClick={() => loadData()}
            style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontSize: "12px", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Yearly + Severity */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px" }}>
        <ChartCard
          title="Year-on-Year Trend"
          subtitle="Total accidents and fatalities by year"
          icon={<TrendingUp size={16} color="var(--accent-blue)" />}
          loading={loading}
          height={320}
          empty={!loading && yearly.length === 0}
        >
          <YearlyChart data={yearly} height={320} />
        </ChartCard>

        <ChartCard
          title="Severity Distribution"
          subtitle="Accident classification breakdown"
          icon={<AlertTriangle size={16} color="var(--accent-red)" />}
          loading={loading}
          height={320}
          empty={!loading && severity.length === 0}
        >
          <DonutChart data={severity} height={320} />
        </ChartCard>
      </div>

      {/* Monthly + Time of Day */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <ChartCard
          title="Monthly Trend"
          subtitle="Seasonal accident distribution"
          icon={<BarChart2 size={16} color="var(--accent-purple)" />}
          loading={loading}
          height={280}
          empty={!loading && monthly.length === 0}
        >
          <MonthlyChart data={monthly} height={280} />
        </ChartCard>

        <ChartCard
          title="Time of Day Analysis"
          subtitle="When accidents most frequently occur"
          icon={<Clock size={16} color="var(--accent-orange)" />}
          loading={loading}
          height={280}
          empty={!loading && timeOfDay.length === 0}
        >
          <TimeRadarChart data={timeOfDay} height={280} />
        </ChartCard>
      </div>

      {/* Causes (full width) */}
      <ChartCard
        title="Top Accident Causes"
        subtitle="Leading factors contributing to road accidents — top 10"
        icon={<Zap size={16} color="var(--accent-yellow)" />}
        loading={loading}
        height={340}
        empty={!loading && causes.length === 0}
      >
        <HBarChart data={causes} height={340} dataKey="count" nameKey="label" />
      </ChartCard>

      {/* Yearly stats table */}
      {!loading && yearly.length > 0 && (
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart2 size={16} color="var(--accent-blue)" />
            Yearly Statistics Table
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Year", "Accidents", "Fatal", "Grievous", "Minor", "Severity", "Fatality %", "Sev/Accident"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearly.map((row: any, i: number) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--accent-blue)" }}>{row.year}</td>
                    <td style={{ padding: "12px 14px", color: "var(--text-primary)" }}>{row.accidents}</td>
                    <td style={{ padding: "12px 14px", color: "#ef4444", fontWeight: 600 }}>{row.fatal}</td>
                    <td style={{ padding: "12px 14px", color: "#f97316" }}>{row.grievous}</td>
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{row.minor}</td>
                    <td style={{ padding: "12px 14px", color: "var(--text-primary)" }}>{(row.severity ?? 0).toFixed(1)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        background: row.fatality_rate > 20 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.1)",
                        color: row.fatality_rate > 20 ? "#ef4444" : "#10b981",
                        padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
                      }}>
                        {(row.fatality_rate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{(row.severity_per_accident ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title, subtitle, icon, loading, height, empty, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  loading: boolean; height: number; empty?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="glass-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "20px" }}>
        <div style={{ width: 32, height: 32, borderRadius: "8px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>{title}</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{subtitle}</p>
        </div>
      </div>
      {loading ? (
        <SkeletonChart height={height} />
      ) : empty ? (
        <div style={{
          height, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", fontSize: "13px", flexDirection: "column", gap: "8px",
        }}>
          <BarChart2 size={32} style={{ opacity: 0.2 }} />
          <span>No data yet — upload accident records to populate charts</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
