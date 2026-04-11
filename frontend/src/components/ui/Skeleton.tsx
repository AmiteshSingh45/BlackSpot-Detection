export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height: "140px", borderRadius: "16px" }}
    />
  );
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div
      className="skeleton"
      style={{ height: `${height}px`, borderRadius: "12px" }}
    />
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="skeleton" style={{ width: 40, height: 20, borderRadius: "6px", flexShrink: 0 }} />
      <div className="skeleton" style={{ width: "25%", height: 16, borderRadius: "6px" }} />
      <div className="skeleton" style={{ width: "20%", height: 16, borderRadius: "6px" }} />
      <div className="skeleton" style={{ width: "15%", height: 16, borderRadius: "6px" }} />
      <div className="skeleton" style={{ width: "20%", height: 16, borderRadius: "6px" }} />
    </div>
  );
}
