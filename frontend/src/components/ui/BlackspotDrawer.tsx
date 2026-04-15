"use client";
// src/components/ui/BlackspotDrawer.tsx
// Right-side slide-in drawer for full blackspot explainability detail.
// Triggered by "View Details" in map popup or row expansion CTA.
// Does NOT use Leaflet popups — renders in the React tree above the map.

import { useEffect } from "react";
import { useBlackspotDetail } from "@/hooks/useBlackspotQueries";
import ExplainabilityPanel from "./ExplainabilityPanel";

interface Props {
  blackspotId: number | null;
  onClose: () => void;
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 4px" }}>
      {[80, 60, 90, 70, 55].map((w, i) => (
        <div key={i} style={{
          height:       "14px",
          width:        `${w}%`,
          background:   "rgba(255,255,255,0.06)",
          borderRadius: "6px",
          marginBottom: "12px",
          animation:    "pulse 1.5s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

export default function BlackspotDrawer({ blackspotId, onClose }: Props) {
  const { data, isLoading, isError } = useBlackspotDetail(blackspotId, blackspotId !== null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const isOpen = blackspotId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed",
          inset:       0,
          background:  "rgba(0,0,0,0.45)",
          zIndex:      999,
          opacity:     isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position:    "fixed",
          top:          0,
          right:        0,
          width:        "min(420px, 95vw)",
          height:       "100vh",
          background:   "var(--bg-secondary)",
          borderLeft:   "1px solid var(--border-color)",
          zIndex:       1000,
          transform:    isOpen ? "translateX(0)" : "translateX(100%)",
          transition:   "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          display:      "flex",
          flexDirection: "column",
          boxShadow:   "-8px 0 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{
          padding:        "18px 20px 14px",
          borderBottom:   "1px solid var(--border-color)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexShrink:     0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Blackspot Analysis
            </h3>
            {data && (
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                km {data.segment_500m} · {data.risk_tier}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background:   "rgba(255,255,255,0.06)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding:      "6px 10px",
              cursor:       "pointer",
              color:        "var(--text-secondary)",
              fontSize:     "1rem",
              lineHeight:   1,
              transition:   "background 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px" }}>
          {isLoading && <LoadingSkeleton />}
          {isError && (
            <div style={{
              padding:      "16px",
              borderRadius: "10px",
              background:   "rgba(239,68,68,0.1)",
              border:       "1px solid rgba(239,68,68,0.3)",
              color:        "#ef4444",
              fontSize:     "0.82rem",
              textAlign:    "center",
            }}>
              Failed to load blackspot details. Please try again.
            </div>
          )}
          {data && <ExplainabilityPanel data={data} />}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </>
  );
}
