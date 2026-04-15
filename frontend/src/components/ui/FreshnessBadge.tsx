"use client";
// src/components/ui/FreshnessBadge.tsx
// Shows the last time data was updated + the latest upload name.
// Auto-refreshes every 60 seconds. Pulsing green dot if data updated < 5 min ago.

import { useFreshness } from "@/hooks/useBlackspotQueries";

function timeAgo(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins   < 1)  return "just now";
  if (mins   < 60) return `${mins}m ago`;
  const hrs  = Math.floor(mins / 60);
  if (hrs    < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FreshnessBadge() {
  const { data, isLoading, isError } = useFreshness();

  if (isLoading || isError || !data) {
    return (
      <div style={{
        display:    "flex",
        alignItems: "center",
        gap:        "6px",
        fontSize:   "0.7rem",
        color:      "var(--text-secondary)",
        opacity:    0.5,
      }}>
        <span style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#94a3b8",
        }} />
        Loading…
      </div>
    );
  }

  const { last_completed_at, latest_upload_label } = data;
  const isRecent = last_completed_at
    ? (Date.now() - new Date(last_completed_at).getTime()) < 5 * 60_000
    : false;

  return (
    <div
      title={last_completed_at
        ? `Last pipeline: ${new Date(last_completed_at).toLocaleString()}`
        : "No completed pipelines yet"
      }
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "6px",
        fontSize:   "0.7rem",
        color:      "var(--text-secondary)",
        cursor:     "default",
        userSelect: "none",
      }}
    >
      {/* Status dot */}
      <span style={{
        width:        "6px",
        height:       "6px",
        borderRadius: "50%",
        background:   isRecent ? "#22c55e" : "#94a3b8",
        boxShadow:    isRecent ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
        animation:    isRecent ? "freshPulse 2s ease-in-out infinite" : "none",
        flexShrink:   0,
      }} />

      <span>
        Updated {timeAgo(last_completed_at)}
        {latest_upload_label && (
          <span style={{ opacity: 0.65 }}>
            {" "}· {latest_upload_label.length > 22
              ? latest_upload_label.slice(0, 22) + "…"
              : latest_upload_label}
          </span>
        )}
      </span>

      <style>{`
        @keyframes freshPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  );
}
