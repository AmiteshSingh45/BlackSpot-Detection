"use client";
import { useEffect, useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, XCircle, RefreshCw, AlertTriangle, Loader2, Clock } from "lucide-react";
import { uploadFile, fetchUploads, pollUploadStatus } from "@/services/api";
import type { UploadRecord } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";

type PipelinePhase =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [currentRecord, setCurrentRecord] = useState<UploadRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUploads, setLoadingUploads] = useState(true);

  const loadUploads = useCallback(async () => {
    setLoadingUploads(true);
    try {
      const data = await fetchUploads();
      setUploads(data.uploads ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  // Load upload history on mount
  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const handleFile = useCallback(async (file: File) => {
    const allowed = [".xlsx", ".xls", ".csv", ".json"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError(`Unsupported format: ${ext}. Use: ${allowed.join(", ")}`);
      return;
    }

    setPhase("uploading");
    setUploadPct(0);
    setError(null);
    setCurrentRecord(null);

    try {
      // Step 1: Upload the file
      const res = await uploadFile(file, setUploadPct);
      setPhase("processing");

      // Step 2: Poll until pipeline completes
      const finalRecord = await pollUploadStatus(
        res.upload_id,
        (record) => {
          setCurrentRecord(record);
          // Refresh list with each update so status reflects live
          setUploads((prev) => {
            const idx = prev.findIndex((u) => u.id === record.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = record;
              return next;
            }
            return [record, ...prev];
          });
        }
      );

      setCurrentRecord(finalRecord);
      setPhase(finalRecord.status === "completed" ? "completed" : "failed");

      if (finalRecord.status === "failed") {
        setError(finalRecord.error_message ?? "Pipeline failed with unknown error.");
      }

      // Final full refresh of uploads list
      await loadUploads();
    } catch (e: any) {
      setPhase("failed");
      setError(e?.response?.data?.detail ?? e?.message ?? "Upload failed. Check backend connection.");
    }
  }, [loadUploads]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  const reset = () => {
    setPhase("idle");
    setError(null);
    setCurrentRecord(null);
    setUploadPct(0);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const s = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    return s < 60 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}m`;
  };

  const isActive = phase === "uploading" || phase === "processing";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "float-up 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>Upload Data</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
          Import accident records to trigger the full ML analysis pipeline
        </p>
      </div>

      {/* Drop zone */}
      <label htmlFor="file-upload" style={{ cursor: isActive ? "not-allowed" : "pointer" }}>
        <div
          onDragEnter={() => !isActive && setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={isActive ? undefined : onDrop}
          style={{
            border: `2px dashed ${dragging ? "var(--accent-blue)" : phase === "completed" ? "var(--accent-green)" : phase === "failed" ? "var(--accent-red)" : "var(--border-light)"}`,
            borderRadius: "20px",
            padding: "60px 40px",
            textAlign: "center",
            background: dragging
              ? "rgba(79,142,247,0.06)"
              : phase === "completed" ? "rgba(16,185,129,0.04)"
              : phase === "failed" ? "rgba(239,68,68,0.04)"
              : "var(--bg-card)",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden",
            opacity: isActive ? 0.9 : 1,
          }}
        >
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "3px",
            background: isActive ? "var(--gradient-1)" : "transparent",
            transition: "background 0.3s",
          }} />

          {/* Upload progress bar */}
          {phase === "uploading" && (
            <div style={{
              position: "absolute", top: 0, left: 0, height: "3px",
              width: `${uploadPct}%`,
              background: "var(--gradient-1)",
              transition: "width 0.3s ease",
            }} />
          )}

          {/* ── UPLOADING ── */}
          {phase === "uploading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid var(--accent-blue)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
              <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "16px" }}>Uploading file...</div>
              <div style={{ color: "var(--accent-blue)", fontSize: "20px", fontWeight: 800 }}>{uploadPct}%</div>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {phase === "processing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", animation: "spin 1s linear infinite" }} />
                <Loader2 size={24} color="#8b5cf6" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
              </div>
              <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "16px" }}>ML Pipeline Running...</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Clock size={14} color="var(--text-muted)" />
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Status: <span style={{ color: "#8b5cf6", fontWeight: 600 }}>{currentRecord?.status ?? "processing"}</span>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Ingesting → Preprocessing → Segmenting → Detecting → Storing
              </div>
            </div>
          )}

          {/* ── COMPLETED ── */}
          {phase === "completed" && currentRecord && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <CheckCircle size={52} color="var(--accent-green)" />
              <div style={{ color: "var(--accent-green)", fontWeight: 800, fontSize: "18px" }}>Pipeline Complete!</div>
              <div style={{ display: "flex", gap: "24px" }}>
                <Stat label="Records" value={currentRecord.record_count?.toLocaleString() ?? "—"} color="var(--accent-blue)" />
                <Stat label="Segments" value={currentRecord.segment_count ?? "—"} color="#8b5cf6" />
                <Stat label="Blackspots" value={currentRecord.blackspot_count ?? "—"} color="#ef4444" />
              </div>
              <button onClick={reset} style={{ marginTop: "4px", padding: "8px 20px", borderRadius: "10px", border: "1px solid var(--accent-green)", background: "transparent", color: "var(--accent-green)", fontSize: "13px", cursor: "pointer" }}>
                Upload Another File
              </button>
            </div>
          )}

          {/* ── FAILED ── */}
          {phase === "failed" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <XCircle size={52} color="var(--accent-red)" />
              <div style={{ color: "var(--accent-red)", fontWeight: 700, fontSize: "16px" }}>Pipeline Failed</div>
              <div style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "400px" }}>{error}</div>
              <button onClick={reset} style={{ padding: "8px 20px", borderRadius: "10px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontSize: "13px", cursor: "pointer" }}>
                Try Again
              </button>
            </div>
          )}

          {/* ── IDLE ── */}
          {phase === "idle" && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: "20px", margin: "0 auto 20px", background: "var(--gradient-1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={32} color="white" />
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                Drop your file here
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
                or click to browse files
              </div>
              <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {[".xlsx", ".xls", ".csv", ".json"].map((ext) => (
                  <span key={ext} style={{ padding: "4px 12px", borderRadius: "20px", background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", color: "var(--accent-blue)", fontSize: "12px", fontWeight: 500 }}>
                    {ext}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <input
          id="file-upload"
          type="file"
          onChange={onInputChange}
          style={{ display: "none" }}
          accept=".xlsx,.xls,.csv,.json"
          disabled={isActive}
        />
      </label>

      {/* Pipeline stages diagram */}
      <div className="glass-card" style={{ padding: "20px 24px" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={14} color="var(--accent-yellow)" />
          Pipeline Stages
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
          {[
            { n: 1, label: "Ingest", desc: "Parse & validate" },
            { n: 2, label: "Preprocess", desc: "Clean & enrich" },
            { n: 3, label: "Segment", desc: "500m segments" },
            { n: 4, label: "Detect", desc: "Blackspot criteria" },
            { n: 5, label: "Persist", desc: "Save to database" },
          ].map((stage) => (
            <div key={stage.n} style={{ textAlign: "center", padding: "12px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gradient-1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: "13px", fontWeight: 700, color: "white" }}>
                {stage.n}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{stage.label}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{stage.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload history */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>
            Upload History
            {uploads.length > 0 && (
              <span style={{ marginLeft: "8px", fontSize: "12px", background: "rgba(79,142,247,0.15)", color: "var(--accent-blue)", padding: "2px 8px", borderRadius: "10px" }}>
                {uploads.length}
              </span>
            )}
          </h3>
          <button
            onClick={loadUploads}
            disabled={loadingUploads}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}
          >
            <RefreshCw size={12} style={{ animation: loadingUploads ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {loadingUploads ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8, borderRadius: 10 }} />
          ))
        ) : uploads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            <FileText size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <div style={{ fontSize: "14px" }}>No uploads yet. Upload a file to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["ID", "Filename", "Type", "Status", "Records", "Segments", "Blackspots", "Uploaded", "Duration"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 14px", color: "var(--text-muted)", fontWeight: 600 }}>#{u.id}</td>
                    <td style={{ padding: "13px 14px", color: "var(--text-primary)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.original_filename}
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ background: "rgba(79,142,247,0.1)", color: "var(--accent-blue)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                        .{u.file_type}
                      </span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <StatusBadge status={u.status} />
                    </td>
                    <td style={{ padding: "13px 14px", color: "var(--text-secondary)" }}>{u.record_count?.toLocaleString() ?? "—"}</td>
                    <td style={{ padding: "13px 14px", color: "var(--text-secondary)" }}>{u.segment_count ?? "—"}</td>
                    <td style={{ padding: "13px 14px", color: "#ef4444", fontWeight: 600 }}>{u.blackspot_count ?? "—"}</td>
                    <td style={{ padding: "13px 14px", color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDate(u.uploaded_at)}
                    </td>
                    <td style={{ padding: "13px 14px", color: "var(--text-secondary)" }}>
                      {formatDuration(u.pipeline_started, u.pipeline_ended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "22px", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>
    </div>
  );
}
