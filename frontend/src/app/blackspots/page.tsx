"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Search, Filter, AlertTriangle, ChevronUp, ChevronDown, Download, RefreshCw } from "lucide-react";
import { fetchBlackspots } from "@/services/api";
import type { BlackspotRecord } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";

type SortKey = "rank" | "total_accidents" | "total_fatal" | "blackspot_rank_score" | "accident_rate";

export default function BlackspotsPage() {
  const [data, setData] = useState<BlackspotRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const limit = 20;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const r = await fetchBlackspots({
        skip: page * limit,
        limit,
        risk_tier: riskFilter || undefined,
      });
      setData(r.blackspots ?? []);
      setTotal(r.total ?? 0);
    } catch (e: any) {
      setError("Failed to load blackspots. Check backend connection.");
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, riskFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => loadData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  const filtered = useMemo(() => {
    let d = [...data];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((b) =>
        String(b.segment_500m).includes(s) ||
        (b.dominant_cause ?? "").toLowerCase().includes(s) ||
        (b.locations ?? "").toLowerCase().includes(s) ||
        (b.risk_tier ?? "").toLowerCase().includes(s)
      );
    }
    d.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return d;
  }, [data, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Export to CSV
  const exportCSV = useCallback(() => {
    if (data.length === 0) return;
    const headers = [
      "Rank", "Km", "Risk Tier", "Total Accidents", "Fatal", "Grievous",
      "Total Severity", "Accident Rate", "Rank Score", "Dominant Cause",
      "Dominant Nature", "Dominant Vehicle", "Dominant Time", "Cluster ID", "Locations",
    ];
    const rows = data.map((b) => [
      b.rank ?? "",
      b.segment_500m,
      b.risk_tier ?? "",
      b.total_accidents,
      b.total_fatal,
      b.total_grievous,
      b.total_severity,
      b.accident_rate.toFixed(2),
      b.blackspot_rank_score.toFixed(3),
      b.dominant_cause ?? "",
      b.dominant_nature ?? "",
      b.dominant_vehicle ?? "",
      b.dominant_time ?? "",
      b.cluster_id ?? "",
      `"${(b.locations ?? "").replace(/"/g, "'")}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blackspots_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <span style={{ opacity: 0.3 }}><ChevronUp size={12} /></span>;

  const columns: { label: string; key: SortKey; sortable?: boolean; render: (b: BlackspotRecord) => React.ReactNode }[] = [
    { label: "Rank", key: "rank", sortable: true, render: (b) => (
      <span style={{ fontWeight: 700, color: (b.rank ?? 99) <= 3 ? "#ef4444" : "var(--text-primary)" }}>
        #{b.rank ?? "—"}
      </span>
    )},
    { label: "Km", key: "rank", render: (b) => (
      <span style={{ fontWeight: 600, color: "var(--accent-blue)" }}>{b.segment_500m}</span>
    )},
    { label: "Risk Tier", key: "rank", render: (b) => <RiskBadge tier={b.risk_tier} /> },
    { label: "Accidents", key: "total_accidents", sortable: true, render: (b) => b.total_accidents },
    { label: "Fatal", key: "total_fatal", sortable: true, render: (b) => (
      <span style={{ color: b.total_fatal > 5 ? "#ef4444" : "var(--text-primary)", fontWeight: 600 }}>{b.total_fatal}</span>
    )},
    { label: "Rate/yr", key: "accident_rate", sortable: true, render: (b) => (b.accident_rate ?? 0).toFixed(2) },
    { label: "Score", key: "blackspot_rank_score", sortable: true, render: (b) => (b.blackspot_rank_score ?? 0).toFixed(2) },
    { label: "Cause", key: "rank", render: (b) => (
      <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{b.dominant_cause ?? "—"}</span>
    )},
    { label: "Cluster", key: "rank", render: (b) =>
      b.cluster_id !== null && b.cluster_id !== undefined && b.cluster_id >= 0
        ? <span style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", padding: "2px 8px", borderRadius: "12px", fontSize: "11px" }}>#{b.cluster_id}</span>
        : <span style={{ color: "var(--text-muted)" }}>—</span>
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "float-up 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
            Detected Blackspots
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            {loading ? "Loading..." : `${total} high-risk segments identified by the ML pipeline`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 16px", borderRadius: "10px",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "10px",
              background: data.length > 0 ? "var(--gradient-1)" : "var(--bg-card)",
              border: "none",
              color: data.length > 0 ? "white" : "var(--text-muted)",
              fontSize: "13px", fontWeight: 600, cursor: data.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={16} color="var(--accent-red)" />
          <span style={{ color: "var(--accent-red)", fontSize: "13px" }}>{error}</span>
          <button onClick={() => loadData()} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontSize: "12px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card" style={{ padding: "16px 20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "10px", padding: "9px 14px" }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search km, cause, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "13px", width: "100%" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: "16px", lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Risk tier filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Filter size={14} color="var(--text-muted)" />
          {["", "CRITICAL", "HIGH", "MODERATE", "BLACK SPOT"].map((t) => (
            <button
              key={t}
              onClick={() => { setRiskFilter(t); setPage(0); }}
              style={{
                padding: "7px 14px", borderRadius: "8px",
                border: riskFilter === t ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                background: riskFilter === t ? "rgba(79,142,247,0.15)" : "transparent",
                color: riskFilter === t ? "var(--accent-blue)" : "var(--text-secondary)",
                fontSize: "12px", fontWeight: riskFilter === t ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              }}
            >
              {t || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    onClick={() => col.sortable && toggleSort(col.key)}
                    style={{
                      padding: "14px 16px", textAlign: "left",
                      fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px",
                      color: "var(--text-muted)", textTransform: "uppercase",
                      cursor: col.sortable ? "pointer" : "default", userSelect: "none",
                      background: "var(--bg-card)", whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {col.label} {col.sortable && <SortIcon k={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {columns.map((_, j) => (
                      <td key={j} style={{ padding: "14px 16px" }}>
                        <div className="skeleton" style={{ height: 16, borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                    {search || riskFilter
                      ? "No blackspots match your filters."
                      : "No blackspots detected yet. Upload accident data to start the ML pipeline."}
                  </td>
                </tr>
              ) : (
                filtered.map((bs) => (
                  <tr
                    key={bs.id}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s", cursor: "default" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {columns.map((col, j) => (
                      <td key={j} style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {col.render(bs)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > limit && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <PagBtn label="← Prev" disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
              {Array.from({ length: Math.min(5, Math.ceil(total / limit)) }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  style={{
                    width: 36, height: 36, borderRadius: "8px",
                    border: page === i ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                    background: page === i ? "rgba(79,142,247,0.15)" : "transparent",
                    color: page === i ? "var(--accent-blue)" : "var(--text-secondary)",
                    fontSize: "13px", cursor: "pointer",
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <PagBtn label="Next →" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PagBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: "8px",
        border: "1px solid var(--border)",
        background: disabled ? "transparent" : "var(--bg-card)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
