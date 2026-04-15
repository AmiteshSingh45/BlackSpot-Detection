"use client";
/**
 * src/context/AlertContext.tsx
 * ─────────────────────────────
 * Global context providing the unread alert count to all components.
 * This powers the navbar badge without prop-drilling.
 *
 * Usage:
 *   const { unreadCount, refresh } = useAlertContext();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { fetchAlertSummary } from "@/services/api";

// ── Context shape ────────────────────────────────────────────────
interface AlertContextValue {
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const AlertContext = createContext<AlertContextValue>({
  unreadCount: 0,
  isLoading: false,
  refresh: async () => {},
});

export const useAlertContext = () => useContext(AlertContext);

// ── Poll interval ─────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ── Provider ──────────────────────────────────────────────────────
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const summary = await fetchAlertSummary();
      setUnreadCount(summary.unread_count ?? 0);
    } catch {
      // Silently fail — backend may not be running yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return (
    <AlertContext.Provider value={{ unreadCount, isLoading, refresh }}>
      {children}
    </AlertContext.Provider>
  );
}
