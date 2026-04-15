"use client";
import { useState, useMemo, useCallback, Fragment } from "react";
import {
  Search, Filter, Download, ChevronUp, ChevronDown, ChevronRight,
} from "lucide-react";
import { useBlackspots, useUploads } from "@/hooks/useBlackspotQueries";
import type { BlackspotRecord } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import BlackspotDrawer from "@/components/ui/BlackspotDrawer";

type SortKey = "rank" | "total_accidents" | "total_fatal" | "blackspot_rank_score" | "accident_rate" | "confidence_score";

export default function BlackspotsPage() {
  const [page, setPage]           = useState(0);
  const [search, setSearch]       = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("rank");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [uploadFilter, setUploadFilter] = useState<number | undefined>(undefined);
  // Accordion: only ONE row expanded at a time
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Drawer for full explainability
  const [drawerBsId, setDrawerBsId] = useState<number | null>(null);
  const limit = 20;

  const { data: uploadsData } = useUploads();
  const uploads = uploadsData?.uploads ?? [];

  const { data, isLoading, isError, refetch } = useBlackspots({
    skip: page * limit,
    limit,
    upload_id: uploadFilter,
    risk_tier: riskFilter || undefined,
  });

  const allBlackspots: BlackspotRecord[] = data?.blackspots ?? [];
  const total = data?.total ?? 0;

  const filtered = useMemo(() => {
    let d = [...allBlackspots];
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
  }, [allBlackspots, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Accordion toggle — only one open at a time
  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const exportCSV = useCallback(() => {
    if (allBlackspots.length === 0) return;
    const headers = [
      "Rank","Km","Risk Tier","Confidence","Total Accidents","Fatal","Grievous",
      "Total Severity","Accident Rate","Rank Score","Dominant Cause",
      "Dominant Nature","Dominant Vehicle","Dominant Time","Cluster ID","Locations",
    ];
    const rows = allBlackspots.map((b) => [
      b.rank ?? "", b.segment_500m, b.risk_tier ?? "",
      b.confidence_score?.toFixed(1) ?? "",
      b.total_accidents, b.total_fatal, b.total_grievous,
      b.total_severity, b.accident_rate.toFixed(2),
      b.blackspot_rank_score.toFixed(3),
      b.dominant_cause ?? "", b.dominant_nature ?? "",
      b.dominant_vehicle ?? "", b.dominant_time ?? "",
      b.cluster_id ?? "",
      `"${(b.locations ?? "").replace(/"/g, "'")}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `blackspots_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [allBlackspots]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      : <span style={{ opacity: 0.25 }}><ChevronUp size={11} /></span>;

  const colStyle: React.CSSProperties = {
    padding: "13px 14px", textAlign: "left",
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px",
    color: "var(--text-muted)", textTransform: "uppercase",
    background: "var(--bg-card)", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "13px 14px", fontSize: "13px",
    color: "var(--text-primary)", whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "float-up 0.4s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>
            Detected Blackspots
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            {isLoading ? "Loading…" : `${total} high-risk segments · ${allBlackspots.filter(b => b.confidence_score && b.confidence_score >= 75).length} Confirmed`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 16px", borderRadius: "10px",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={allBlackspots.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "10px",
              background: allBlackspots.length > 0 ? "var(--gradient-1)" : "var(--bg-card)",
              border: "none",
              color: allBlackspots.length > 0 ? "white" : "var(--text-muted)",
              fontSize: "13px", fontWeight: 600,
              cursor: allBlackspots.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "#ef4444", fontSize: "13px" }}>Failed to load blackspots. Check backend connection.</span>
          <button onClick={() => refetch()} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* Filters + Dataset Selector */}
      <div className="glass-card" style={{ padding: "16px 20px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Dataset selector */}
        <select
          value={uploadFilter ?? ""}
          onChange={e => { setUploadFilter(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
          style={{
            padding: "8px 12px", borderRadius: "10px",
            border: "1px solid var(--border)", background: "var(--bg-primary)",
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

        {/* Search */}
        <div style={{ flex: 1, minWidth: "180px", display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "10px", padding: "9px 14px" }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            suppressHydrationWarning
            type="text" placeholder="Search km, cause, location…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "13px", width: "100%" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: "16px" }}>×</button>
          )}
        </div>

        {/* Risk tier filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <Filter size={13} color="var(--text-muted)" />
          {["", "CRITICAL", "HIGH", "MODERATE", "BLACK SPOT"].map((t) => (
            <button
              suppressHydrationWarning key={t}
              onClick={() => { setRiskFilter(t); setPage(0); }}
              style={{
                padding: "6px 12px", borderRadius: "8px",
                border: riskFilter === t ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                background: riskFilter === t ? "rgba(79,142,247,0.15)" : "transparent",
                color: riskFilter === t ? "var(--accent-blue)" : "var(--text-secondary)",
                fontSize: "12px", fontWeight: riskFilter === t ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap",
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
                <th style={colStyle}></th>
                {([
                  { label: "Rank",       key: "rank",                sortable: true  },
                  { label: "Km",         key: null,                  sortable: false },
                  { label: "Risk Tier",  key: null,                  sortable: false },
                  { label: "Confidence", key: "confidence_score",    sortable: true  },
                  { label: "Accidents",  key: "total_accidents",     sortable: true  },
                  { label: "Fatal",      key: "total_fatal",         sortable: true  },
                  { label: "Rate/yr",    key: "accident_rate",       sortable: true  },
                  { label: "Score",      key: "blackspot_rank_score",sortable: true  },
                  { label: "Cause",      key: null,                  sortable: false },
                  { label: "Cluster",    key: null,                  sortable: false },
                ] as { label: string; key: SortKey | null; sortable: boolean }[]).map((col, i) => (
                  <th key={i}
                    onClick={() => col.sortable && col.key && toggleSort(col.key)}
                    style={{ ...colStyle, cursor: col.sortable ? "pointer" : "default" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {col.label}
                      {col.sortable && col.key && <SortIcon k={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading
                ? Array(10).fill(0).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      {Array(11).fill(0).map((_, j) => (
                        <td key={j} style={{ padding: "13px 14px" }}>
                          <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr><td colSpan={11} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                      {search || riskFilter ? "No blackspots match your filters." : "No blackspots detected yet. Upload accident data to start the ML pipeline."}
                    </td></tr>
                  )
                  : filtered.map((bs) => (
                    <Fragment key={bs.id}>
                      <tr
                        onClick={() => toggleExpand(bs.id)}
                        style={{
                          borderBottom: expandedId === bs.id ? "none" : "1px solid var(--border)",
                          transition: "background 0.15s",
                          cursor: "pointer",
                          background: expandedId === bs.id ? "rgba(99,102,241,0.06)" : "transparent",
                        }}
                        onMouseEnter={e => { if (expandedId !== bs.id) e.currentTarget.style.background = "var(--bg-card-hover)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = expandedId === bs.id ? "rgba(99,102,241,0.06)" : "transparent"; }}
                      >
                        {/* Expand chevron */}
                        <td style={{ ...tdStyle, width: "36px", color: "var(--text-muted)" }}>
                          <span style={{ transition: "transform 0.2s", display: "inline-block", transform: expandedId === bs.id ? "rotate(90deg)" : "rotate(0deg)" }}>
                            <ChevronRight size={14} />
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: (bs.rank ?? 99) <= 3 ? "#ef4444" : "var(--text-primary)" }}>
                          #{bs.rank ?? "—"}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "var(--accent-blue)" }}>
                          {bs.segment_500m}
                        </td>
                        <td style={tdStyle}><RiskBadge tier={bs.risk_tier} /></td>
                        <td style={tdStyle}>
                          <ConfidenceBadge score={bs.confidence_score} size="sm" />
                        </td>
                        <td style={tdStyle}>{bs.total_accidents}</td>
                        <td style={{ ...tdStyle, color: bs.total_fatal > 5 ? "#ef4444" : "var(--text-primary)", fontWeight: 600 }}>
                          {bs.total_fatal}
                        </td>
                        <td style={tdStyle}>{(bs.accident_rate ?? 0).toFixed(2)}</td>
                        <td style={tdStyle}>{(bs.blackspot_rank_score ?? 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: "12px" }}>
                          {bs.dominant_cause ?? "—"}
                        </td>
                        <td style={tdStyle}>
                          {bs.cluster_id !== null && bs.cluster_id !== undefined && bs.cluster_id >= 0
                            ? <span style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", padding: "2px 8px", borderRadius: "12px", fontSize: "11px" }}>#{bs.cluster_id}</span>
                            : <span style={{ color: "var(--text-muted)" }}>—</span>
                          }
                        </td>
                      </tr>

                      {/* Accordion expanded row */}
                      {expandedId === bs.id && (
                        <tr key={`exp-${bs.id}`} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td colSpan={11} style={{ padding: 0 }}>
                            <div style={{
                              padding: "18px 24px",
                              background: "rgba(99,102,241,0.04)",
                              borderTop: "1px solid rgba(99,102,241,0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "16px",
                              flexWrap: "wrap",
                            }}>
                              {/* Quick stats */}
                              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                                {[
                                  { label: "Total Severity",  val: bs.total_severity.toFixed(1) },
                                  { label: "Grievous",        val: bs.total_grievous },
                                  { label: "Criteria Met",    val: `${bs.criteria_count}/5` },
                                  { label: "Dominant Time",   val: bs.dominant_time ?? "—" },
                                  { label: "Dominant Nature", val: bs.dominant_nature ?? "—" },
                                  { label: "Locations",       val: bs.locations ? bs.locations.split(",").length + " spots" : "—" },
                                ].map(({ label, val }) => (
                                  <div key={label}>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>{val}</div>
                                  </div>
                                ))}
                              </div>

                              {/* CTA */}
                              <button
                                onClick={e => { e.stopPropagation(); setDrawerBsId(bs.id); }}
                                style={{
                                  padding: "9px 18px", borderRadius: "10px",
                                  background: "var(--gradient-1)", border: "none",
                                  color: "white", fontSize: "13px", fontWeight: 600,
                                  cursor: "pointer", whiteSpace: "nowrap",
                                  display: "flex", alignItems: "center", gap: "6px",
                                }}
                              >
                                View Full Analysis →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > limit && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <PagBtn label="← Prev" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
              {Array.from({ length: Math.min(5, Math.ceil(total / limit)) }, (_, i) => i).map((i) => (
                <button key={i} onClick={() => setPage(i)} style={{
                  width: 36, height: 36, borderRadius: "8px",
                  border: page === i ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: page === i ? "rgba(79,142,247,0.15)" : "transparent",
                  color: page === i ? "var(--accent-blue)" : "var(--text-secondary)",
                  fontSize: "13px", cursor: "pointer",
                }}>{i + 1}</button>
              ))}
              <PagBtn label="Next →" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} />
            </div>
          </div>
        )}
      </div>

      {/* Full detail drawer */}
      <BlackspotDrawer
        blackspotId={drawerBsId}
        onClose={() => setDrawerBsId(null)}
      />
    </div>
  );
}

function PagBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      padding: "8px 16px", borderRadius: "8px",
      border: "1px solid var(--border)",
      background: disabled ? "transparent" : "var(--bg-card)",
      color: disabled ? "var(--text-muted)" : "var(--text-primary)",
      fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer",
    }}>
      {label}
    </button>
  );
}
