"use client";
import React, { useState } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: { value: number; label: string };
  glow?: string;
}

export default function KPICard({ title, value, subtitle, icon, gradient, trend, glow }: KPICardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="glass-card glass-card-interactive animate-slide-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "22px 24px",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? glow
            ? `0 16px 48px ${glow}44`
            : "var(--shadow-card-hover)"
          : "var(--shadow-card)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
        borderColor: hovered ? "var(--border-light)" : "var(--border)",
      }}
    >
      {/* Gradient overlay */}
      <div
        className={gradient}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          opacity: hovered ? 1.4 : 1,
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Animated top accent bar */}
      {glow && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: hovered ? "10%" : "25%",
            right: hovered ? "10%" : "25%",
            height: "2px",
            background: glow,
            borderRadius: "0 0 4px 4px",
            opacity: hovered ? 1 : 0.45,
            transition: "opacity 0.25s ease, left 0.35s ease, right 0.35s ease",
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* Glow dot top-right */}
      {glow && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: glow,
            boxShadow: `0 0 8px ${glow}, 0 0 18px ${glow}66`,
            animation: "pulse-glow 2.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Large decorative blur in corner */}
      {glow && (
        <div
          style={{
            position: "absolute",
            bottom: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: glow,
            opacity: hovered ? 0.08 : 0.04,
            filter: "blur(24px)",
            pointerEvents: "none",
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Icon + title */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.2px" }}>
            {title}
          </div>
          <div
            className="icon-chip"
            style={{
              width: 36,
              height: 36,
              transition: "transform 0.22s ease, background 0.22s ease",
              transform: hovered ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
            }}
          >
            {icon}
          </div>
        </div>

        {/* Value */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: 900,
            color: "var(--text-primary)",
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: "8px",
            transition: "color 0.25s ease",
            animation: "count-up 0.5s ease-out",
          }}
        >
          {value}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", letterSpacing: "0.1px", lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}

        {/* Trend */}
        {trend && (
          <div
            style={{
              fontSize: "12px",
              color: trend.value >= 0 ? "var(--accent-green)" : "var(--accent-red)",
              fontWeight: 700,
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <span>{trend.value >= 0 ? "▲" : "▼"}</span>
            <span>{Math.abs(trend.value)}% {trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
