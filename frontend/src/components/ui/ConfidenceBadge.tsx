"use client";
// src/components/ui/ConfidenceBadge.tsx
// Displays a confidence level badge with color coding.
// Confirmed (>=75) = green, Likely (>=50) = amber, Possible (<50) = slate

import { getConfidenceLevel, type ConfidenceLevel } from "@/types";

interface ConfidenceBadgeProps {
  score: number | null | undefined;
  showScore?: boolean;
  size?: "sm" | "md";
}

const CONFIG: Record<ConfidenceLevel, { label: string; bg: string; text: string; dot: string }> = {
  Confirmed: {
    label: "Confirmed",
    bg:    "rgba(34,197,94,0.15)",
    text:  "var(--color-success, #22c55e)",
    dot:   "#22c55e",
  },
  Likely: {
    label: "Likely",
    bg:    "rgba(251,191,36,0.15)",
    text:  "#fbbf24",
    dot:   "#fbbf24",
  },
  Possible: {
    label: "Possible",
    bg:    "rgba(148,163,184,0.15)",
    text:  "#94a3b8",
    dot:   "#94a3b8",
  },
};

export default function ConfidenceBadge({ score, showScore = true, size = "md" }: ConfidenceBadgeProps) {
  const level  = getConfidenceLevel(score);
  const config = CONFIG[level];
  const pad    = size === "sm" ? "2px 8px" : "4px 10px";
  const fs     = size === "sm" ? "0.7rem"  : "0.75rem";

  return (
    <span
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           "5px",
        padding:       pad,
        borderRadius:  "20px",
        fontSize:      fs,
        fontWeight:    600,
        background:    config.bg,
        color:         config.text,
        whiteSpace:    "nowrap",
      }}
    >
      <span
        style={{
          width:        "6px",
          height:       "6px",
          borderRadius: "50%",
          background:   config.dot,
          flexShrink:   0,
        }}
      />
      {config.label}
      {showScore && score !== null && score !== undefined && (
        <span style={{ opacity: 0.75 }}>· {score.toFixed(0)}%</span>
      )}
    </span>
  );
}
