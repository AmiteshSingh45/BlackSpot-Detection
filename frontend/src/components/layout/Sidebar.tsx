"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Map, Upload, AlertTriangle, BarChart2,
  Shield, Activity, Zap, Bell, FileText,
} from "lucide-react";
import { useAlertContext } from "@/context/AlertContext";

const navItems = [
  { label: "Dashboard",  href: "/",          icon: LayoutDashboard, accent: "#4f8ef7" },
  { label: "Map",        href: "/map",        icon: Map,             accent: "#06b6d4" },
  { label: "Blackspots", href: "/blackspots", icon: AlertTriangle,   accent: "#ef4444" },
  { label: "Analytics",  href: "/analytics",  icon: BarChart2,       accent: "#8b5cf6" },
  { label: "Alerts",     href: "/alerts",     icon: Bell,            accent: "#f59e0b" },
  { label: "Reports",    href: "/reports",    icon: FileText,        accent: "#10b981" },
  { label: "Upload",     href: "/upload",     icon: Upload,          accent: "#10b981" },
];

export default function Sidebar() {
  const path = usePathname();
  const { unreadCount } = useAlertContext();

  return (
    <aside
      style={{
        width: "228px",
        height: "100vh",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        boxShadow: "1px 0 24px rgba(0,0,0,0.15)",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* ── Logo ── */}
      <div
        style={{
          padding: "20px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Animated glow ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "15px",
              background: "var(--gradient-1)",
              opacity: 0.35,
              filter: "blur(4px)",
            }}
          />
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: "var(--gradient-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: "var(--shadow-glow-blue)",
            }}
          >
            <Shield size={19} color="white" />
          </div>
        </div>
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: "15px",
              color: "var(--text-primary)",
              letterSpacing: "-0.4px",
            }}
          >
            BlackSpot<span className="gradient-text"> AI</span>
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px", letterSpacing: "0.2px" }}>
            Road Safety Platform
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ padding: "14px 10px", flex: 1, overflowY: "auto" }}>
        <div className="section-label" style={{ padding: "0 10px 10px" }}>
          Navigation
        </div>

        {navItems.map(({ label, href, icon: Icon, accent }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "10px",
                marginBottom: "2px",
                textDecoration: "none",
                fontSize: "13.5px",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                background: active ? "var(--accent-blue-soft)" : "transparent",
                borderLeft: active ? `2.5px solid var(--accent-blue)` : "2.5px solid transparent",
                transition: "all 0.18s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--bg-surface)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {/* Icon chip */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? `${accent}22` : "transparent",
                  flexShrink: 0,
                  transition: "background 0.18s ease",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2.3 : 1.8}
                  color={active ? accent : "currentColor"}
                />
              </div>
              {label}

              {/* Alert badge */}
              {label === "Alerts" && unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    minWidth: 18,
                    height: 18,
                    borderRadius: "9px",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                    flexShrink: 0,
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}

              {/* Active indicator dot */}
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="divider" style={{ margin: "12px 10px" }} />

        {/* Quick stats note */}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "10px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Zap size={12} color="var(--accent-yellow)" />
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 500 }}>
            ML Pipeline Ready
          </span>
        </div>
      </nav>

      {/* ── Status Badge ── */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.18)",
          }}
        >
          <div
            className="status-dot"
            style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }}
          />
          <Activity size={12} color="var(--accent-green)" />
          <span style={{ fontSize: "11.5px", color: "var(--accent-green)", fontWeight: 700, letterSpacing: "0.1px" }}>
            Backend Connected
          </span>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
          v1.0 · BlackSpot AI
        </div>
      </div>
    </aside>
  );
}
