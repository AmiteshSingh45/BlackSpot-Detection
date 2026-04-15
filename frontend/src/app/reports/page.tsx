"use client";
/**
 * src/app/reports/page.tsx
 * ──────────────────────────
 * Executive summary / report view for traffic authorities and city planners.
 * Includes: KPI summary, top-10 blackspot table, cause chart,
 * monthly trend, recommendation breakdown, and print-to-PDF.
 */

import { useEffect, useState, useCallback } from "react";
import {
  BarChart2, FileText, Printer, RefreshCw, AlertTriangle,
  TrendingDown, Shield, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import {
  fetchStats, fetchTopBlackspots, fetchCauses,
  fetchMonthly, fetchRecommendationSummary,
} from "@/services/api";
import type { DashboardStats } from "@/types";

const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#06b6d4", "#ec4899"];

export default function ReportsPage() {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [topBs, setTopBs]           = useState<any[]>([]);
  const [causes, setCauses]         = useState<any[]>([]);
  const [monthly, setMonthly]       = useState<any[]>([]);
  const [recSummary, setRecSummary] = useState<any | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, bs, c, m, rs] = await Promise.all([
        fetchStats(),
        fetchTopBlackspots(10),
        fetchCauses(8),
        fetchMonthly(),
        fetchRecommendationSummary(),
      ]);
      setStats(s);
      setTopBs(bs.blackspots ?? bs);
      setCauses(Array.isArray(c) ? c : c.causes ?? []);
      setMonthly(Array.isArray(m) ? m : m.monthly ?? []);
      setRecSummary(rs);
    } catch {
      setError("Failed to load report data. Ensure the backend is running and data has been uploaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(79,142,247,0.3)", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Generating report…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: "48px", textAlign: "center" }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
        <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "18px", marginBottom: "8px" }}>Report Unavailable</div>
        <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>{error}</div>
        <button onClick={load} style={{ padding: "10px 24px", borderRadius: "10px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", cursor: "pointer", fontWeight: 600 }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={22} color="var(--accent-blue)" />
            Road Safety Report
          </h1>
          {stats && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
              {stats.analysis_year_start}–{stats.analysis_year_end} ·
              NH-48 Highway · Generated {new Date().toLocaleDateString("en-IN")}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={load}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            id="print-report"
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.1)", color: "var(--accent-blue)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            <Printer size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Executive KPIs ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
          {[
            { label: "Total Accidents",    value: stats.total_accidents,    icon: <AlertTriangle size={16} />, color: "#ef4444" },
            { label: "Blackspots",         value: stats.total_blackspots,   icon: <Shield size={16} />,        color: "#8b5cf6" },
            { label: "Fatalities",         value: stats.total_fatalities,   icon: <Users size={16} />,         color: "#f97316" },
            { label: "Grievous Injuries",  value: stats.total_grievous,     icon: <TrendingDown size={16} />,  color: "#f59e0b" },
            { label: "Blackspot Acc. %",   value: `${(stats.blackspot_accident_pct ?? 0).toFixed(1)}%`, icon: <BarChart2 size={16} />, color: "var(--accent-blue)" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="glass-card" style={{ padding: "18px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color }}>
                {icon}
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Top 10 Blackspots Table ── */}
      {topBs.length > 0 && (
        <div className="glass-card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={16} color="#8b5cf6" />
            Top 10 Blackspots (by Risk Score)
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Rank", "Chainage (km)", "Risk Tier", "Accidents", "Fatal", "Grievous", "Risk Score", "Top Cause"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topBs.slice(0, 10).map((bs: any, i: number) => (
                  <tr key={bs.id ?? i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--accent-blue)" }}>#{i + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>km {bs.segment_500m}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                        background: bs.risk_tier === "CRITICAL" ? "rgba(239,68,68,0.15)" : bs.risk_tier === "HIGH" ? "rgba(249,115,22,0.15)" : "rgba(245,158,11,0.15)",
                        color: bs.risk_tier === "CRITICAL" ? "#ef4444" : bs.risk_tier === "HIGH" ? "#f97316" : "#f59e0b",
                      }}>
                        {bs.risk_tier}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{bs.total_accidents}</td>
                    <td style={{ padding: "10px 12px", color: "#ef4444", fontWeight: 600 }}>{bs.total_fatal}</td>
                    <td style={{ padding: "10px 12px", color: "#f97316" }}>{bs.total_grievous}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--accent-blue)" }}>
                      {(bs.blackspot_rank_score ?? 0).toFixed(1)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-muted)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {bs.dominant_cause ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Cause Distribution */}
        {causes.length > 0 && (
          <div className="glass-card" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
              Accident Causes Distribution
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={causes}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ label, percentage }: any) => `${label} (${percentage?.toFixed(1)}%)`}
                  labelLine={false}
                >
                  {causes.map((_: any, idx: number) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Trend */}
        {monthly.length > 0 && (
          <div className="glass-card" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
              Monthly Accident Trend
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month_name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="accidents" stroke="#4f8ef7" strokeWidth={2} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Recommendation Summary ── */}
      {recSummary && recSummary.total > 0 && (
        <div className="glass-card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            💡 Recommended Interventions Summary
            <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 400, color: "var(--text-muted)" }}>
              {recSummary.total} total actions
            </span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* By priority */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>By Priority</div>
              {Object.entries(recSummary.by_priority ?? {}).sort(([a], [b]) => ["HIGH", "MEDIUM", "LOW"].indexOf(a) - ["HIGH", "MEDIUM", "LOW"].indexOf(b)).map(([pri, cnt]: [string, any]) => {
                const color = pri === "HIGH" ? "#ef4444" : pri === "MEDIUM" ? "#f97316" : "#3b82f6";
                const pct = Math.round((cnt / recSummary.total) * 100);
                return (
                  <div key={pri} style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color, fontWeight: 600 }}>{pri}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{cnt} ({pct}%)</span>
                    </div>
                    <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)" }}>
                      <div style={{ height: "100%", borderRadius: "3px", background: color, width: `${pct}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* By category bar chart */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>By Category</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={Object.entries(recSummary.by_category ?? {}).map(([k, v]) => ({ name: k, count: v }))} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={90} />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px" }} />
                  <Bar dataKey="count" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Print styles (injected inline) ── */}
      <style>{`
        @media print {
          aside, header, nav, button { display: none !important; }
          body { background: white !important; color: black !important; }
          .glass-card { border: 1px solid #ddd !important; background: white !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
