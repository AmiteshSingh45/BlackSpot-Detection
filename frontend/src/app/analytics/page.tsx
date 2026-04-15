"use client";
import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  useYearly, useMonthly, useSeverity, useCauses,
  useTimeOfDay, useInsights, usePersistentBlackspots, useUploads,
} from "@/hooks/useBlackspotQueries";
import { YearlyChart, MonthlyChart, DonutChart, CausesChart } from "@/components/charts/Charts";
import { SkeletonChart } from "@/components/ui/Skeleton";
import type { InsightItem, PersistentBlackspot } from "@/types";

// ─── Insight strip (shared with dashboard) ────────────────────────
function InsightStrip({ insights }: { insights: InsightItem[] }) {
  const trendIcon = (t: string) =>
    t === "up" ? <TrendingUp size={13} color="#ef4444" />
    : t === "down" ? <TrendingDown size={13} color="#22c55e" />
    : <Minus size={13} color="#94a3b8" />;

  return (
    <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "4px 0", scrollbarWidth: "none" }}>
      {insights.map((ins, i) => (
        <div key={i} style={{
          flexShrink: 0, minWidth: "200px", maxWidth: "270px",
          padding: "11px 14px", borderRadius: "12px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: "9px",
        }}>
          <span style={{ marginTop: "1px", flexShrink: 0 }}>{trendIcon(ins.trend)}</span>
          <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            {ins.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Persistent Blackspot table ────────────────────────────────────
function PersistentTable({ rows }: { rows: PersistentBlackspot[] }) {
  const tierColor: Record<string, string> = {
    CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#eab308", "BLACK SPOT": "#8b5cf6",
  };

  if (rows.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "24px 0", textAlign: "center" }}>
      Upload 2+ datasets to see persistent blackspot locations.
    </p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Km", "Appears In", "Max Tier", "Avg Accidents", "Datasets", "Status"].map(h => (
              <th key={h} style={{
                padding: "11px 14px", textAlign: "left", fontSize: "10px",
                fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)",
                textTransform: "uppercase", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
            <th style={{ padding: "11px 14px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--accent-blue)" }}>
                {row.segment_500m}
              </td>
              <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)" }}>
                {row.upload_count} uploads
              </td>
              <td style={{ padding: "12px 14px" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                  background: `${tierColor[row.max_risk_tier] ?? "#6366f1"}18`,
                  color: tierColor[row.max_risk_tier] ?? "#6366f1",
                }}>
                  {row.max_risk_tier}
                </span>
              </td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)" }}>
                {row.avg_accidents.toFixed(1)}
              </td>
              <td style={{ padding: "12px 14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                {row.upload_labels.filter(Boolean).join(", ") || row.upload_ids.join(", ")}
              </td>
              <td style={{ padding: "12px 14px" }}>
                {row.is_chronic ? (
                  <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                    🔴 Chronic
                  </span>
                ) : (
                  <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                    ⚠️ Recurring
                  </span>
                )}
              </td>
              <td style={{ padding: "12px 14px" }}>
                <Link
                  href={`/map?km=${row.segment_500m}`}
                  style={{ fontSize: "12px", color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}
                >
                  Map →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Comparison bar chart (simple grouped bars with SVG) ──────────
function ComparisonBars({
  datasets, metric,
}: {
  datasets: { label: string; yearly: any[] }[];
  metric: "accidents" | "fatal";
}) {
  if (datasets.length === 0) return null;

  // Collect all years across datasets
  const allYears = [...new Set(datasets.flatMap(d => d.yearly.map((y: any) => y.year)))].sort();
  const colors = ["#6366f1", "#f97316", "#22c55e"];

  const maxVal = Math.max(
    ...datasets.flatMap(d => d.yearly.map((y: any) => y[metric] ?? 0))
  ) || 1;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
        {datasets.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i] || "#888", display: "inline-block" }} />
            {d.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "16px" }}>
        {allYears.map((year) => (
          <div key={year} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px" }}>
              {datasets.map((d, di) => {
                const row = d.yearly.find((y: any) => y.year === year);
                const val = row?.[metric] ?? 0;
                const h   = Math.round((val / maxVal) * 100);
                return (
                  <div key={di} title={`${d.label}: ${val}`} style={{
                    width: "22px", height: `${Math.max(h, 2)}px`,
                    background: colors[di] || "#888",
                    borderRadius: "3px 3px 0 0",
                    opacity: 0.85,
                    transition: "height 0.5s ease",
                  }} />
                );
              })}
            </div>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>{year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [uploadA, setUploadA] = useState<number | undefined>(undefined);
  const [uploadB, setUploadB] = useState<number | undefined>(undefined);
  const [compareMetric, setCompareMetric] = useState<"accidents" | "fatal">("accidents");

  const { data: uploadsData } = useUploads();
  const uploads = uploadsData?.uploads ?? [];

  const { data: yearlyRaw,   isLoading: ly } = useYearly(uploadA);
  const { data: monthlyRaw,  isLoading: lm } = useMonthly(uploadA);
  const { data: severityRaw, isLoading: ls } = useSeverity(uploadA);
  const { data: causesRaw,   isLoading: lc } = useCauses(10, uploadA);
  const { data: todRaw,      isLoading: lt } = useTimeOfDay(uploadA);
  const { data: insights,    isLoading: li } = useInsights(uploadA);
  const { data: persistentBS } = usePersistentBlackspots();
  const { data: yearlyBRaw, isLoading: lyB } = useYearly(uploadB);

  const yearly   = (yearlyRaw  as any)?.yearly_trend   ?? [];
  const monthly  = (monthlyRaw as any)?.monthly_trend  ?? [];
  const severity = (severityRaw as any)?.severity_distribution  ?? [];
  const causes   = (causesRaw  as any)?.causes         ?? [];
  const tod      = (todRaw     as any)?.time_of_day    ?? [];
  const yearlyB  = (yearlyBRaw as any)?.yearly_trend   ?? [];

  const inCompareMode = uploadB !== undefined && yearlyB.length > 0;
  const datasetA = uploads.find(u => u.id === uploadA);
  const datasetB = uploads.find(u => u.id === uploadB);
  const compareDatasets = [
    { label: datasetA?.upload_label || datasetA?.original_filename || "Dataset A", yearly },
    ...(inCompareMode ? [{ label: datasetB?.upload_label || datasetB?.original_filename || "Dataset B", yearly: yearlyB }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>

      {/* Header + dataset selectors */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>Analytics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Trends, patterns & comparative analysis
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <select value={uploadA ?? ""} onChange={e => setUploadA(e.target.value ? Number(e.target.value) : undefined)}
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "13px" }}>
            <option value="">All Datasets (Primary)</option>
            {uploads.map(u => <option key={u.id} value={u.id}>{u.upload_label || u.original_filename} {u.upload_year ? `(${u.upload_year})` : ""}</option>)}
          </select>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>vs</span>
          <select value={uploadB ?? ""} onChange={e => setUploadB(e.target.value ? Number(e.target.value) : undefined)}
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "13px" }}>
            <option value="">None (Disable Compare)</option>
            {uploads.map(u => <option key={u.id} value={u.id}>{u.upload_label || u.original_filename} {u.upload_year ? `(${u.upload_year})` : ""}</option>)}
          </select>
        </div>
      </div>

      {/* Insight Strip */}
      {!li && insights && insights.length > 0 && (
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "10px" }}>
            📋 Key Insights
          </p>
          <InsightStrip insights={insights} />
        </div>
      )}

      {/* Comparison Chart */}
      {(compareDatasets.length > 0) && (
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              {inCompareMode ? "Comparative Analysis" : "Year-on-Year Trend"}
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["accidents", "fatal"] as const).map(m => (
                <button key={m} onClick={() => setCompareMetric(m)} style={{
                  padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
                  border: compareMetric === m ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: compareMetric === m ? "rgba(79,142,247,0.15)" : "transparent",
                  color: compareMetric === m ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: compareMetric === m ? 600 : 400,
                }}>
                  {m === "accidents" ? "Accidents" : "Fatalities"}
                </button>
              ))}
            </div>
          </div>
          {ly || lyB ? <SkeletonChart /> : (
            inCompareMode
              ? <ComparisonBars datasets={compareDatasets} metric={compareMetric} />
              : <YearlyChart data={yearly} />
          )}
        </div>
      )}

      {/* Standard charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Monthly Trend</h3>
          {lm ? <SkeletonChart /> : <MonthlyChart data={monthly} />}
        </div>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Severity Distribution</h3>
          {ls ? <SkeletonChart /> : <DonutChart data={severity} />}
        </div>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Top Causes</h3>
          {lc ? <SkeletonChart /> : <CausesChart data={causes} />}
        </div>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Time of Day</h3>
          {lt ? <SkeletonChart /> : <DonutChart data={tod} />}
        </div>
      </div>

      {/* Persistent / Chronic Blackspots */}
      <div className="glass-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              🔴 Persistent High-Risk Locations
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              Blackspots recurring across multiple uploads with tier ≥ HIGH
            </p>
          </div>
        </div>
        <PersistentTable rows={persistentBS ?? []} />
      </div>
    </div>
  );
}
