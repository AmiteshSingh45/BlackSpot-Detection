"use client";
import { Bell, Search, Sun, Moon, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import FreshnessBadge from "@/components/ui/FreshnessBadge";

const pageTitles: Record<string, { title: string; subtitle: string; emoji: string }> = {
  "/":           { title: "Dashboard",   subtitle: "Real-time road safety overview",          emoji: "📊" },
  "/map":        { title: "Map View",    subtitle: "Geographic blackspot distribution",        emoji: "🗺️" },
  "/blackspots": { title: "Blackspots",  subtitle: "Detected high-risk road segments",         emoji: "⚠️" },
  "/analytics":  { title: "Analytics",   subtitle: "Trends, patterns & deep insights",         emoji: "📈" },
  "/upload":     { title: "Upload Data", subtitle: "Import accident records for ML analysis",  emoji: "📁" },
};

export default function TopBar() {
  const path = usePathname();
  const page = pageTitles[path] ?? { title: "BlackSpot AI", subtitle: "", emoji: "🛡️" };
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      style={{
        height: "68px",
        background: "var(--topbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
        boxShadow: "0 1px 16px rgba(0,0,0,0.10)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        transition: "background-color 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Left: Page title */}
      <div style={{ animation: "float-up 0.35s ease-out", display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Page icon chip */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: "var(--accent-blue-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            border: "1px solid var(--accent-blue-glow)",
            flexShrink: 0,
          }}
        >
          {page.emoji}
        </div>
        <div>
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.4px",
              lineHeight: 1.2,
            }}
          >
            {page.title}
          </h1>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
            {page.subtitle}
          </p>
        </div>
      </div>

      {/* Right: actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

        {/* Data Freshness Indicator */}
        <div style={{
          padding:      "6px 12px",
          borderRadius: "8px",
          background:   "var(--bg-card)",
          border:       "1px solid var(--border)",
          display:      "flex",
          alignItems:   "center",
        }}>
          <FreshnessBadge />
        </div>


        {/* Search bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "8px 14px",
            width: "220px",
            cursor: "text",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-light)";
            e.currentTarget.style.boxShadow = "var(--shadow-card)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Search size={13} color="var(--text-muted)" />
          <span style={{ fontSize: "13px", color: "var(--text-muted)", flex: 1 }}>
            Search locations...
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "2px 5px",
              letterSpacing: "0.5px",
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Theme toggle */}
        <button
          suppressHydrationWarning
          id="theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="btn-icon btn"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-hover)";
            e.currentTarget.style.borderColor = "var(--border-light)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "var(--shadow-card)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-card)";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "theme-toggle-spin 0.45s ease",
              animationFillMode: "forwards",
            }}
            key={theme}
          >
            {theme === "dark" ? (
              <Sun size={15} color="var(--accent-yellow)" />
            ) : (
              <Moon size={15} color="var(--accent-blue)" />
            )}
          </span>
        </button>

        {/* Notification */}
        <button
          suppressHydrationWarning
          className="btn-icon btn"
          title="Notifications"
          style={{ position: "relative", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-hover)";
            e.currentTarget.style.borderColor = "var(--border-light)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "var(--shadow-card)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-card)";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Bell size={15} />
          {/* Red dot badge */}
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent-red)",
              border: "1.5px solid var(--bg-secondary)",
            }}
          />
        </button>

        {/* Avatar — initials */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            background: "var(--gradient-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "var(--shadow-glow-blue)",
            fontSize: "13px",
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.5px",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            userSelect: "none",
          }}
          title="User profile"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,142,247,0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "var(--shadow-glow-blue)";
          }}
        >
          AK
        </div>
      </div>
    </header>
  );
}
