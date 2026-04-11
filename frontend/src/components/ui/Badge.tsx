export function RiskBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>;

  const t = tier.toUpperCase();
  let cls = "badge-safe";
  if (t.includes("CRITICAL")) cls = "badge-critical";
  else if (t.includes("HIGH")) cls = "badge-high";
  else if (t.includes("MODERATE")) cls = "badge-moderate";
  else if (t.includes("BLACK")) cls = "badge-blackspot";
  else if (t.includes("WATCH")) cls = "badge-high";

  return (
    <span
      className={cls}
      style={{
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap",
      }}
    >
      {tier}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string; pulse?: boolean }> = {
    completed:  { bg: "rgba(16,185,129,0.15)", color: "var(--accent-green)",  label: "Completed" },
    processing: { bg: "rgba(79,142,247,0.15)", color: "var(--accent-blue)",   label: "Processing", pulse: true },
    pending:    { bg: "rgba(245,158,11,0.15)", color: "var(--accent-yellow)", label: "Pending",    pulse: true },
    failed:     { bg: "rgba(239,68,68,0.15)",  color: "var(--accent-red)",    label: "Failed" },
  };
  const s = map[status] ?? { bg: "rgba(90,95,122,0.15)", color: "var(--text-muted)", label: status };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        background: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {s.pulse && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: s.color,
            display: "inline-block",
            animation: "pulse-glow 1.4s ease-in-out infinite",
          }}
        />
      )}
      {s.label}
    </span>
  );
}
